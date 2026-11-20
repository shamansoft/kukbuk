const path = require("path");
const webpack = require("webpack");

module.exports = ({ firefox = false } = {}) => ({
  mode: process.env.NODE_ENV === "development" ? "development" : "production",
  target: ["web", "es2022"],
  // Extension contexts provide globalThis. Omit Webpack's dynamic-code fallback.
  node: { global: false },
  entry: {
    background: "./background/background.js",
    ...(!firefox && { "offscreen/auth-offscreen": "./offscreen/auth-offscreen.js" }),
  },
  output: {
    path: path.resolve(__dirname, firefox ? "build/firefox/dist" : "dist"),
    filename: "[name].bundle.js",
    clean: true,
  },
  plugins: [
    new webpack.DefinePlugin({ __FIREFOX__: JSON.stringify(firefox) }),
    ...(firefox
      ? [
          new webpack.NormalModuleReplacementPlugin(
            /\/env-config\.js$/,
            path.resolve(__dirname, "build/firefox/common/env-config.js"),
          ),
        ]
      : []),
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            babelrc: false,
            configFile: false,
            presets: [
              [
                "@babel/preset-env",
                {
                  targets: firefox ? { firefox: "140" } : { chrome: "109" },
                  ignoreBrowserslistConfig: true,
                },
              ],
            ],
          },
        },
      },
    ],
  },
  resolve: {
    extensions: [".js"],
    fallback: {
      // Firebase needs these Node.js module fallbacks for browser
      util: false,
      assert: false,
    },
  },
  optimization: {
    minimize: process.env.NODE_ENV !== "development",
  },
  devtool: process.env.NODE_ENV === "development" ? "inline-source-map" : false,
  stats: {
    errorDetails: true,
  },
});
