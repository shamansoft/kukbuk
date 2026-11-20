/** @jest-environment jsdom */

const { preparePage } = require("./page-content.js");

const PAGE = new URL("https://user:password@example.com/r?id=42&token=secret#top");

function prepare(body, head = "<title>Family cookbook</title>", location = PAGE) {
  document.head.innerHTML = head;
  document.body.innerHTML = body;
  const page = preparePage(document, location);
  return { ...page, html: new DOMParser().parseFromString(page.pageContent, "text/html") };
}

test("retains unfamiliar recipe markup, page text, links and microdata", () => {
  const page = prepare(`
    <main class="unfamiliar-template"><section>
      <p>From my grandmother's notebook.</p>
      <h2>Simple stew</h2><ul><li itemprop="recipeIngredient">2 potatoes</li></ul>
      <p>Simmer until tender.</p>
      <img src="/stew.jpg?tracking=1" alt="Stew">
      <a href="/variations?recipe_id=9&token=private#related">Variations</a>
    </section></main>
  `);

  expect(page.title).toBe("Family cookbook");
  expect(page.pageUrl).toBe("https://example.com/r?id=42");
  expect(page.html.querySelector("main.unfamiliar-template").textContent).toContain(
    "Simmer until tender.",
  );
  expect(page.html.querySelector("li[itemprop=recipeIngredient]").textContent).toBe("2 potatoes");
  expect(page.html.querySelector("img").getAttribute("src")).toBe("https://example.com/stew.jpg");
  expect(page.html.querySelector("a").getAttribute("href")).toBe(
    "https://example.com/variations?recipe_id=9",
  );
  expect(page.pageContent).toContain("From my grandmother");
});

test("removes likely private material without changing the original page", () => {
  const page = prepare(
    `<article data-user-token="opaque-token" onclick="event-token">
      <p>Keep the ingredient list. Email reader@example.com</p>
      <a href="mailto:author@example.com">Contact the author</a>
      <a href="tel:+15551234567">Call the author</a>
      <form><input type="hidden" value="hidden-token"><p>Account form</p></form>
      <p hidden>hidden profile</p>
      <p aria-hidden="true">hidden accessibility block</p>
      <p style="display: none">inline hidden profile</p>
      <div class="wprm-private-notes-user">private note text</div>
      <section id="disqus_thread">Reader comment with an address</section>
      <div id="wpadminbar">Signed-in user display name</div>
      <div contenteditable>draft text</div>
      <script>page state token</script>
      <iframe src="https://example.com/private-frame"></iframe>
      <!--comment-token-->
    </article>`,
    '<title>Cookbook reader@example.com</title><meta name="csrf-token" content="csrf-token-value">',
  );
  expect(page.title).toBe("Cookbook [email removed]");
  expect(page.html.querySelector("article p").textContent).toContain("Keep the ingredient list.");
  expect(page.html.querySelector("a").hasAttribute("href")).toBe(false);
  for (const removed of [
    "reader@example.com",
    "author@example.com",
    "+15551234567",
    "opaque-token",
    "event-token",
    "hidden-token",
    "Account form",
    "hidden profile",
    "hidden accessibility block",
    "inline hidden profile",
    "private note text",
    "Reader comment with an address",
    "Signed-in user display name",
    "draft text",
    "page state token",
    "private-frame",
    "comment-token",
    "csrf-token-value",
  ]) {
    expect(page.pageContent).not.toContain(removed);
  }
  expect(document.querySelector("input").value).toBe("hidden-token");
  expect(document.querySelector("article").getAttribute("onclick")).toBe("event-token");
});

test("keeps cleaned recipe metadata alongside the full page structure", () => {
  const recipe = {
    "@type": "Recipe",
    name: "Lemon Cake",
    recipeIngredient: ["2 lemons"],
    recipeInstructions: ["Bake for 30 minutes."],
    author: { name: "Chef Ana", email: "ana@example.com" },
    review: { reviewBody: "Private detail" },
  };
  const page = prepare(
    `<div>Keep this recipe text too.</div><script type="application/ld+json">${JSON.stringify({
      "@graph": [recipe, { "@type": "Person", email: "person@example.com" }],
    })}</script>`,
  );
  const structured = JSON.parse(
    page.html.querySelector("script[type='application/ld+json']").textContent,
  );
  expect(structured).toMatchObject({
    name: "Lemon Cake",
    recipeIngredient: ["2 lemons"],
    author: [{ name: "Chef Ana" }],
  });
  expect(page.pageContent).toContain("Keep this recipe text too.");
  expect(page.pageContent).not.toContain("ana@example.com");
  expect(page.pageContent).not.toContain("person@example.com");
  expect(page.pageContent).not.toContain("Private detail");
});

test("uses a same-site canonical recipe URL without arbitrary query parameters", () => {
  const page = prepare(
    "<p>Recipe text</p>",
    '<link rel="canonical" href="https://www.example.com/cake?p=123&session=private#top">',
  );
  expect(page.pageUrl).toBe("https://www.example.com/cake?p=123");
  expect(page.pageContent).not.toContain("session=private");
  const external = prepare(
    "<p>Recipe text</p>",
    '<link rel="canonical" href="https://other.example/">',
  );
  expect(external.pageUrl).toBe("https://example.com/r?id=42");
});
