/** @jest-environment node */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createBuildConfig } = require("../scripts/substitute-env");
const { readBuildConfig } = require("../scripts/build-config");
const config = require("./fixtures/public-build.json");
const { version } = require("../package.json");

let directory;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "sar-build-config-"));
});
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

function argsFor(values) {
  const file = path.join(directory, "public.json");
  fs.writeFileSync(file, JSON.stringify(values));
  return [`--env=${file}`];
}

it.each([
  ["API_BASE_URL", undefined, []],
  ["API_BASE_URL", "https://user:secret@backend.example", []],
  ["API_BASE_URL", "https://your-backend-url.run.app", ["--firefox"]],
  ["FIREBASE_API_KEY", "   ", []],
  ["FIREBASE_PROJECT_ID", "${FIREBASE_PROJECT_ID}", ["--firefox"]],
  ["FIREBASE_APP_ID", "your_app_id_here", []],
  ["EXTENSION_ID", "<extension-id>", []],
  ["CHROME_EXTENSION_CLIENT_ID", undefined, []],
  ["CHROME_EXTENSION_CLIENT_ID", "wrong-client", []],
  ["FIREFOX_GOOGLE_CLIENT_ID", "your-web-client-id.apps.googleusercontent.com", ["--firefox"]],
])("rejects invalid %s (%s)", (name, value, target) => {
  expect(() => createBuildConfig([...argsFor({ ...config, [name]: value }), ...target])).toThrow(
    name,
  );
});

it.each([".65536", ".07", "-beta", "/manifest"])("rejects invalid version suffix %s", (suffix) => {
  expect(() => createBuildConfig(argsFor({ ...config, VERSION_SUFFIX: suffix }))).toThrow(
    "Invalid extension version",
  );
});

it("renders the manifest and generated config using the same version", () => {
  const { manifest, envSource } = createBuildConfig(argsFor(config));
  expect(manifest.version).toBe(`${version}.7`);
  expect(envSource).toContain(`EXTENSION_VERSION: "${manifest.version}"`);
  expect(envSource).not.toContain("${");
});

it("permits email-only Firefox builds and captures only used public settings", () => {
  const values = {
    ...config,
    FIREFOX_GOOGLE_CLIENT_ID: undefined,
    OAUTH_CLIENT_SECRET: "never included",
  };
  const args = argsFor(values);
  const captured = readBuildConfig(args, true);
  expect(captured).not.toHaveProperty("OAUTH_CLIENT_SECRET");
  expect(captured).not.toHaveProperty("CHROME_EXTENSION_CLIENT_ID");
  const { manifest, envSource } = createBuildConfig([...args, "--firefox"]);
  expect(manifest).not.toHaveProperty("oauth2");
  expect(envSource).toContain('FIREFOX_GOOGLE_CLIENT_ID: ""');
});
