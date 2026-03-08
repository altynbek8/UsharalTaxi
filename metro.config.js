const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Это гарантирует, что Metro видит папку src
config.resolver.nodeModulesPaths = [
  require('path').resolve(__dirname, 'node_modules'),
];

module.exports = config;