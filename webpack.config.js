const path = require("path");
const webpack = require("webpack");

module.exports = ({ firefox = false } = {}) => ({
  mode: process.env.NODE_ENV === "development" ? "development" : "production",
  // Firefox provides the browser global directly. Skip Webpack's eval-based fallback.
  node: firefox ? { global: false } : undefined,
  entry: {
    background: "./background/background.js",
    ...(!firefox && { "offscreen/auth-offscreen": "./offscreen/auth-offscreen.js" }),
  },
  output: {
    path: path.resolve(__dirname, firefox ? "build/firefox/dist" : "dist"),
    filename: "[name].bundle.js",
    clean: firefox,
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
            presets: ["@babel/preset-env"],
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
