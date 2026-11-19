/** @jest-environment node */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const AdmZip = require("adm-zip");
const { sharedFiles } = require("../scripts/runtime-files");
const { packageExtension } = require("../scripts/zip-extension");

const background = "dist/background.bundle.js";
const offscreenFiles = ["offscreen/auth-offscreen.html", "dist/offscreen/auth-offscreen.bundle.js"];
let buildDir;

function writeFile(file, content = "fixture") {
  const target = path.join(buildDir, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

beforeEach(() => {
  buildDir = fs.mkdtempSync(path.join(os.tmpdir(), "sar-package-"));
  for (const file of [
    ...sharedFiles,
    background,
    `${background}.LICENSE.txt`,
    ...offscreenFiles,
    "offscreen/auth-offscreen.js",
    "common/env-config.js",
    "popup/popup.test.js",
    "dist/stale.bundle.js",
    "dist/background.bundle.js.map",
    "icons/icon.svg",
  ]) {
    writeFile(file);
  }
  writeFile("manifest.json", '{"version":"1.2.3.4"}');
});

afterEach(() => fs.rmSync(buildDir, { recursive: true, force: true }));

it.each([
  [false, "save-a-recipe-extension-v1.2.3.4.zip", offscreenFiles],
  [true, "save-a-recipe-extension-firefox-v1.2.3.4.zip", []],
])("packages the intended browser assets (firefox=%s)", (firefox, expectedFilename, extra) => {
  const { zip, filename } = packageExtension(buildDir, firefox);
  const archive = new AdmZip(zip.toBuffer());
  expect(filename).toBe(expectedFilename);
  expect(archive.getEntry("content/recipe-extractor.js")).toBeTruthy();
  expect(JSON.parse(archive.readAsText("manifest.json")).version).toBe("1.2.3.4");
  expect(
    archive
      .getEntries()
      .map((entry) => entry.entryName)
      .sort(),
  ).toEqual(
    ["manifest.json", ...sharedFiles, background, `${background}.LICENSE.txt`, ...extra].sort(),
  );
});

it("fails if a required bundle is missing", () => {
  fs.unlinkSync(path.join(buildDir, background));
  expect(() => packageExtension(buildDir, false)).toThrow("ENOENT");
});
