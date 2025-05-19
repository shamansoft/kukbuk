module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true,
    node: true,
  },
  extends: ["eslint:recommended", "prettier"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  plugins: ["prettier"],
  rules: {
    "prettier/prettier": [
      "error",
      {
        singleQuote: false,
        trailingComma: "all",
        printWidth: 100,
        tabWidth: 2,
        semi: true,
      },
    ],
    "no-console": "off", // Allow console.log for chrome extension debugging
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-multiple-empty-lines": ["error", { max: 1, maxEOF: 1 }],
    quotes: ["error", "double"],
    semi: ["error", "always"],
    "comma-dangle": ["error", "always-multiline"],
    "arrow-parens": ["error", "always"],
    eqeqeq: ["error", "always"],
    "prefer-const": "error",
    "no-var": "error",
    "max-len": ["warn", { code: 100 }],
    // Chrome extensions often use browser APIs and callbacks
    "no-use-before-define": "off",
  },
  ignorePatterns: ["node_modules/", "dist/", "*.min.js", "webpack.config.js"],
};
