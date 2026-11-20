const fs = require("fs");
const path = require("path");
const {
  createBuildConfig,
  createFirefoxManifest,
  resolveNetworkPolicy,
  applyNetworkPolicy,
} = require("../scripts/substitute-env");
const manifestTemplate = require("../templates/manifest.template.json");

describe("manifest.json", () => {
  let manifest;

  beforeAll(() => {
    ({ manifest } = createBuildConfig(["--env=test/fixtures/public-build.json"]));
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

describe("least-privilege permissions", () => {
  const PROD_ENV = {
    API_BASE_URL: "https://api.example.test",
    FIREBASE_AUTH_DOMAIN: "example-test.firebaseapp.com",
  };
  const build = (env) => applyNetworkPolicy(manifestTemplate, resolveNetworkPolicy(env));
  const csp = (manifest) => manifest.content_security_policy.extension_pages;

  it("has no tabs permission and no static content scripts", () => {
    expect(manifestTemplate.permissions).not.toContain("tabs");
    expect(manifestTemplate.permissions).toEqual(
      expect.arrayContaining(["activeTab", "scripting"]),
    );
    expect(manifestTemplate.content_scripts).toBeUndefined();
  });

  it("limits a production build to the configured backend and auth hosts", () => {
    const manifest = build(PROD_ENV);
    expect(manifest.host_permissions).toEqual(["https://api.example.test/*"]);
    expect(csp(manifest)).toContain("connect-src 'self' https://api.example.test ");
    expect(csp(manifest)).toContain("frame-src https://example-test.firebaseapp.com;");
    expect(JSON.stringify(manifest)).not.toMatch(
      /\*\.run\.app|localhost|127\.0\.0\.1|https:\/\/\*\//,
    );
    expect(JSON.stringify(manifest)).not.toMatch(/\$\{(API_|FIREBASE_AUTH_ORIGIN)/);
  });

  it("adds local development hosts only for a loopback API_BASE_URL", () => {
    const manifest = build({ ...PROD_ENV, API_BASE_URL: "http://localhost:8080" });
    expect(manifest.host_permissions).toEqual(["http://localhost/*", "http://127.0.0.1/*"]);
    expect(csp(manifest)).toContain(
      "connect-src 'self' http://localhost:* http://127.0.0.1:* http://localhost:8080 ",
    );
    expect(csp(manifest)).toContain("frame-src http://localhost:* http://127.0.0.1:* https://");
  });

  it("drops the port from the host permission match pattern", () => {
    expect(
      build({ ...PROD_ENV, API_BASE_URL: "https://api.example.test:8443/v" }).host_permissions,
    ).toEqual(["https://api.example.test/*"]);
  });

  it.each([
    [{ FIREBASE_AUTH_DOMAIN: "a.firebaseapp.com" }, /API_BASE_URL is required/],
    [{ ...PROD_ENV, API_BASE_URL: "not a url" }, /not a valid URL/],
    [{ ...PROD_ENV, API_BASE_URL: "http://api.example.test" }, /must use https/],
    [{ ...PROD_ENV, FIREBASE_AUTH_DOMAIN: "" }, /FIREBASE_AUTH_DOMAIN/],
    [{ ...PROD_ENV, FIREBASE_AUTH_DOMAIN: "*.firebaseapp.com" }, /FIREBASE_AUTH_DOMAIN/],
  ])("refuses to build without a narrow host (%#)", (env, message) => {
    expect(() => resolveNetworkPolicy(env)).toThrow(message);
  });

  it("generated manifest.json has no broad host access", () => {
    const { manifest: generated } = createBuildConfig(["--env=test/fixtures/public-build.json"]);
    expect(generated.permissions).not.toContain("tabs");
    expect(generated.content_scripts).toBeUndefined();
    expect(generated.host_permissions.some((host) => host.includes("*."))).toBe(false);
    expect(generated.host_permissions).not.toContain("https://*/*");
    expect(generated.host_permissions).not.toContain("<all_urls>");
  });
});

describe("Firefox manifest", () => {
  it("uses a background script and supports OAuth without Chrome-only manifest fields", () => {
    const manifest = createFirefoxManifest(manifestTemplate, "save-a-recipe@example.com");

    expect(manifest.background).toEqual({ scripts: [manifestTemplate.background.service_worker] });
    expect(manifest.permissions).toContain("identity");
    expect(manifest.permissions).not.toContain("offscreen");
    expect(manifest.oauth2).toBeUndefined();
    expect(manifest.browser_specific_settings.gecko).toMatchObject({
      id: "save-a-recipe@example.com",
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

  it("requires an explicit Firefox extension ID", () => {
    expect(() => createFirefoxManifest(manifestTemplate)).toThrow("FIREFOX_EXTENSION_ID");
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
