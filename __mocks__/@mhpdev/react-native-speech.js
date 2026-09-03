// Auto-applied to every test via Jest's manual-mock resolution for
// node_modules packages (same pattern as __mocks__/@react-native-async-storage/
// - no jest.mock() call needed per test file). The package ships its own
// default mock at @mhpdev/react-native-speech/jest for exactly this purpose;
// tests that need finer control (simulating onFinish/onError, asserting on
// speak() calls) override individual static methods directly rather than
// replacing this file, see __tests__/utils/useArticleReader.test.js.
module.exports = require('@mhpdev/react-native-speech/jest');
