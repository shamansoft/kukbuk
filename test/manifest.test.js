/**
 * Build-artifact test: verifies manifest.json contains the required identity/oauth2 fields.
 * Generate the Chrome manifest before running these tests.
 */

const fs = require("fs");
const path = require("path");
const { createFirefoxManifest } = require("../scripts/substitute-env");
const manifestTemplate = require("../templates/manifest.template.json");

describe("manifest.json", () => {
  let manifest;

  beforeAll(() => {
    const manifestPath = path.resolve(__dirname, "../manifest.json");
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  });

  it("includes identity permission", () => {
    expect(manifest.permissions).toContain("identity");
  });

  it("does not include notifications permission (OS notifications removed)", () => {
    expect(manifest.permissions).not.toContain("notifications");
  });

  it("has oauth2 block with client_id and required scopes", () => {
    expect(manifest.oauth2).toBeDefined();
    expect(manifest.oauth2.client_id).toMatch(/\.apps\.googleusercontent\.com$/);
    expect(manifest.oauth2.scopes).toEqual(["openid", "email", "profile"]);
  });
});

describe("Firefox manifest", () => {
  it("uses a background script and supports OAuth without Chrome-only manifest fields", () => {
    const manifest = createFirefoxManifest(manifestTemplate);

    expect(manifest.background).toEqual({ scripts: [manifestTemplate.background.service_worker] });
    expect(manifest.permissions).toContain("identity");
    expect(manifest.permissions).not.toContain("offscreen");
    expect(manifest.oauth2).toBeUndefined();
    expect(manifest.browser_specific_settings.gecko).toMatchObject({
      id: "save-a-recipe@mykukbuk.com",
      strict_min_version: "140.0",
      data_collection_permissions: {
        required: expect.arrayContaining([
          "authenticationInfo",
          "browsingActivity",
          "websiteContent",
        ]),
      },
    });
    expect(manifestTemplate.background.service_worker).toBeDefined();
    expect(manifestTemplate.oauth2).toBeDefined();
  });

  it("allows an explicit Firefox extension ID", () => {
    const manifest = createFirefoxManifest(manifestTemplate, "test@example.com");
    expect(manifest.browser_specific_settings.gecko.id).toBe("test@example.com");
  });
});

describe("options.html structure", () => {
  let optionsHtml;

  beforeAll(() => {
    optionsHtml = fs.readFileSync(path.resolve(__dirname, "../options/options.html"), "utf8");
  });

  it("contains account section", () => {
    expect(optionsHtml).toMatch(/id="account-section"/);
  });

  it("contains about section", () => {
    expect(optionsHtml).toMatch(/id="about-section"/);
  });

  it("does not contain notifications section (removed in redesign)", () => {
    expect(optionsHtml).not.toMatch(/id="notifications-section"/);
  });

  it("does not contain toggle-switch elements", () => {
    expect(optionsHtml).not.toMatch(/class="toggle-switch"/);
  });
});

describe("recipe-creator.html structure", () => {
  let html;

  beforeAll(() => {
    html = fs.readFileSync(
      path.resolve(__dirname, "../recipe-creator/recipe-creator.html"),
      "utf8",
    );
  });

  it("contains form section", () => {
    expect(html).toMatch(/id="form-section"/);
  });

  it("contains result section", () => {
    expect(html).toMatch(/id="result-section"/);
  });

  it("does not contain minimal-status-icon (removed in redesign)", () => {
    expect(html).not.toMatch(/minimal-status-icon/);
  });

  it("contains result-dot element", () => {
    expect(html).toMatch(/class="result-dot"/);
  });

  it("contains drive link with Open recipe text", () => {
    expect(html).toMatch(/Open recipe/);
  });
});

describe("HTML pages reference common/theme.css", () => {
  const pages = [
    ["popup/popup.html", "../popup/popup.html"],
    ["options/options.html", "../options/options.html"],
    ["recipe-creator/recipe-creator.html", "../recipe-creator/recipe-creator.html"],
  ];

  it.each(pages)("%s links common/theme.css before page stylesheet", (label, relPath) => {
    const html = fs.readFileSync(path.resolve(__dirname, relPath), "utf8");
    expect(html).toMatch(/href="[^"]*common\/theme\.css"/);
    // theme.css must appear before the page-specific stylesheet
    const themeIdx = html.indexOf("common/theme.css");
    const pageIdx = Math.max(
      html.indexOf("popup.css"),
      html.indexOf("options.css"),
      html.indexOf("recipe-creator.css"),
    );
    expect(themeIdx).toBeLessThan(pageIdx);
  });
});
