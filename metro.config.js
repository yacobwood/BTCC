const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

const config = {
  watchFolders: [__dirname],
  resolver: {
    blockList: [
      // Don't crawl the parent native Android project
      new RegExp(path.resolve(__dirname, '..', 'app') + '/.*'),
      new RegExp(path.resolve(__dirname, '..', '.gradle') + '/.*'),
      new RegExp(path.resolve(__dirname, '..', '.kotlin') + '/.*'),
      new RegExp(path.resolve(__dirname, '..', '.idea') + '/.*'),
      new RegExp(path.resolve(__dirname, '..', '.expo') + '/.*'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
