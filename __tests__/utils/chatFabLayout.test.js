import {CHAT_FAB_CLEARANCE} from '../../src/utils/chatFabLayout';

// This module exists specifically so screens can reserve scroll clearance
// for ChatFab without importing ChatFab.js itself, which pulls in Firebase
// Realtime Database, AsyncStorage and keyboard listeners - importing that
// directly from RoundResultsScreen.js once broke 17 unrelated test suites
// (util-level tests with no Firebase mock set up) purely by being on the
// import chain. This test is a tripwire: it fails loudly if this file ever
// grows a dependency that could reintroduce that problem.
describe('chatFabLayout', () => {
  it('exports a positive clearance value', () => {
    expect(CHAT_FAB_CLEARANCE).toBeGreaterThan(0);
  });

  it('has no imports of its own (stays dependency-free)', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(__dirname, '../../src/utils/chatFabLayout.js'), 'utf8');
    expect(source).not.toMatch(/^import /m);
    expect(source).not.toMatch(/require\(/);
  });
});
