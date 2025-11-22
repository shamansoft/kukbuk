/**
 * Script to package the extension into a ZIP file for distribution
 * Usage: node scripts/zip-extension.js
 */

const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Get version from environment or manifest
const version = process.env.EXTENSION_VERSION || "1.0.0";
const zipFilename = `mykukbuk-extension-v${version}.zip`;

// Files and directories to include
const INCLUDE_FILES = [
  "manifest.json",
  "popup/**",
  "background/**",
  "content/**",
  "options/**",
  "common/**",
  "icons/**",
];

// Files and directories to exclude
const EXCLUDE_PATTERNS = [
  "**/*.map",
  "**/*.ts",
  "**/*.template.*",
  "**/node_modules/**",
  "**/.git/**",
];

/**
 * Check if a file should be excluded
 * @param {string} filePath - Path to check
 * @returns {boolean} Whether the file should be excluded
 */
function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some((pattern) => {
    if (pattern.includes("*")) {
      const regexPattern = pattern
        .replace(/\./g, "\\.")
        .replace(/\*\*/g, ".*")
        .replace(/\*/g, "[^/]*");
      const regex = new RegExp(`^${regexPattern}$`, "i");
      return regex.test(filePath);
    }
    return filePath === pattern;
  });
}

/**
 * Add directory to zip recursively
 * @param {AdmZip} zip - AdmZip instance
 * @param {string} dir - Directory to add
 * @param {string} [zipRoot=''] - Root path in ZIP
 */
function addDirectoryToZip(zip, dir, zipRoot = "") {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const relativePath = zipRoot ? path.join(zipRoot, file) : file;

    if (shouldExclude(relativePath)) {
      console.log(`Excluding: ${relativePath}`);
      continue;
    }

    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      addDirectoryToZip(zip, filePath, relativePath);
    } else {
      console.log(`Adding: ${relativePath}`);
      zip.addLocalFile(filePath, path.dirname(relativePath));
    }
  }
}

/**
 * Add a glob pattern to the zip
 * @param {AdmZip} zip - AdmZip instance
 * @param {string} pattern - Glob pattern
 */
function addGlobToZip(zip, pattern) {
  if (pattern.endsWith("/**")) {
    // Directory with all contents
    const dir = pattern.slice(0, -3);
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      addDirectoryToZip(zip, dir, dir);
    }
  } else if (pattern.includes("*")) {
    console.warn(`Skipping unsupported glob pattern: ${pattern}`);
  } else {
    // Single file
    if (fs.existsSync(pattern) && fs.statSync(pattern).isFile()) {
      console.log(`Adding: ${pattern}`);
      zip.addLocalFile(pattern);
    }
  }
}

// Create ZIP file
try {
  console.log(`Creating extension package: ${zipFilename}`);

  const zip = new AdmZip();

  // Add files to zip
  for (const pattern of INCLUDE_FILES) {
    addGlobToZip(zip, pattern);
  }

  // Write zip file
  zip.writeZip(zipFilename);

  console.log(`Successfully created: ${zipFilename}`);
} catch (error) {
  console.error(`Error creating extension package: ${error.message}`);
  process.exit(1);
}
