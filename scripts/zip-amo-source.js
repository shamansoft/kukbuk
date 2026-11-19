const { execFileSync } = require("node:child_process");
const path = require("node:path");
const AdmZip = require("adm-zip");
const { root, readBuildConfig, buildVersion } = require("./build-config");

try {
  const config = readBuildConfig(process.argv.slice(2), true);
  const git = (...args) => execFileSync("git", args, { cwd: root });
  if (git("status", "--porcelain", "--untracked-files=no").length) {
    throw new Error("Commit tracked changes before generating the AMO source archive.");
  }
  const source = git(
    "archive",
    "--format=zip",
    "HEAD",
    "--",
    "README.MD",
    "package.json",
    "package-lock.json",
    "webpack.config.js",
    "babel.config.js",
    "background",
    "common",
    "content",
    "icons",
    "offscreen",
    "options",
    "popup",
    "recipe-creator",
    "scripts",
    "templates",
  );
  const zip = new AdmZip(source);
  const npmVersion = process.env.npm_config_user_agent?.match(/npm\/([^ ]+)/)?.[1];
  zip.addFile("amo-build-config.json", Buffer.from(JSON.stringify(config, null, 2) + "\n"));
  zip.addFile(
    "AMO-BUILD.md",
    Buffer.from(
      "# Rebuild the Firefox extension\n\n" +
        `Publisher build environment: ${process.platform} (${process.arch}), Node ${process.version}` +
        (npmVersion ? `, npm ${npmVersion}` : "") +
        ".\n\n" +
        "Extract the archive, install the recorded Node and npm versions, and run from the archive root:\n\n" +
        "```sh\nnpm ci --include=dev\n" +
        "EXTENSION_CONFIG_FILE=amo-build-config.json npm run zip:firefox\n```\n\n" +
        `The resulting file is save-a-recipe-extension-firefox-v${buildVersion(config)}.zip.\n` +
        "The unpacked extension is in build/firefox/. The config contains public extension build values.\n",
    ),
  );
  for (const name of ["amo-build-config.json", "AMO-BUILD.md"]) {
    zip.getEntry(name).header.time = new Date(2000, 0, 1);
  }
  const filename = `save-a-recipe-extension-firefox-v${buildVersion(config)}-source.zip`;
  zip.writeZip(path.join(root, filename));
  console.log(`Created ${filename}`);
} catch (error) {
  console.error(`AMO source packaging failed: ${error.message}`);
  process.exitCode = 1;
}
