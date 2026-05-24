const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);
const {assetExts, sourceExts} = defaultConfig.resolver;

const config = {
  watchFolders: [__dirname],
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer/react-native'),
  },
  resolver: {
    assetExts: assetExts.filter(ext => ext !== 'svg'),
    sourceExts: [...sourceExts, 'svg'],
    blockList: [
      new RegExp(path.resolve(__dirname, '..', 'app') + '/.*'),
      new RegExp(path.resolve(__dirname, '..', '.gradle') + '/.*'),
      new RegExp(path.resolve(__dirname, '..', '.kotlin') + '/.*'),
      new RegExp(path.resolve(__dirname, '..', '.idea') + '/.*'),
      new RegExp(path.resolve(__dirname, '..', '.expo') + '/.*'),
    ],
  },
};

module.exports = mergeConfig(defaultConfig, config);
