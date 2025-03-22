/**
 * Script to substitute environment variables in target files
 * Usage: node scripts/substitute-env.js
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Parse command-line arguments
const args = process.argv.slice(2);
const envArg = args.find(arg => arg.startsWith('--env='));
const envFile = envArg ? envArg.replace('--env=', '') : '.env';

// Load environment variables from specified .env file
dotenv.config({ path: envFile });
console.log(`Using environment file: ${envFile}`);

// Files to process with environment variable substitution
const FILES_TO_PROCESS = [
  {
    input: 'templates/manifest.template.json',
    output: 'manifest.json'
  },
  {
    input: 'templates/env-config.template.js',
    output: 'common/env-config.js'
  }
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
    const value = process.env[varName];

    if (value === undefined) {
      console.warn(`Warning: Environment variable '${varName}' not found`);
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

  try {
    // Check if input file exists
    if (!fs.existsSync(input)) {
      console.error(`Error: Input file '${input}' not found`);
      return;
    }

    // Read input file
    const content = fs.readFileSync(input, 'utf8');

    // Substitute environment variables
    const processedContent = substituteEnvVars(content);

    // Ensure output directory exists
    const outputDir = path.dirname(output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write to output file
    fs.writeFileSync(output, processedContent);

    console.log(`Successfully processed '${input}' -> '${output}'`);
  } catch (error) {
    console.error(`Error processing '${input}': ${error.message}`);
  }
}

// Process all files
console.log('Starting environment variable substitution...');
FILES_TO_PROCESS.forEach(processFile);
console.log('Environment variable substitution completed.');