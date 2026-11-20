// Files loaded directly by the browser. Bundled modules live only in dist/.
const sharedFiles = [
  "common/constants.js",
  "common/error-handler.js",
  "common/theme.css",
  "content/content.js",
  "content/recipe-extractor.js",
  "icons/icon16.png",
  "icons/icon48.png",
  "icons/icon128.png",
  "options/options.css",
  "options/options.html",
  "options/options.js",
  "popup/popup.css",
  "popup/popup.html",
  "popup/popup.js",
  "recipe-creator/recipe-creator.css",
  "recipe-creator/recipe-creator.html",
  "recipe-creator/recipe-creator.js",
];

function bundles(firefox) {
  return [
    "dist/background.bundle.js",
    ...(!firefox ? ["dist/offscreen/auth-offscreen.bundle.js"] : []),
  ];
}

module.exports = { sharedFiles, bundles };
