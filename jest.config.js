module.exports = {
  transform: {
    "^.+\\.js$": ["babel-jest", { configFile: "./babel.config.js" }],
  },
  testEnvironment: "jsdom",
  setupFiles: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^.+\\.(css|less|scss)$": "<rootDir>/test/styleMock.js",
    "^.+\\.(jpg|jpeg|png|gif|webp|svg)$": "<rootDir>/test/fileMock.js",
  },
  transformIgnorePatterns: ["/node_modules/(?!.*\\.mjs$)"],
  collectCoverage: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "background/**/*.js",
    "popup/**/*.js",
    "content/**/*.js",
    "common/**/*.js",
    "!**/node_modules/**",
    "!**/dist/**",
  ],
  // Tell Jest to treat .js files as CommonJS modules
  moduleFileExtensions: ["js", "json"],
  // Implement a transformer for ES modules import/export
  transform: {
    "^.+\\.js$": [
      "babel-jest",
      {
        presets: [["@babel/preset-env", { targets: { node: "current" } }]],
        plugins: ["@babel/plugin-transform-modules-commonjs"],
      },
    ],
  },
};
