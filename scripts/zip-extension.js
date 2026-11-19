/** Package a freshly built extension. Run npm run zip or npm run zip:firefox. */
const fs = require("node:fs");
const path = require("node:path");
const AdmZip = require("adm-zip");
const { root, validateVersion } = require("./build-config");
const { sharedFiles, bundles } = require("./runtime-files");

function packageExtension(buildDir, firefox) {
  const manifest = JSON.parse(fs.readFileSync(path.join(buildDir, "manifest.json"), "utf8"));
  const version = validateVersion(manifest.version);
  const files = [
    "manifest.json",
    ...sharedFiles,
    ...(!firefox ? ["offscreen/auth-offscreen.html"] : []),
    ...bundles(firefox),
  ];
  for (const bundle of bundles(firefox)) {
    const license = `${bundle}.LICENSE.txt`;
    if (fs.existsSync(path.join(buildDir, license))) files.push(license);
  }

  const zip = new AdmZip();
  for (const file of files) {
    zip.addFile(file, fs.readFileSync(path.join(buildDir, file)));
    // Stable metadata so a rebuild can reproduce the archive as well as its contents.
    zip.getEntry(file).header.time = new Date(2000, 0, 1);
  }
  const suffix = firefox ? "-firefox" : "";
  const filename = `save-a-recipe-extension${suffix}-v${version}.zip`;
  return { zip, filename };
}

if (require.main === module) {
  try {
    const firefox = process.argv.includes("--firefox");
    const buildDir = firefox ? path.join(root, "build/firefox") : root;
    const { zip, filename } = packageExtension(buildDir, firefox);
    zip.writeZip(path.join(root, filename));
    console.log(`Created ${filename}`);
  } catch (error) {
    console.error(`Packaging failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { packageExtension };
