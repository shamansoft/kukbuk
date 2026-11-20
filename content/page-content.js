// Prepares a cleaned copy of the selected page. The backend decides whether it contains a recipe.
(function (root) {
  const EMAIL = /\b[A-Z0-9._%+-]{1,64}@[A-Z0-9-]{1,63}(?:\.[A-Z0-9-]{1,63}){0,8}\.[A-Z]{2,24}\b/gi;
  const RECIPE_ID_PARAM = /^(?:id|p|recipe[_-]?id)$/i;
  const PRIVATE_BLOCK = /(?:^|[\s_-])(?:private[-_]notes|user[-_]notes|notes[-_]user)(?=$|[\s_-])/i;

  // Forms, buttons and modal backdrops can contain the recipe text itself.
  const REMOVE_ELEMENTS = [
    "script",
    "style",
    "noscript",
    "template",
    "iframe",
    "frame",
    "object",
    "embed",
    "svg",
    "canvas",
    "input",
    "textarea",
    "select",
    "option",
    "output",
    "dialog:not([open])",
    "base",
    '[hidden]:not([hidden="until-found" i])',
    '[contenteditable]:not([contenteditable="false"])',
    "#comments",
    "#disqus_thread",
    ".comments-area",
    ".comment-list",
    ".commentlist",
    '[itemprop~="comment"]',
    '[itemprop~="review"]',
    "#wpadminbar",
    "#save-a-recipe-light-bubble-container",
  ].join(", ");

  const STRUCTURAL_ATTRIBUTES = new Set([
    "class",
    "id",
    "lang",
    "dir",
    "title",
    "alt",
    "colspan",
    "rowspan",
    "datetime",
    "itemprop",
    "itemscope",
    "itemtype",
    "itemref",
    "rel",
    "width",
    "height",
  ]);
  const PAGE_METADATA = new Set([
    "title",
    "description",
    "author",
    "keywords",
    "og:title",
    "og:description",
    "og:image",
    "og:url",
    "og:type",
    "twitter:title",
    "twitter:description",
    "twitter:image",
  ]);

  const MAX_TEXT_LENGTH = 2000;
  const MAX_LIST_ITEMS = 200;
  const MAX_IMAGES = 5;
  const MAX_DEPTH = 8;

  const TEXT_FIELDS = [
    "name",
    "description",
    "recipeYield",
    "prepTime",
    "cookTime",
    "totalTime",
    "performTime",
    "recipeCategory",
    "recipeCuisine",
    "keywords",
    "suitableForDiet",
    "cookingMethod",
  ];

  const NUTRITION_FIELDS = [
    "calories",
    "carbohydrateContent",
    "cholesterolContent",
    "fatContent",
    "fiberContent",
    "proteinContent",
    "saturatedFatContent",
    "servingSize",
    "sodiumContent",
    "sugarContent",
    "transFatContent",
    "unsaturatedFatContent",
  ];

  function cleanText(value) {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value !== "string") return "";
    const text = value
      .replace(/<[^>]*>/g, " ")
      .replace(EMAIL, "[email removed]")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
  }

  function toArray(value) {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
  }

  /** Strings from a value that may be a string, number, {name|text} object, or a list of those. */
  function textList(value, limit = MAX_LIST_ITEMS) {
    const out = [];
    for (const item of toArray(value)) {
      if (out.length >= limit) break;
      const text =
        item && typeof item === "object"
          ? toArray(item.name ?? item.text)
              .map(cleanText)
              .find(Boolean)
          : cleanText(item);
      if (text) out.push(text);
    }
    return out;
  }

  function firstText(value) {
    return textList(value, 1)[0] || "";
  }

  function parsePageUrl(raw, base) {
    if (typeof raw !== "string" || !raw.trim()) return null;
    try {
      const url = new URL(raw.trim(), base);
      if (!["http:", "https:"].includes(url.protocol)) return null;
      url.username = "";
      url.password = "";
      url.hash = "";
      return url;
    } catch {
      return null;
    }
  }

  function cleanResourceUrl(raw, base) {
    const url = parsePageUrl(raw, base);
    if (!url) return null;
    url.search = "";
    return url.href;
  }

  function siteHost(hostname) {
    return hostname.toLowerCase().replace(/^www\./, "");
  }

  function sameSite(a, b) {
    const x = siteHost(a);
    const y = siteHost(b);
    return x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`);
  }

  function cleanRecipeUrl(raw, base) {
    const url = parsePageUrl(raw, base);
    if (!url) return null;

    const params = new URLSearchParams(url.search);
    url.search = "";
    for (const [key, value] of params) {
      if (RECIPE_ID_PARAM.test(key) && /^\d{1,12}$/.test(value)) {
        url.searchParams.set(key, value);
      }
    }
    return url.href;
  }

  /** Prefers a same-site canonical URL and retains only numeric recipe identifiers. */
  function pagePermalink(doc, location, base) {
    const href = location.href;
    const canonical = doc.querySelector('link[rel~="canonical"][href]');
    if (canonical) {
      const cleaned = cleanRecipeUrl(canonical.getAttribute("href"), base);
      if (cleaned && sameSite(new URL(cleaned).hostname, location.hostname)) return cleaned;
    }
    return cleanRecipeUrl(href);
  }

  function typeNames(type) {
    return toArray(type)
      .filter((t) => typeof t === "string")
      .map((t) => t.replace(/^https?:\/\/schema\.org\//i, "").replace(/^schema:/i, ""));
  }

  function isRecipeType(type) {
    return typeNames(type).includes("Recipe");
  }

  function sanitizeInstructions(value, depth = 0) {
    const out = [];
    for (const item of toArray(value)) {
      if (out.length >= MAX_LIST_ITEMS || depth > 3) break;
      if (!item || typeof item !== "object") {
        const text = cleanText(item);
        if (text) out.push(text);
        continue;
      }
      const types = typeNames(item["@type"]);
      if (types.includes("HowToSection") || types.includes("ItemList")) {
        const steps = sanitizeInstructions(item.itemListElement, depth + 1);
        if (steps.length) {
          const section = { "@type": "HowToSection", itemListElement: steps };
          const name = firstText(item.name);
          if (name) section.name = name;
          out.push(section);
        }
        continue;
      }
      // Microdata yields lists for every property; JSON-LD usually yields plain strings.
      const text = firstText(item.text) || firstText(item.name) || firstText(item.description);
      if (text) out.push({ "@type": "HowToStep", text });
    }
    return out;
  }

  function sanitizeNutrition(value) {
    const source = Array.isArray(value) ? value[0] : value;
    if (!source || typeof source !== "object") return null;
    const out = {};
    for (const key of NUTRITION_FIELDS) {
      const text = firstText(source[key]);
      if (text) out[key] = text;
    }
    return Object.keys(out).length ? { "@type": "NutritionInformation", ...out } : null;
  }

  function sanitizeImages(value, base) {
    const out = [];
    for (const item of toArray(value)) {
      if (out.length >= MAX_IMAGES) break;
      const raw = item && typeof item === "object" ? (item.url ?? item.contentUrl) : item;
      const url = cleanResourceUrl(Array.isArray(raw) ? raw[0] : raw, base);
      if (url && !out.includes(url)) out.push(url);
    }
    return out;
  }

  /**
   * Copies the recipe fields of a schema.org Recipe node into a new object. Reviews, comments,
   * ratings, publisher data, videos and all unknown fields are dropped.
   * @returns {Object|null} Sanitized recipe, or null without a name plus ingredients or steps
   */
  function sanitizeRecipe(node, base) {
    if (!node || typeof node !== "object") return null;
    const recipe = { "@context": "https://schema.org", "@type": "Recipe" };

    for (const field of TEXT_FIELDS) {
      const values = textList(node[field]);
      if (values.length) recipe[field] = values.length === 1 ? values[0] : values;
    }
    if (Array.isArray(recipe.name)) recipe.name = recipe.name[0];

    const ingredients = textList(node.recipeIngredient ?? node.ingredients);
    if (ingredients.length) recipe.recipeIngredient = ingredients;

    const instructions = sanitizeInstructions(node.recipeInstructions);
    if (instructions.length) recipe.recipeInstructions = instructions;

    const nutrition = sanitizeNutrition(node.nutrition);
    if (nutrition) recipe.nutrition = nutrition;

    const images = sanitizeImages(node.image, base);
    if (images.length) recipe.image = images;

    const authors = textList(node.author, 5);
    if (authors.length) recipe.author = authors.map((name) => ({ name }));

    const url = cleanRecipeUrl(firstText(node.url), base);
    if (url) recipe.url = url;

    if (!recipe.name || !(ingredients.length || instructions.length)) return null;
    return recipe;
  }

  function parseJson(text) {
    try {
      return JSON.parse(text);
    } catch {
      // Some pages put raw control characters inside JSON-LD strings.
      try {
        // eslint-disable-next-line no-control-regex
        return JSON.parse(text.replace(/[\u0000-\u001f]+/g, " "));
      } catch {
        return null;
      }
    }
  }

  function collectRecipeNodes(value, out, depth = 0) {
    if (!value || typeof value !== "object" || depth > MAX_DEPTH) return;
    if (Array.isArray(value)) {
      value.forEach((item) => collectRecipeNodes(item, out, depth + 1));
      return;
    }
    if (isRecipeType(value["@type"])) out.push(value);
    for (const key of ["@graph", "mainEntity"]) collectRecipeNodes(value[key], out, depth + 1);
  }

  function appendRecipeMetadata(doc, copy, base) {
    for (const script of doc.querySelectorAll('script[type="application/ld+json" i]')) {
      const nodes = [];
      collectRecipeNodes(parseJson(script.textContent || ""), nodes);
      for (const node of nodes) {
        const recipe = sanitizeRecipe(node, base);
        if (!recipe) continue;
        const metadata = copy.createElement("script");
        metadata.type = "application/ld+json";
        // Keep structured recipe data and escape markup inside JSON script data.
        metadata.textContent = JSON.stringify(recipe).replace(/</g, "\\u003c");
        copy.head.append(metadata);
      }
    }
  }

  function keepMetadata(el) {
    if (el.hasAttribute("charset")) return true;
    const key = (el.getAttribute("name") || el.getAttribute("property") || "").toLowerCase();
    if (PAGE_METADATA.has(key)) return true;
    const itemprop = el.getAttribute("itemprop") || "";
    return itemprop
      .split(/\s+/)
      .some(
        (name) =>
          TEXT_FIELDS.includes(name) ||
          NUTRITION_FIELDS.includes(name) ||
          [
            "url",
            "image",
            "contentUrl",
            "recipeIngredient",
            "ingredients",
            "recipeInstructions",
            "text",
          ].includes(name),
      );
  }

  function cleanAttributes(el, base) {
    const tag = el.localName;
    for (const { name, value } of Array.from(el.attributes)) {
      if (name === "href" || name === "src" || (tag === "img" && name === "data-src")) {
        const url = name === "href" ? cleanRecipeUrl(value, base) : cleanResourceUrl(value, base);
        if (url) el.setAttribute(name, url);
        else el.removeAttribute(name);
      } else if (
        STRUCTURAL_ATTRIBUTES.has(name) ||
        (tag === "meta" && ["name", "property", "charset", "content"].includes(name)) ||
        (["data", "meter"].includes(tag) && name === "value")
      ) {
        let cleaned = value.replace(EMAIL, "[email removed]");
        if (tag === "meta" && name === "content") {
          const key =
            el.getAttribute("property") || el.getAttribute("name") || el.getAttribute("itemprop");
          if (/^(?:og:url|og:image|twitter:image|url|image|contentUrl)$/i.test(key || "")) {
            cleaned = cleanResourceUrl(value, base) || "";
          }
        }
        el.setAttribute(name, cleaned);
      } else {
        el.removeAttribute(name);
      }
    }
  }

  function preparePage(doc, location) {
    const baseHref = doc.querySelector("base[href]")?.getAttribute("href");
    const base = parsePageUrl(baseHref, location.href)?.href ?? location.href;
    const pageUrl = pagePermalink(doc, location, base);
    if (!pageUrl) throw new Error("Couldn't read page");

    const copy = doc.cloneNode(true);
    for (const el of copy.querySelectorAll(REMOVE_ELEMENTS)) el.remove();
    for (const el of copy.querySelectorAll("*")) {
      if (
        el.style?.display === "none" ||
        ["hidden", "collapse"].includes(el.style?.visibility) ||
        PRIVATE_BLOCK.test(`${el.id} ${el.getAttribute("class") || ""}`) ||
        (el.localName === "meta" && !keepMetadata(el)) ||
        (el.localName === "link" && !el.relList.contains("canonical"))
      ) {
        el.remove();
        continue;
      }
      if (copy.documentElement.contains(el)) cleanAttributes(el, base);
    }

    const walker = copy.createTreeWalker(
      copy.documentElement,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
    );
    const comments = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.COMMENT_NODE) comments.push(node);
      else node.nodeValue = node.nodeValue.replace(EMAIL, "[email removed]");
    }
    comments.forEach((comment) => comment.remove());
    appendRecipeMetadata(doc, copy, base);

    return { pageContent: copy.documentElement.outerHTML, pageUrl, title: copy.title };
  }

  root.SarPageContent = { preparePage };
  if (typeof module !== "undefined" && module.exports) module.exports = { preparePage };
})(globalThis);
