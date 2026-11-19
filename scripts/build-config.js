const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { version } = require("../package.json");

const root = path.resolve(__dirname, "..");
const sharedFields = [
  "API_BASE_URL",
  "EXTENSION_ID",
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID",
];
function trimValue(value) {
  return typeof value === "string" ? value.trim() : value;
}

const oauthClientId = /^[a-z0-9-]+\.apps\.googleusercontent\.com$/i;

function requirePublicValue(name, value) {
  if (
    typeof value !== "string" ||
    !value ||
    /\s|\$\{|\{\{|[<>]/.test(value) ||
    /(?:^|[./_:-])(?:your|placeholder|change[-_]?me|replace[-_]?(?:me|with)|todo)(?:$|[./_:-])/i.test(
      value,
    ) ||
    /^(undefined|null|dummy|example|xxx+|AIzaSyX+)$/i.test(value)
  ) {
    throw new Error(`${name} must contain a public build value (missing or placeholder)`);
  }
  return value;
}

function validateVersion(value) {
  const parts = typeof value === "string" ? value.split(".") : [];
  if (
    parts.length < 1 ||
    parts.length > 4 ||
    parts.some((part) => !/^(0|[1-9]\d*)$/.test(part) || Number(part) > 65535) ||
    parts.every((part) => part === "0")
  ) {
    throw new Error("Invalid extension version. Check package.json and VERSION_SUFFIX.");
  }
  return value;
}

function readBuildConfig(args, firefox) {
  const envArg = args.find((arg) => arg.startsWith("--env="));
  const file = path.resolve(
    root,
    envArg?.slice("--env=".length) ?? process.env.EXTENSION_CONFIG_FILE ?? ".env",
  );
  const isJson = path.extname(file) === ".json";
  let values = {};
  if (envArg || process.env.EXTENSION_CONFIG_FILE || fs.existsSync(file)) {
    const content = fs.readFileSync(file, "utf8");
    if (isJson) {
      try {
        values = JSON.parse(content);
      } catch {
        throw new Error("Invalid JSON build configuration");
      }
      if (!values || typeof values !== "object" || Array.isArray(values)) {
        throw new Error("JSON build configuration must be an object");
      }
    } else {
      values = dotenv.parse(content);
    }
  }
  // A captured JSON configuration is self-contained for reproducible builds.
  if (!isJson) values = { ...values, ...process.env };

  const config = {};
  for (const name of sharedFields) {
    config[name] = requirePublicValue(name, trimValue(values[name]));
  }
  let apiUrl;
  try {
    apiUrl = new URL(config.API_BASE_URL);
  } catch {
    throw new Error("API_BASE_URL must be an absolute HTTP(S) URL");
  }
  if (
    !["http:", "https:"].includes(apiUrl.protocol) ||
    apiUrl.username ||
    apiUrl.password ||
    apiUrl.search ||
    apiUrl.hash ||
    !/^https?:\/\//i.test(config.API_BASE_URL)
  ) {
    throw new Error(
      "API_BASE_URL must be an HTTP(S) base URL without credentials, query or fragment",
    );
  }

  config.VERSION_SUFFIX = values.VERSION_SUFFIX ?? "";
  buildVersion(config);

  const clientField = firefox ? "FIREFOX_GOOGLE_CLIENT_ID" : "CHROME_EXTENSION_CLIENT_ID";
  const client = trimValue(values[clientField]) ?? "";
  if (!firefox || client !== "") {
    requirePublicValue(clientField, client);
    if (!oauthClientId.test(client)) {
      throw new Error(`${clientField} must be a Google OAuth client ID`);
    }
  }
  config[clientField] = client;
  const geckoId = trimValue(values.FIREFOX_EXTENSION_ID) ?? "";
  if (firefox && geckoId !== "") {
    config.FIREFOX_EXTENSION_ID = requirePublicValue("FIREFOX_EXTENSION_ID", geckoId);
  }
  return config;
}

function buildVersion(config) {
  if (typeof config.VERSION_SUFFIX !== "string" || !/^(?:\.\d+)?$/.test(config.VERSION_SUFFIX)) {
    throw new Error("Invalid extension version. Check VERSION_SUFFIX.");
  }
  return validateVersion(version + config.VERSION_SUFFIX);
}

module.exports = { root, readBuildConfig, buildVersion, validateVersion };
