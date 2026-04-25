module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['./jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.{js,ts,tsx}', '**/?(*.)+(spec|test).{js,ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-vector-icons|react-native-safe-area-context|react-native-bootsplash|@notifee|react-native-in-app-review|react-native-google-mobile-ads|react-native-track-player|react-native-webview|react-native-svg)/)',
  ],
};
