/**
 * Generate extension configuration from environment variables.
 * Usage: node scripts/substitute-env.js [--env=.env.local] [--firefox]
 */

const fs = require("fs");
const path = require("path");
const { createHash } = require("node:crypto");
const dotenv = require("dotenv");
const { version } = require("../package.json");

const root = path.resolve(__dirname, "..");

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);
const LOCAL_DEV_HOST_PERMISSIONS = ["http://localhost/*", "http://127.0.0.1/*"];
const LOCAL_DEV_ORIGINS = ["http://localhost:*", "http://127.0.0.1:*"];

/**
 * Derives the extension's network allowlist from the build environment.
 *
 * Production builds get exactly one backend host (from API_BASE_URL) and one Firebase auth
 * domain (from FIREBASE_AUTH_DOMAIN); no wildcards. Local development hosts (localhost and
 * 127.0.0.1, any port) are added only when API_BASE_URL itself points at a loopback host.
 * Throws instead of falling back to broad host access when either value is missing or invalid.
 *
 * @param {Object} env - Usually process.env
 * @returns {{apiOrigin: string, apiHostPermission: string, authOrigin: string, localDev: boolean}}
 */
function resolveNetworkPolicy(env) {
  const rawApi = env.API_BASE_URL?.trim();
  if (!rawApi) {
    throw new Error("API_BASE_URL is required: it sets the extension's only backend host.");
  }
  let api;
  try {
    api = new URL(rawApi);
  } catch (_e) {
    throw new Error(`API_BASE_URL is not a valid URL: ${rawApi}`);
  }
  const localDev = LOOPBACK_HOSTS.has(api.hostname);
  if (api.protocol !== "https:" && !(localDev && api.protocol === "http:")) {
    throw new Error("API_BASE_URL must use https:// (http:// is allowed only for localhost).");
  }

  const authDomain = env.FIREBASE_AUTH_DOMAIN?.trim();
  if (
    !authDomain ||
    !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(authDomain)
  ) {
    throw new Error("FIREBASE_AUTH_DOMAIN must be a host name such as kukbuk-tf.firebaseapp.com.");
  }

  return {
    apiOrigin: api.origin,
    // Match patterns cannot name a port; the pattern covers every port on the host.
    apiHostPermission: `${api.protocol}//${api.hostname}/*`,
    authOrigin: `https://${authDomain.toLowerCase()}`,
    localDev,
  };
}

/**
 * Fills the manifest's network placeholders (${API_HOST_PERMISSION}, ${API_ORIGIN},
 * ${FIREBASE_AUTH_ORIGIN}) and adds the local development hosts when the policy allows them.
 * @param {Object} manifest - Parsed manifest template
 * @param {ReturnType<typeof resolveNetworkPolicy>} policy
 * @returns {Object} New manifest
 */
function applyNetworkPolicy(manifest, policy) {
  const fill = (value) =>
    value
      .replaceAll("${API_HOST_PERMISSION}", policy.apiHostPermission)
      .replaceAll("${API_ORIGIN}", policy.apiOrigin)
      .replaceAll("${FIREBASE_AUTH_ORIGIN}", policy.authOrigin);

  const hostPermissions = manifest.host_permissions.map(fill);
  let csp = fill(manifest.content_security_policy.extension_pages);
  if (policy.localDev) {
    hostPermissions.push(...LOCAL_DEV_HOST_PERMISSIONS);
    const dev = LOCAL_DEV_ORIGINS.join(" ");
    csp = csp
      .replace("frame-src ", `frame-src ${dev} `)
      .replace("connect-src 'self' ", `connect-src 'self' ${dev} `);
  }

  return {
    ...manifest,
    host_permissions: [...new Set(hostPermissions)],
    content_security_policy: { ...manifest.content_security_policy, extension_pages: csp },
  };
}

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
      return process.env.FIREFOX_GOOGLE_CLIENT_ID?.trim() ?? "";
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
  const policy = resolveNetworkPolicy(process.env);
  let manifest = applyNetworkPolicy(JSON.parse(readTemplate("manifest.template.json")), policy);
  console.log(
    `Network allowlist: ${manifest.host_permissions.join(", ")}` +
      (policy.localDev ? " (local development hosts included)" : ""),
  );

  if (firefox) {
    manifest = createFirefoxManifest(manifest, process.env.FIREFOX_EXTENSION_ID || undefined);
    if (!process.env.FIREFOX_GOOGLE_CLIENT_ID?.trim()) {
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

module.exports = { createFirefoxManifest, resolveNetworkPolicy, applyNetworkPolicy };
