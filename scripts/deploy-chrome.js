/**
 * Script to build and open Chrome with the extension loaded for development
 * Usage: node scripts/deploy-chrome.js
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Parse command line arguments for environment file
const args = process.argv.slice(2);
const envArg = args.find((arg) => arg.startsWith("--env="));
const envFile = envArg ? envArg.replace("--env=", "") : ".env";

// Configuration
const EXTENSION_DIR = path.resolve(__dirname, "..");
const CHROME_PROFILES_DIR = getDefaultChromeProfilesDir();
const DEV_PROFILE = "Extension-Dev";

// Determine the platform-specific Chrome executable path
function getChromeExecutablePath() {
  switch (os.platform()) {
    case "darwin": // macOS
      return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    case "win32": // Windows
      const programFiles = process.env["PROGRAMFILES"] || "C:\\Program Files";
      return `${programFiles}\\Google\\Chrome\\Application\\chrome.exe`;
    case "linux": // Linux
      return "/usr/bin/google-chrome";
    default:
      throw new Error(`Unsupported platform: ${os.platform()}`);
  }
}

// Get the default Chrome profiles directory based on platform
function getDefaultChromeProfilesDir() {
  const homeDir = os.homedir();

  switch (os.platform()) {
    case "darwin": // macOS
      return path.join(homeDir, "Library", "Application Support", "Google", "Chrome");
    case "win32": // Windows
      return path.join(homeDir, "AppData", "Local", "Google", "Chrome", "User Data");
    case "linux": // Linux
      return path.join(homeDir, ".config", "google-chrome");
    default:
      throw new Error(`Unsupported platform: ${os.platform()}`);
  }
}

// Make sure the chrome profile directory exists
function ensureProfileDirectory() {
  const profileDir = path.join(CHROME_PROFILES_DIR, DEV_PROFILE);

  if (!fs.existsSync(profileDir)) {
    console.log(`Creating Chrome profile directory: ${profileDir}`);
    fs.mkdirSync(profileDir, { recursive: true });
  }

  return profileDir;
}

// Build the extension first
function buildExtension() {
  console.log("Building extension...");
  try {
    execSync("npm run prebuild", { stdio: "inherit", cwd: EXTENSION_DIR });
    console.log("Extension built successfully.");
  } catch (error) {
    console.error("Failed to build extension:", error.message);
    process.exit(1);
  }
}

// Launch Chrome with the extension loaded
function launchChrome(profileDir) {
  const chromePath = getChromeExecutablePath();
  const extensionPath = EXTENSION_DIR;

  if (!fs.existsSync(chromePath)) {
    console.error(`Chrome executable not found at: ${chromePath}`);
    console.log("Please install Chrome or update the script with the correct path.");
    process.exit(1);
  }

  console.log(`Launching Chrome with extension from: ${extensionPath}`);

  const args = [
    `--user-data-dir=${profileDir}`,
    `--load-extension=${extensionPath}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--start-maximized",
    "https://www.gordonramsay.com/gr/recipes/prsteaksandwich/",
  ];

  try {
    // Using spawn would be better for a long-running process, but for simplicity using execSync
    execSync(`"${chromePath}" ${args.join(" ")}`, {
      stdio: "inherit",
      detached: true, // This allows Chrome to run independently from this script
    });
  } catch (error) {
    // Chrome was likely closed by the user, which is expected behavior
    console.log("Chrome session ended.");
  }
}

// Main function
function main() {
  console.log("Deploying extension to local Chrome browser...");

  try {
    buildExtension();
    const profileDir = ensureProfileDirectory();
    launchChrome(profileDir);
  } catch (error) {
    console.error("Error deploying extension:", error.message);
    process.exit(1);
  }
}

// Run the script
main();
