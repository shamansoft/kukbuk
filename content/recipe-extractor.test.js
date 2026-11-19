/**
 * @jest-environment jsdom
 */

const { extractRecipe, cleanUrl, pagePermalink, sanitizeRecipe } = require("./recipe-extractor.js");

const PAGE = new URL("https://www.example.com/recipes/pasta?utm_source=x&session=abc#comments");

function load(html, { head = "" } = {}) {
  document.head.innerHTML = head;
  document.body.innerHTML = html;
  return extractRecipe(document, PAGE);
}

function jsonLd(value) {
  // Pages escape "<" in JSON-LD the same way; a literal "</script>" would end the element.
  const json = JSON.stringify(value).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

function embeddedJsonLd(pageContent) {
  const doc = new DOMParser().parseFromString(pageContent, "text/html");
  const script = doc.querySelector('script[type="application/ld+json"]');
  return script ? JSON.parse(script.textContent) : null;
}

const PASTA = {
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Weeknight Pasta",
  description: "Quick <b>pasta</b>.",
  recipeIngredient: ["200 g spaghetti", "2 cloves garlic"],
  recipeInstructions: [
    { "@type": "HowToStep", text: "Boil pasta.", url: "https://example.com/#step1" },
    { "@type": "HowToStep", text: "Add garlic." },
  ],
  recipeYield: "2",
  totalTime: "PT20M",
  author: { "@type": "Person", name: "Chef Ana", email: "ana@example.com" },
  image: ["https://cdn.example.com/p.jpg?w=800&utm_campaign=x"],
  review: [{ "@type": "Review", author: "Reader Bob", reviewBody: "My phone is 555-0100" }],
  aggregateRating: { ratingValue: "4.9", ratingCount: "120" },
  interactionStatistic: { userInteractionCount: 5 },
  video: { contentUrl: "https://video.example.com/v.mp4" },
};

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.title = "";
});

describe("JSON-LD recipes", () => {
  test("extracts a Recipe node and keeps only recipe fields", () => {
    document.title = "Weeknight Pasta | Example Kitchen";
    const result = load(`<main><p>Long life story</p>${jsonLd(PASTA)}</main>`);

    expect(result.source).toBe("json-ld");
    expect(result.title).toBe("Weeknight Pasta");
    const recipe = embeddedJsonLd(result.pageContent);
    expect(recipe).toEqual({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Weeknight Pasta",
      description: "Quick pasta .",
      recipeIngredient: ["200 g spaghetti", "2 cloves garlic"],
      recipeInstructions: [
        { "@type": "HowToStep", text: "Boil pasta." },
        { "@type": "HowToStep", text: "Add garlic." },
      ],
      recipeYield: "2",
      totalTime: "PT20M",
      author: [{ name: "Chef Ana" }],
      image: ["https://cdn.example.com/p.jpg?w=800"],
    });
  });

  test("drops reviews, ratings, emails and the rest of the page", () => {
    const result = load(
      `<p>Long life story</p><form><input type="hidden" name="csrf" value="tok-123"></form>` +
        jsonLd(PASTA),
    );
    for (const leaked of [
      "Long life story",
      "tok-123",
      "Reader Bob",
      "555-0100",
      "ana@example.com",
      "ratingValue",
      "video.example.com",
    ]) {
      expect(result.pageContent).not.toContain(leaked);
    }
  });

  test("finds recipes in @graph, arrays and mainEntity, with schema.org type URLs", () => {
    const graph = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "Page" },
        { "@type": "Article", mainEntity: { ...PASTA, "@type": ["http://schema.org/Recipe"] } },
      ],
    };
    const result = load(jsonLd([{ "@type": "Organization" }, graph]));
    expect(embeddedJsonLd(result.pageContent).name).toBe("Weeknight Pasta");
  });

  test("keeps HowToSection structure", () => {
    const sectioned = {
      ...PASTA,
      recipeInstructions: [
        {
          "@type": "HowToSection",
          name: "Sauce",
          itemListElement: [{ "@type": "HowToStep", text: "Simmer." }],
        },
      ],
    };
    const recipe = embeddedJsonLd(load(jsonLd(sectioned)).pageContent);
    expect(recipe.recipeInstructions).toEqual([
      {
        "@type": "HowToSection",
        name: "Sauce",
        itemListElement: [{ "@type": "HowToStep", text: "Simmer." }],
      },
    ]);
  });

  test("tolerates raw control characters and skips invalid JSON-LD blocks", () => {
    const raw = JSON.stringify(PASTA).replace("Boil pasta.", "Boil\npasta.");
    const result = load(
      `<script type="application/ld+json">{not json</script>` +
        `<script type="application/ld+json">${raw.replace("\\n", "\n")}</script>`,
    );
    expect(embeddedJsonLd(result.pageContent).recipeInstructions[0].text).toBe("Boil pasta.");
  });

  test("escapes recipe text so it cannot close the script element", () => {
    const result = load(
      jsonLd({ ...PASTA, recipeIngredient: ["</script><img src=x onerror=alert(1)>"] }),
    );
    expect(result.pageContent).not.toContain("<img");
    expect(result.pageContent.match(/<\/script>/g)).toHaveLength(1);
  });

  test("ignores Recipe nodes without ingredients or instructions", () => {
    expect(load(jsonLd({ "@type": "Recipe", name: "Teaser" }))).toBeNull();
  });
});

describe("false positives: nothing is extracted", () => {
  test("article page with non-recipe JSON-LD", () => {
    document.title = "Best recipes of 2026";
    expect(
      load(
        `<article><h1>Best recipe ideas</h1><p>ingredients and instructions</p></article>` +
          jsonLd({ "@type": "Article", headline: "Recipe roundup" }),
      ),
    ).toBeNull();
  });

  test("RecipeCollection itemtype and recipe-ish class names", () => {
    expect(
      load(
        `<div itemscope itemtype="https://schema.org/RecipeCollection">
           <span itemprop="name">Dinners</span>
           <span itemprop="recipeIngredient">salt</span>
         </div>
         <div class="recipe-card ingredients">Sign up for our recipe newsletter</div>`,
      ),
    ).toBeNull();
  });

  test("recipe plugin container without visible ingredients", () => {
    expect(
      load(
        `<div class="wprm-recipe-container"><h2 class="wprm-recipe-name">Jump to recipe</h2>
           <ul class="wprm-recipe-ingredients" style="display:none">
             <li class="wprm-recipe-ingredient">x</li>
           </ul>
         </div>`,
      ),
    ).toBeNull();
  });

  test("hidden recipe card", () => {
    expect(
      load(
        `<div class="tasty-recipes" hidden>
           <div class="tasty-recipes-ingredients">flour</div>
         </div>`,
      ),
    ).toBeNull();
  });

  test("plain page with no recipe markup", () => {
    document.title = "Inbox (3)";
    expect(
      load(`<main><p>Your messages</p><input type="email" value="me@x.com"></main>`),
    ).toBeNull();
  });
});

describe("microdata recipes", () => {
  const MICRODATA = `
    <div itemscope itemtype="https://schema.org/Recipe">
      <h1 itemprop="name">Lemon Cake</h1>
      <meta itemprop="prepTime" content="PT15M">
      <img itemprop="image" src="/img/cake.jpg?fbclid=abc">
      <ul>
        <li itemprop="recipeIngredient">2 lemons</li>
        <li itemprop="recipeIngredient">1 cup <a href="/sugar">sugar</a></li>
        <li itemprop="recipeIngredient" style="display:none">secret affiliate token</li>
      </ul>
      <div itemprop="recipeInstructions" itemscope itemtype="https://schema.org/HowToStep">
        <span itemprop="text">Bake 30 minutes.</span>
      </div>
      <div itemprop="review" itemscope itemtype="https://schema.org/Review">
        <span itemprop="author">Reader Bob</span><span itemprop="reviewBody">Great!</span>
      </div>
      <form><input type="hidden" itemprop="recipeIngredient" value="csrf-999"></form>
    </div>`;

  test("reads visible itemprops and drops hidden fields, form controls and reviews", () => {
    const result = load(MICRODATA);
    expect(result.source).toBe("microdata");
    const recipe = embeddedJsonLd(result.pageContent);
    expect(recipe).toMatchObject({
      name: "Lemon Cake",
      prepTime: "PT15M",
      image: ["https://www.example.com/img/cake.jpg"],
      recipeIngredient: ["2 lemons", "1 cup sugar"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Bake 30 minutes." }],
    });
    expect(result.pageContent).not.toContain("secret affiliate token");
    expect(result.pageContent).not.toContain("csrf-999");
    expect(result.pageContent).not.toContain("Reader Bob");
  });
});

describe("recipe card markup", () => {
  const WPRM = `
    <p>Unrelated blog text about my family</p>
    <div class="wprm-recipe-container" data-user="u-42">
      <h2 class="wprm-recipe-name">Tomato Soup</h2>
      <a class="wprm-recipe-print" href="/print">Print</a>
      <div class="wprm-recipe-rating">★★★★★ 120 votes</div>
      <div class="wprm-recipe-ingredients-container">
        <h3 class="wprm-recipe-group-name">Soup</h3>
        <ul class="wprm-recipe-ingredients">
          <li class="wprm-recipe-ingredient"><span>4</span> <span>tomatoes</span></li>
          <li class="wprm-recipe-ingredient" aria-hidden="true">hidden-dup</li>
        </ul>
      </div>
      <div class="wprm-recipe-instructions-container">
        <ol><li class="wprm-recipe-instruction">Simmer <em>20</em> min.</li></ol>
      </div>
      <span class="wprm-screen-reader-text">Screen reader duplicate</span>
      <div class="wprm-recipe-notes" style="visibility:hidden">private note</div>
      <form class="wprm-user-rating"><input name="email" value="me@example.com"></form>
      <div class="wprm-comments">Comment by Reader Bob</div>
      <script>var token = "abc";</script>
      <img src="https://tracker.example.com/p.gif">
    </div>
    <div class="comments">Comment by Reader Carol</div>`;

  test("sends only the visible recipe card as plain structure", () => {
    document.title = "Tomato Soup - Blog";
    const result = load(WPRM);
    expect(result.source).toBe("wprm");
    expect(result.title).toBe("Tomato Soup");
    const doc = new DOMParser().parseFromString(result.pageContent, "text/html");
    expect(doc.querySelector('script[type="application/ld+json"]')).toBeNull();
    const card = doc.querySelector('article[data-source="wprm"]');
    expect(card.querySelector(".wprm-recipe-group-name").textContent).toBe("Soup");
    expect(card.querySelector(".wprm-recipe-ingredient").textContent).toBe("4 tomatoes");
    expect(card.textContent).toContain("Simmer 20 min.");
    for (const leaked of [
      "Unrelated blog text",
      "u-42",
      "Print",
      "120 votes",
      "hidden-dup",
      "Screen reader duplicate",
      "private note",
      "me@example.com",
      "Reader Bob",
      "Reader Carol",
      "token",
      "tracker.example.com",
      "href",
      "<span",
      "<em",
    ]) {
      expect(result.pageContent).not.toContain(leaked);
    }
  });

  test("includes the card alongside JSON-LD so ingredient groups survive", () => {
    const result = load(jsonLd(PASTA) + WPRM);
    expect(result.source).toBe("json-ld");
    expect(embeddedJsonLd(result.pageContent).name).toBe("Weeknight Pasta");
    expect(result.pageContent).toContain('<article data-source="wprm">');
  });

  test.each([
    [
      "tasty-recipes",
      `<div class="tasty-recipes"><h2 class="tasty-recipes-title">Bread</h2>
         <div class="tasty-recipes-ingredients"><ul><li>flour</li></ul></div></div>`,
    ],
    [
      "mv-create",
      `<div class="mv-create-card"><h2 class="mv-create-title">Bread</h2>
         <div class="mv-create-ingredients"><ul><li>flour</li></ul></div></div>`,
    ],
    [
      "h-recipe",
      `<div class="h-recipe"><h2 class="p-name">Bread</h2>
         <ul><li class="p-ingredient">flour</li></ul></div>`,
    ],
  ])("recognizes %s cards", (source, html) => {
    const result = load(html);
    expect(result.source).toBe(source);
    expect(result.title).toBe("Bread");
    expect(result.pageContent).toContain("flour");
  });
});

describe("URLs", () => {
  test("uses the current address without query, fragment or credentials", () => {
    const location = new URL("https://user:pw@example.com/r/1?session=abc&utm_source=x#top");
    expect(pagePermalink(document, location)).toBe("https://example.com/r/1");
  });

  test("prefers a same-site canonical URL, minus tracking parameters", () => {
    const href = "https://example.com/recipes/pasta?id=7&utm_medium=email&fbclid=1#x";
    document.head.innerHTML = `<link rel="canonical" href="${href}">`;
    expect(pagePermalink(document, PAGE)).toBe("https://example.com/recipes/pasta?id=7");
  });

  test("ignores a cross-site or non-http canonical URL", () => {
    document.head.innerHTML = '<link rel="canonical" href="https://evil.test/collect">';
    expect(pagePermalink(document, PAGE)).toBe("https://www.example.com/recipes/pasta");
    document.head.innerHTML = '<link rel="canonical" href="javascript:alert(1)">';
    expect(pagePermalink(document, PAGE)).toBe("https://www.example.com/recipes/pasta");
  });

  test("extractRecipe reports the cleaned URL", () => {
    expect(load(jsonLd(PASTA)).pageUrl).toBe("https://www.example.com/recipes/pasta");
  });

  test("cleanUrl rejects non-http schemes", () => {
    expect(cleanUrl("data:image/png;base64,AAAA")).toBeNull();
    expect(cleanUrl("file:///etc/passwd")).toBeNull();
  });
});

describe("sanitizeRecipe limits", () => {
  test("caps long strings and long lists", () => {
    const recipe = sanitizeRecipe({
      "@type": "Recipe",
      name: "x".repeat(5000),
      recipeIngredient: Array.from({ length: 500 }, (_, i) => `item ${i}`),
    });
    expect(recipe.name).toHaveLength(2000);
    expect(recipe.recipeIngredient).toHaveLength(200);
  });
});
