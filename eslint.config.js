import js from "@eslint/js";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    ignores: [
      "node_modules/",
      "dist/",
      "build/",
      "*.min.js",
      "*.min.css",
      "webpack.config.js",
      "scripts/zip-extension.js",
      "scripts/deploy-chrome.js",
      "/mykukbuk.zip",
      "webpack_output/",
      "coverage/",
      ".cache/",
      "tests/__mocks__/",
    ],
  },
  js.configs.recommended,
  prettierConfig,
  {
    plugins: {
      prettier: prettierPlugin,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        chrome: "readonly",
        window: "readonly",
        document: "readonly",
      },
    },
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
      "no-console": "off",
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
    },
  },
];
