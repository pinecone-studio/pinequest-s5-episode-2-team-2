// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro loads CommonJS configuration.
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("tflite");
module.exports = config;
