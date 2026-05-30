/**
 * Build-artifact test: verifies manifest.json contains the required identity/oauth2 fields.
 * Run `npm run build:local` (or `npm run build`) before running this test so manifest.json is up to date.
 */

const fs = require("fs");
const path = require("path");

describe("manifest.json", () => {
  let manifest;

  beforeAll(() => {
    const manifestPath = path.resolve(__dirname, "../manifest.json");
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  });

  it("includes identity permission", () => {
    expect(manifest.permissions).toContain("identity");
  });

  it("has oauth2 block with client_id and required scopes", () => {
    expect(manifest.oauth2).toBeDefined();
    expect(manifest.oauth2.client_id).toMatch(/\.apps\.googleusercontent\.com$/);
    expect(manifest.oauth2.scopes).toEqual(["openid", "email", "profile"]);
  });
});
