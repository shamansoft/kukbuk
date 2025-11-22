/**
 * Script to increment the patch version in package.json
 * Usage: node scripts/increment-version.js
 */

const fs = require("fs");
const path = require("path");

const packageJsonPath = path.resolve(__dirname, "..", "package.json");

try {
  // Read package.json
  const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
  const packageJson = JSON.parse(packageJsonContent);

  // Parse current version
  const currentVersion = packageJson.version;
  const versionParts = currentVersion.split(".");

  if (versionParts.length !== 3) {
    console.error(`Error: Invalid version format '${currentVersion}'. Expected semver (x.y.z)`);
    process.exit(1);
  }

  // Increment patch version
  const major = parseInt(versionParts[0], 10);
  const minor = parseInt(versionParts[1], 10);
  const patch = parseInt(versionParts[2], 10);

  const newVersion = `${major}.${minor}.${patch + 1}`;

  // Update package.json
  packageJson.version = newVersion;

  // Write back to file with proper formatting
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");

  console.log(`Version incremented: ${currentVersion} → ${newVersion}`);
} catch (error) {
  console.error(`Error incrementing version: ${error.message}`);
  process.exit(1);
}
