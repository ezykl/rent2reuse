const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("json");
config.resolver.sourceExts.push("cjs");
config.resolver.assetExts.push("pte");
config.resolver.assetExts.push("bin");

module.exports = withNativeWind(config, { input: "./src/global.css" });
