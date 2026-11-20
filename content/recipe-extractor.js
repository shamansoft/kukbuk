// Privacy-scoped recipe extraction for Save-A-Recipe.
//
// Injected on demand (activeTab) together with content.js. It reads only recipe data the page
// publishes: schema.org Recipe JSON-LD, schema.org Recipe microdata, and the visible text of
// common recipe-card markup (WP Recipe Maker, Tasty Recipes, Mediavine Create, h-recipe).
// It never returns the page's raw HTML. When no recipe is found it returns null and nothing
// is uploaded.
//
// Classic script (content scripts cannot be ES modules); exposes globalThis.SarRecipeExtractor
// and, under Jest, module.exports.

(function (root) {
  const MAX_TEXT_LENGTH = 2000;
  const MAX_LIST_ITEMS = 200;
  const MAX_IMAGES = 5;
  const MAX_CARD_CHARS = 100000;
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

  // Query parameters that only track the visitor; removed from every URL that leaves the page.
  const TRACKING_PARAM = new RegExp(
    "^(" +
      ["utm_.*", "mc_.*", "hsa_.*", "_hs.*", "pk_.*", "mtm_.*", "fbclid", "gclid", "gclsrc"]
        .concat(["dclid", "gbraid", "wbraid", "msclkid", "yclid", "igshid", "twclid", "ttclid"])
        .concat(["li_fat_id", "mkt_tok", "_ga", "_gl", "ref", "ref_src", "ref_url", "s_cid"])
        .concat(["cmpid", "spm", "si"])
        .join("|") +
      ")$",
    "i",
  );

  const RECIPE_ID_PARAM = /^(?:id|p|recipe[_-]?id)$/i;

  // Elements whose content is never read.
  const DROPPED_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEMPLATE",
    "IFRAME",
    "FRAME",
    "OBJECT",
    "EMBED",
    "SVG",
    "CANVAS",
    "VIDEO",
    "AUDIO",
    "IMG",
    "PICTURE",
    "FORM",
    "INPUT",
    "TEXTAREA",
    "SELECT",
    "OPTION",
    "BUTTON",
    "DIALOG",
    "NAV",
    "ASIDE",
    "FOOTER",
  ]);

  // Class/id tokens that mark non-recipe parts of a card: comments, ratings, sharing, ads,
  // sign-up forms, and screen-reader-only duplicates.
  const NOISE_TOKEN = new RegExp(
    "(^|[-_])(" +
      ["comments?", "ratings?", "reviews?", "share", "sharing", "social", "newsletter"]
        .concat(["subscribe", "signup", "advert", "ads?", "sponsored", "promo", "print", "jump"])
        .concat(["video", "screen-reader-text", "sr-only", "visually-hidden", "private", "user-notes", "notes-user"])
        .join("|") +
      ")([-_]|$)",
    "i",
  );

  const NOISE_ITEMPROP = /^(reviews?|comments?|aggregateRating|interactionStatistic|video)$/i;
  const NOISE_ITEMTYPE =
    /schema\.org\/(Review|Comment|AggregateRating|Rating|UserComments|VideoObject)\b/i;

  // Block elements kept in the recipe card; everything else is unwrapped to its text.
  const KEPT_TAGS = new Set([
    "DIV",
    "SECTION",
    "ARTICLE",
    "HEADER",
    "P",
    "UL",
    "OL",
    "LI",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "TABLE",
    "THEAD",
    "TBODY",
    "TR",
    "TD",
    "TH",
    "BR",
  ]);

  // Class tokens kept on card elements so the backend can find ingredient groups.
  const KEPT_CLASS = /^(wprm-recipe|tasty-recipes|mv-create|[pe]-|h-recipe)/;

  const RECIPE_CARDS = [
    {
      source: "wprm",
      container: ".wprm-recipe-container, .wprm-recipe",
      ingredients: ".wprm-recipe-ingredient, .wprm-recipe-ingredients",
      title: ".wprm-recipe-name",
      sections:
        ".wprm-recipe-ingredients-container, .wprm-recipe-instructions-container, .wprm-recipe-instructions, .wprm-recipe-summary, .wprm-recipe-nutrition-container",
    },
    {
      source: "tasty-recipes",
      container: ".tasty-recipes",
      ingredients: ".tasty-recipes-ingredients, .tasty-recipes-ingredients-body",
      title: ".tasty-recipes-title",
      sections: ".tasty-recipes-instructions, .tasty-recipes-instructions-body, .tasty-recipes-description, .tasty-recipes-nutrition",
    },
    {
      source: "mv-create",
      container: ".mv-create-card",
      ingredients: ".mv-create-ingredients",
      title: ".mv-create-title",
      sections: ".mv-create-instructions, .mv-create-description, .mv-create-nutrition",
    },
    {
      source: "h-recipe",
      container: ".h-recipe",
      ingredients: ".p-ingredient",
      title: ".p-name",
      sections: ".e-instructions, .p-summary, .p-yield, .dt-duration",
    },
  ];

  // ---------------------------------------------------------------------------------------
  // Text and URL helpers
  // ---------------------------------------------------------------------------------------

  function cleanText(value) {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value !== "string") return "";
    const text = value
      .replace(/<[^>]*>/g, " ")
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
          ? toArray(item.name ?? item.text).map(cleanText).find(Boolean)
          : cleanText(item);
      if (text) out.push(text);
    }
    return out;
  }

  function firstText(value) {
    return textList(value, 1)[0] || "";
  }

  /**
   * Returns an http(s) URL without credentials, fragment or tracking parameters, or null.
   * @param {string} raw
   * @param {string} [base]
   * @param {{keepQuery?: boolean}} [options] - keepQuery false drops the whole query string
   */
  function cleanUrl(raw, base, { keepQuery = true } = {}) {
    if (typeof raw !== "string" || !raw.trim()) return null;
    let url;
    try {
      url = new URL(raw.trim(), base);
    } catch (_e) {
      return null;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.username = "";
    url.password = "";
    url.hash = "";
    if (!keepQuery) {
      url.search = "";
    } else {
      for (const key of [...url.searchParams.keys()]) {
        if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
      }
    }
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
    const clean = cleanUrl(raw, base, { keepQuery: false });
    if (!clean) return null;

    const original = new URL(raw, base);
    const url = new URL(clean);
    for (const [key, value] of original.searchParams) {
      if (RECIPE_ID_PARAM.test(key) && /^\d{1,12}$/.test(value)) {
        url.searchParams.set(key, value);
      }
    }
    return url.href;
  }

  /** Prefers a same-site canonical URL and retains only numeric recipe identifiers. */
  function pagePermalink(doc, location) {
    const href = location.href;
    const canonical = doc.querySelector('link[rel~="canonical"][href]');
    if (canonical) {
      const cleaned = cleanRecipeUrl(canonical.getAttribute("href"), href);
      if (cleaned && sameSite(new URL(cleaned).hostname, location.hostname)) return cleaned;
    }
    return cleanRecipeUrl(href);
  }

  // ---------------------------------------------------------------------------------------
  // schema.org Recipe sanitizing (shared by JSON-LD and microdata)
  // ---------------------------------------------------------------------------------------

  function typeNames(type) {
    return toArray(type)
      .filter((t) => typeof t === "string")
      .map((t) => t.replace(/^https?:\/\/schema\.org\//i, "").replace(/^schema:/i, ""));
  }

  function isRecipeType(type) {
    return typeNames(type).includes("Recipe");
  }

  function isRecipeItemtype(itemtype) {
    return (itemtype || "")
      .trim()
      .split(/\s+/)
      .some((t) => /^https?:\/\/schema\.org\/Recipe$/i.test(t));
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
      const url = cleanUrl(Array.isArray(raw) ? raw[0] : raw, base);
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

  // ---------------------------------------------------------------------------------------
  // DOM visibility
  // ---------------------------------------------------------------------------------------

  function hasNoiseToken(el) {
    const tokens = `${el.getAttribute("class") || ""} ${el.id || ""}`.split(/\s+/);
    if (tokens.some((token) => token && NOISE_TOKEN.test(token))) return true;
    // Reader reviews, comments and ratings marked up with microdata.
    const itemprops = (el.getAttribute("itemprop") || "").split(/\s+/);
    if (itemprops.some((prop) => NOISE_ITEMPROP.test(prop))) return true;
    return NOISE_ITEMTYPE.test(el.getAttribute("itemtype") || "");
  }

  function isHidden(el) {
    if (el.hidden || el.getAttribute("aria-hidden") === "true") return true;
    const view = el.ownerDocument.defaultView;
    const style = view && view.getComputedStyle ? view.getComputedStyle(el) : null;
    if (!style) return false;
    return (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      style.contentVisibility === "hidden"
    );
  }

  /** True when the element and its content must not be read. */
  function isSkipped(el) {
    return DROPPED_TAGS.has(el.tagName.toUpperCase()) || isHidden(el) || hasNoiseToken(el);
  }

  function isVisibleTree(el) {
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      if (isHidden(node)) return false;
    }
    return true;
  }

  function visibleText(el) {
    const parts = [];
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) {
          parts.push(child.nodeValue);
        } else if (child.nodeType === 1 && !isSkipped(child)) {
          walk(child);
          if (KEPT_TAGS.has(child.tagName.toUpperCase())) parts.push(" ");
        }
      }
    };
    walk(el);
    return cleanText(parts.join(""));
  }

  // ---------------------------------------------------------------------------------------
  // Sources
  // ---------------------------------------------------------------------------------------

  function parseJson(text) {
    try {
      return JSON.parse(text);
    } catch (_e) {
      // Some pages put raw control characters inside JSON-LD strings.
      try {
        // eslint-disable-next-line no-control-regex
        return JSON.parse(text.replace(/[\u0000-\u001f]+/g, " "));
      } catch (_e2) {
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

  function findJsonLdRecipe(doc, base) {
    for (const script of doc.querySelectorAll("script[type]")) {
      if (script.getAttribute("type").trim().toLowerCase() !== "application/ld+json") continue;
      const nodes = [];
      collectRecipeNodes(parseJson(script.textContent || ""), nodes);
      for (const node of nodes) {
        const recipe = sanitizeRecipe(node, base);
        if (recipe) return recipe;
      }
    }
    return null;
  }

  function microdataValue(el, base) {
    const tag = el.tagName.toUpperCase();
    if (tag === "META") return el.getAttribute("content") || "";
    if (tag === "LINK" || tag === "A" || tag === "AREA") {
      return cleanUrl(el.getAttribute("href"), base) || "";
    }
    if (tag === "IMG" || tag === "SOURCE") return cleanUrl(el.getAttribute("src"), base) || "";
    if (tag === "TIME" && el.hasAttribute("datetime")) return el.getAttribute("datetime");
    if (tag === "DATA" || tag === "METER") return el.getAttribute("value") || "";
    return visibleText(el);
  }

  function readMicrodataItem(scope, base, depth = 0) {
    const item = { "@type": (scope.getAttribute("itemtype") || "").trim().split(/\s+/) };
    const add = (name, value) => {
      if (value === "" || value === null) return;
      item[name] = item[name] === undefined ? [value] : [...item[name], value];
    };
    const visit = (el) => {
      for (const child of el.children) {
        const tag = child.tagName.toUpperCase();
        const names = (child.getAttribute("itemprop") || "").trim().split(/\s+/).filter(Boolean);
        if (tag === "IMG") {
          // Images are dropped from text, but a visible itemprop image URL is recipe data.
          if (!isHidden(child)) names.forEach((name) => add(name, microdataValue(child, base)));
          continue;
        }
        // <meta>/<link> are display:none by default; read them unless a parent is skipped.
        if (tag !== "META" && tag !== "LINK" && isSkipped(child)) continue;
        const nestedScope = child.hasAttribute("itemscope");
        if (names.length) {
          const value = nestedScope
            ? depth < 4
              ? readMicrodataItem(child, base, depth + 1)
              : null
            : microdataValue(child, base);
          names.forEach((name) => add(name, value));
        }
        if (!nestedScope) visit(child);
      }
    };
    visit(scope);
    return item;
  }

  function findMicrodataRecipe(doc, base) {
    for (const scope of doc.querySelectorAll("[itemscope][itemtype]")) {
      if (!isRecipeItemtype(scope.getAttribute("itemtype")) || !isVisibleTree(scope)) continue;
      const recipe = sanitizeRecipe(readMicrodataItem(scope, base), base);
      if (recipe) return recipe;
    }
    return null;
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isReadableSection(el, container) {
    for (let node = el; node !== container; node = node.parentElement) {
      if (isSkipped(node)) return false;
    }
    return true;
  }

  /** Rebuilds only recognized recipe sections with plain structural tags. */
  function sanitizeCard(sections) {
    const render = (node) => {
      if (node.nodeType === 3) return escapeHtml(node.nodeValue.replace(/\s+/g, " "));
      if (node.nodeType !== 1 || isSkipped(node)) return "";
      const tag = node.tagName.toUpperCase();
      if (tag === "BR") return "<br>";

      const inner = Array.from(node.childNodes, render).join("");
      if (!KEPT_TAGS.has(tag)) return inner;
      if (!inner.trim()) return "";

      const classes = (node.getAttribute("class") || "")
        .split(/\s+/)
        .filter((token) => KEPT_CLASS.test(token));
      const name = tag.toLowerCase();
      const attr = classes.length ? ` class="${escapeHtml(classes.join(" "))}"` : "";
      return `<${name}${attr}>${inner.trim()}</${name}>`;
    };
    return sections.map(render).join("");
  }

  function findRecipeCard(doc) {
    for (const card of RECIPE_CARDS) {
      for (const container of doc.querySelectorAll(card.container)) {
        if (!isVisibleTree(container) || hasNoiseToken(container)) continue;
        const hasIngredients = [...container.querySelectorAll(card.ingredients)].some(
          (el) => isReadableSection(el, container) && visibleText(el),
        );
        if (!hasIngredients) continue;

        const selector = [card.title, card.ingredients, card.sections].join(", ");
        const sections = [];
        for (const section of container.querySelectorAll(selector)) {
          if (!isReadableSection(section, container)) continue;
          if (sections.some((parent) => parent.contains(section))) continue;
          sections.push(section);
        }
        const html = sanitizeCard(sections);
        if (!html || html.length > MAX_CARD_CHARS) continue;
        const titleEl = sections.find((section) => section.matches(card.title));
        return { source: card.source, html, title: titleEl ? visibleText(titleEl) : "" };
      }
    }
    return null;
  }

  function buildDocument({ title, recipe, card }) {
    const parts = [
      "<!DOCTYPE html>",
      '<html><head><meta charset="utf-8">',
      `<title>${escapeHtml(title)}</title>`,
      "</head><body>",
    ];
    if (recipe) {
      // Escape "<" so recipe text can never close the script element.
      const json = JSON.stringify(recipe).replace(/</g, "\\u003c");
      parts.push(`<script type="application/ld+json">${json}</script>`);
    }
    if (card) parts.push(`<article data-source="${card.source}">${card.html}</article>`);
    parts.push("</body></html>");
    return parts.join("");
  }

  /**
   * Extracts the recipe on the page.
   * @param {Document} doc
   * @param {Location|URL} location - Address of the page
   * @returns {{pageContent: string, pageUrl: string, title: string, source: string}|null}
   *   Minimal HTML holding only recipe data, or null when the page has no recognizable recipe.
   */
  function extractRecipe(doc, location) {
    const base = location.href;
    const jsonLd = findJsonLdRecipe(doc, base);
    const recipe = jsonLd || findMicrodataRecipe(doc, base);
    const card = findRecipeCard(doc);
    if (!recipe && !card) return null;

    const pageUrl = pagePermalink(doc, location);
    const title = cleanText(recipe?.name || card?.title || doc.title || "");
    const source = jsonLd ? "json-ld" : recipe ? "microdata" : card.source;
    return { pageContent: buildDocument({ title, recipe, card }), pageUrl, title, source };
  }

  const api = { extractRecipe, cleanUrl, pagePermalink, sanitizeRecipe };
  root.SarRecipeExtractor = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
