// Shared layout constants for ChatFab.js's floating button, split out into
// their own dependency-free module so screens that just need to reserve
// scroll clearance for it don't have to import ChatFab.js itself - that
// file pulls in Firebase Realtime Database, AsyncStorage and keyboard
// listeners, none of which a screen wants as a transitive dependency (and
// which broke 17 unrelated test suites with no Firebase mock set up, the
// first time this was tried by importing straight from ChatFab.js).
const FAB_SIZE = 52;
const FAB_BOTTOM_OFFSET = 12;

// How much extra bottom padding a screen's own scrollable content needs to
// clear the FAB, measured from that screen's natural bottom edge (which
// coincides with the tab bar's top edge - AppNavigator passes ChatFab the
// exact same `TAB_BAR_HEIGHT + safeAreaBottom` value it gives the tab bar's
// own height, so the FAB's footprint above that shared boundary is this
// fixed 12-64px zone regardless of device or safe-area inset). +16px is
// just visual breathing room beyond the FAB's own circle. Applied whether
// or not the FAB is actually showing for a given user (feature flag/setting
// off) - reserving a little unused scroll space costs far less than content
// actually hiding behind it when it is showing.
export const CHAT_FAB_CLEARANCE = FAB_SIZE + FAB_BOTTOM_OFFSET + 16;

export {FAB_SIZE, FAB_BOTTOM_OFFSET};
