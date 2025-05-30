/**
 * Script to substitute environment variables in target files
 * Version from package.json is used for EXTENSION_VERSION
 * Usage: node scripts/substitute-env.js
 */

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// --- Get version from package.json ---
let extensionVersion = "0.0.0"; // Default version
try {
  const packageJsonPath = path.resolve(__dirname, "..", "package.json");
  const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
  const packageJson = JSON.parse(packageJsonContent);
  if (packageJson.version) {
    extensionVersion = packageJson.version;
    console.log(`Using EXTENSION_VERSION from package.json: ${extensionVersion}`);
  } else {
    console.warn("Warning: 'version' not found in package.json. Using default.");
  }
} catch (error) {
  console.warn(
    `Warning: Could not read version from package.json. Using default. Error: ${error.message}`,
  );
}
// --- End get version from package.json ---

// Parse command-line arguments
const args = process.argv.slice(2);
const envArg = args.find((arg) => arg.startsWith("--env="));
const envFile = envArg ? envArg.replace("--env=", "") : ".env";
const envFilePath = path.resolve(__dirname, "..", envFile); // Ensure .env is loaded from project root

// Load environment variables from specified .env file
if (fs.existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath });
  console.log(`Using environment file: ${envFilePath}`);
} else {
  console.warn(
    `Warning: Environment file '${envFilePath}' not found. Some variables might be missing.`,
  );
}

// Files to process with environment variable substitution
const FILES_TO_PROCESS = [
  {
    input: "templates/manifest.template.json",
    output: "manifest.json",
  },
  {
    input: "templates/env-config.template.js",
    output: "common/env-config.js",
  },
  // Add more files as needed
];

/**
 * Substitutes environment variables in the content
 * @param {string} content - File content with placeholders
 * @returns {string} Content with substituted values
 */
function substituteEnvVars(content) {
  // Replace ${VAR_NAME} with the environment variable value
  return content.replace(/\${([^}]+)}/g, (match, varName) => {
    let value;
    if (varName === "EXTENSION_VERSION") {
      value = extensionVersion; // Use version from package.json
    } else {
      value = process.env[varName];
    }

    if (value === undefined) {
      console.warn(
        `Warning: Environment variable '${varName}' not found (and not EXTENSION_VERSION)`,
      );
      return match; // Keep the placeholder if variable not found
    }

    return value;
  });
}

/**
 * Process a single file
 * @param {Object} fileConfig - File configuration
 */
function processFile(fileConfig) {
  const { input, output } = fileConfig;
  const inputPath = path.resolve(__dirname, "..", input);
  const outputPath = path.resolve(__dirname, "..", output);

  try {
    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      console.error(`Error: Input file '${inputPath}' not found`);
      return;
    }

    // Read input file
    const content = fs.readFileSync(inputPath, "utf8");

    // Substitute environment variables
    const processedContent = substituteEnvVars(content);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write to output file
    fs.writeFileSync(outputPath, processedContent);

    console.log(`Successfully processed '${inputPath}' -> '${outputPath}'`);
  } catch (error) {
    console.error(`Error processing '${inputPath}': ${error.message}`);
  }
}

// Process all files
console.log("Starting environment variable substitution...");
FILES_TO_PROCESS.forEach(processFile);
console.log("Environment variable substitution completed.");
