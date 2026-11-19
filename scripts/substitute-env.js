/**
 * Generate extension configuration from environment variables.
 * Usage: node scripts/substitute-env.js [--env=.env.local] [--firefox]
 */

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { version } = require("../package.json");

const root = path.resolve(__dirname, "..");

function createFirefoxManifest(manifest, id = "save-a-recipe@mykukbuk.com") {
  const firefoxManifest = {
    ...manifest,
    permissions: manifest.permissions.filter((permission) => permission !== "offscreen"),
    background: { scripts: [manifest.background.service_worker] },
    browser_specific_settings: {
      gecko: {
        id,
        strict_min_version: "140.0",
        data_collection_permissions: {
          required: [
            "authenticationInfo",
            "browsingActivity",
            "personallyIdentifyingInfo",
            "websiteContent",
          ],
        },
      },
    },
  };
  delete firefoxManifest.oauth2;
  return firefoxManifest;
}

function substituteEnvVars(content) {
  return content.replace(/\${([^}]+)}/g, (match, varName) => {
    if (varName === "EXTENSION_VERSION") {
      return version + (process.env.VERSION_SUFFIX ?? "");
    }
    if (varName === "FIREFOX_GOOGLE_CLIENT_ID") {
      return process.env.FIREFOX_GOOGLE_CLIENT_ID ?? "";
    }

    const value = process.env[varName];
    if (value === undefined) {
      console.warn(`Warning: Environment variable '${varName}' not found`);
      return match;
    }
    return value;
  });
}

function generateConfig(args) {
  const envArg = args.find((arg) => arg.startsWith("--env="));
  const envFilePath = path.resolve(root, envArg?.slice("--env=".length) ?? ".env");
  if (fs.existsSync(envFilePath)) {
    dotenv.config({ path: envFilePath });
    console.log(`Using environment file: ${envFilePath}`);
  } else {
    console.warn(`Warning: Environment file '${envFilePath}' not found`);
  }

  const firefox = args.includes("--firefox");
  const outputDir = firefox ? path.join(root, "build/firefox") : root;
  const readTemplate = (name) => fs.readFileSync(path.join(root, "templates", name), "utf8");
  let manifest = JSON.parse(readTemplate("manifest.template.json"));

  if (firefox) {
    manifest = createFirefoxManifest(manifest, process.env.FIREFOX_EXTENSION_ID || undefined);
    fs.rmSync(outputDir, { recursive: true, force: true });
    const bundledOnly = ["env-config.js", "firebase-config.js", "email-sign-in-error.js"];
    for (const directory of ["common", "content", "icons", "options", "popup", "recipe-creator"]) {
      fs.cpSync(path.join(root, directory), path.join(outputDir, directory), {
        recursive: true,
        filter: (source) =>
          !source.endsWith(".test.js") &&
          (directory !== "common" || !bundledOnly.includes(path.basename(source))),
      });
    }
  }

  fs.writeFileSync(
    path.join(outputDir, "manifest.json"),
    substituteEnvVars(JSON.stringify(manifest, null, 2)) + "\n",
  );
  fs.writeFileSync(
    path.join(outputDir, "common/env-config.js"),
    substituteEnvVars(readTemplate("env-config.template.js")),
  );
  console.log(`Generated extension configuration in ${outputDir}`);
}

if (require.main === module) {
  generateConfig(process.argv.slice(2));
}

module.exports = { createFirefoxManifest };
