const path = require("path");

module.exports = {
  mode: process.env.NODE_ENV === "development" ? "development" : "production",
  entry: {
    background: "./background/background.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].bundle.js",
    clean: false, // Don't clean the dist folder (keep other extension files)
  },
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
};
