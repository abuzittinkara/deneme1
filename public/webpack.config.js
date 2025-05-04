// public/webpack.config.js
const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'production',
  entry: './src/ts/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true, // Sadece dönüştürme yap, tip kontrolü yapma
            compilerOptions: {
              noEmitOnError: false // Hata olsa bile çıktı üret
            }
          }
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      "util": require.resolve("util/"),
      "path": require.resolve("path-browserify"),
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/"),
      "crypto": require.resolve("crypto-browserify"),
      "http": require.resolve("stream-http"),
      "https": require.resolve("https-browserify"),
      "os": require.resolve("os-browserify/browser"),
      "assert": require.resolve("assert/"),
      "fs": false,
      "net": false,
      "tls": false,
      "zlib": require.resolve("browserify-zlib")
    }
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
  ],
  devtool: 'source-map',
};
