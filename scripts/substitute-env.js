/**
 * Generate extension configuration from environment variables.
 * Usage: node scripts/substitute-env.js [--env=.env.local] [--firefox]
 */

const fs = require("fs");
const path = require("path");
const { createHash } = require("node:crypto");
const { root, readBuildConfig, buildVersion } = require("./build-config");
const { sharedFiles } = require("./runtime-files");

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

function createBuildConfig(args) {
  const firefox = args.includes("--firefox");
  const config = readBuildConfig(args, firefox);
  const outputDir = firefox ? path.join(root, "build/firefox") : root;
  const readTemplate = (name) => fs.readFileSync(path.join(root, "templates", name), "utf8");
  let manifest = JSON.parse(readTemplate("manifest.template.json"));

  manifest.version = buildVersion(config);
  if (firefox) {
    manifest = createFirefoxManifest(manifest, config.FIREFOX_EXTENSION_ID);
  } else {
    manifest.oauth2.client_id = config.CHROME_EXTENSION_CLIENT_ID;
  }

  const env = {
    ...config,
    EXTENSION_VERSION: manifest.version,
    FIREFOX_GOOGLE_CLIENT_ID: config.FIREFOX_GOOGLE_CLIENT_ID ?? "",
  };
  const envSource = readTemplate("env-config.template.js").replace(
    /"\$\{([^}]+)\}"/g,
    (_, name) => {
      if (!Object.hasOwn(env, name)) throw new Error(`Unknown environment template field: ${name}`);
      return JSON.stringify(env[name]);
    },
  );
  return {
    firefox,
    outputDir,
    manifest,
    envSource,
    firefoxGoogleEnabled: Boolean(config.FIREFOX_GOOGLE_CLIENT_ID),
  };
}

function generateConfig(args) {
  const { firefox, outputDir, manifest, envSource, firefoxGoogleEnabled } = createBuildConfig(args);

  if (firefox) {
    if (!firefoxGoogleEnabled) {
      const { id } = manifest.browser_specific_settings.gecko;
      // Firefox derives the identity redirect subdomain from the SHA-1 of the add-on ID.
      const redirectHost = createHash("sha1").update(id).digest("hex");
      console.warn(
        "Google sign-in is disabled in this Firefox build. Set FIREFOX_GOOGLE_CLIENT_ID " +
          "to a Web application OAuth client registered for " +
          `http://127.0.0.1/mozoauth2/${redirectHost}.`,
      );
    }
    fs.rmSync(outputDir, { recursive: true, force: true });
    for (const file of sharedFiles) {
      const destination = path.join(outputDir, file);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(root, file), destination);
    }
  }

  fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  fs.writeFileSync(path.join(outputDir, "common/env-config.js"), envSource);
  console.log(`Generated extension configuration in ${outputDir}`);
}

if (require.main === module) {
  try {
    generateConfig(process.argv.slice(2));
  } catch (error) {
    console.error(`Build configuration failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { createFirefoxManifest, createBuildConfig };
