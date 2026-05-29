// ── React Native Testing Library ──────────────────────────────────────────────
import '@testing-library/jest-native/extend-expect';

// ── Global fetch mock ──────────────────────────────────────────────────────────
// Must be assigned before beforeEach so mockResolvedValue etc. are available
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: jest.fn(() => Promise.resolve({})),
    text: jest.fn(() => Promise.resolve('')),
  }),
);

// ── Reset between tests ────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  // Restore the default ok fetch response after clearAllMocks resets the impl
  global.fetch.mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: jest.fn(() => Promise.resolve({})),
      text: jest.fn(() => Promise.resolve('')),
    }),
  );
});

// ── Firebase Messaging ─────────────────────────────────────────────────────────
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging:              jest.fn(() => ({})),
  getToken:                  jest.fn(() => Promise.resolve('test-fcm-token')),
  onMessage:                 jest.fn(() => jest.fn()),           // returns unsubscribe fn
  requestPermission:         jest.fn(() => Promise.resolve(1)), // AUTHORIZED
  subscribeToTopic:          jest.fn(() => Promise.resolve()),
  unsubscribeFromTopic:      jest.fn(() => Promise.resolve()),
  onNotificationOpenedApp:   jest.fn(() => jest.fn()),
  getInitialNotification:    jest.fn(() => Promise.resolve(null)),
  setBackgroundMessageHandler: jest.fn(),
}));

// ── Firebase Analytics ─────────────────────────────────────────────────────────
jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics:    jest.fn(() => ({})),
  logEvent:        jest.fn(() => Promise.resolve()),
  setUserProperty: jest.fn(() => Promise.resolve()),
  setUserId:       jest.fn(() => Promise.resolve()),
}));

// ── Firebase Auth ──────────────────────────────────────────────────────────────
const mockAuthUser = {uid: 'test-uid-123', isAnonymous: true, providerData: [], email: null, displayName: null, getIdToken: jest.fn(() => Promise.resolve('test-id-token'))};
const mockAuth = {
  currentUser: mockAuthUser,
  onAuthStateChanged: jest.fn(cb => { cb(mockAuthUser); return jest.fn(); }),
  signInAnonymously: jest.fn(() => Promise.resolve({user: mockAuthUser})),
  signInWithCredential: jest.fn(() => Promise.resolve({user: {...mockAuthUser, isAnonymous: false}})),
  signInWithEmailAndPassword: jest.fn(() => Promise.resolve({user: {...mockAuthUser, isAnonymous: false}})),
  createUserWithEmailAndPassword: jest.fn(() => Promise.resolve({user: {...mockAuthUser, isAnonymous: false}})),
  signOut: jest.fn(() => Promise.resolve()),
  GoogleAuthProvider: {credential: jest.fn(() => ({providerId: 'google.com'}))},
  AppleAuthProvider: {credential: jest.fn(() => ({providerId: 'apple.com'}))},
};
jest.mock('@react-native-firebase/auth', () => {
  const fn = jest.fn(() => mockAuth);
  fn.GoogleAuthProvider = mockAuth.GoogleAuthProvider;
  fn.AppleAuthProvider = mockAuth.AppleAuthProvider;
  fn.EmailAuthProvider = {credential: jest.fn(() => ({providerId: 'password'}))};
  return {__esModule: true, default: fn};
});

// ── Google Sign-In ─────────────────────────────────────────────────────────────
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure:       jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn:          jest.fn(() => Promise.resolve({data: {idToken: 'test-id-token'}})),
  },
}));

// ── Apple Auth ─────────────────────────────────────────────────────────────────
jest.mock('@invertase/react-native-apple-authentication', () => ({
  __esModule: true,
  default: {
    performRequest: jest.fn(() => Promise.resolve({identityToken: 'test-apple-token', nonce: 'nonce'})),
    Operation: {LOGIN: 'LOGIN'},
    Scope: {EMAIL: 'EMAIL', FULL_NAME: 'FULL_NAME'},
  },
}));

// ── Firebase Crashlytics ───────────────────────────────────────────────────────
jest.mock('@react-native-firebase/crashlytics', () => ({
  getCrashlytics:                  jest.fn(() => ({})),
  setCrashlyticsCollectionEnabled: jest.fn(),
}));

// ── Notifee ────────────────────────────────────────────────────────────────────
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel:          jest.fn(() => Promise.resolve('channel-id')),
    deleteChannel:          jest.fn(() => Promise.resolve()),
    displayNotification:    jest.fn(() => Promise.resolve()),
    onForegroundEvent:      jest.fn(() => jest.fn()),  // returns unsubscribe fn
    onBackgroundEvent:      jest.fn(),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
    cancelAllNotifications: jest.fn(() => Promise.resolve()),
  },
  AndroidImportance: {HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1, NONE: 0},
  EventType: {UNKNOWN: 0, DISMISSED: 1, PRESS: 2, ACTION_PRESS: 3, DELIVERED: 4},
}));

// ── react-native-in-app-review ─────────────────────────────────────────────────
jest.mock('react-native-in-app-review', () => ({
  __esModule: true,
  default: {
    isAvailable:          jest.fn(() => true),
    RequestInAppReview:   jest.fn(() => Promise.resolve()),
  },
}));

// ── react-native-device-info ──────────────────────────────────────────────────
jest.mock('react-native-device-info', () => ({
  __esModule: true,
  default: {
    getBuildNumber:  jest.fn(() => '999'),
    getVersion:      jest.fn(() => '1.0.0'),
    getSystemVersion: jest.fn(() => '18.0'),
    isEmulator:      jest.fn(() => Promise.resolve(false)),
    getUniqueId:     jest.fn(() => Promise.resolve('test-device-id')),
    getUniqueIdSync: jest.fn(() => 'test-device-id'),
  },
}));

// ── react-native-bootsplash ────────────────────────────────────────────────────
jest.mock('react-native-bootsplash', () => ({
  __esModule: true,
  default: {hide: jest.fn(() => Promise.resolve())},
}));


// ── react-native-vector-icons ─────────────────────────────────────────────────
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');

// ── react-native-safe-area-context ────────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({children}) => children,
  SafeAreaView:     ({children}) => children,
  useSafeAreaInsets: jest.fn(() => ({top: 0, right: 0, bottom: 34, left: 0})),
}));

// ── React Navigation ───────────────────────────────────────────────────────────
jest.mock('@react-navigation/native', () => {
  const real = jest.requireActual('@react-navigation/native');
  return {
    ...real,
    NavigationContainer: ({children}) => children,
    useNavigation: jest.fn(() => ({
      navigate:     jest.fn(),
      goBack:       jest.fn(),
      dispatch:     jest.fn(),
      addListener:  jest.fn(() => jest.fn()),
      getParent:    jest.fn(() => ({addListener: jest.fn(() => jest.fn())})),
      getState:     jest.fn(() => ({routes: [{name: 'NewsFeed'}], index: 0})),
    })),
    useRoute: jest.fn(() => ({params: {}})),
    useFocusEffect: jest.fn(),
    createNavigationContainerRef: jest.fn(() => ({
      navigate: jest.fn(),
      isReady:  jest.fn(() => true),
      current:  null,
    })),
    CommonActions: {reset: jest.fn(v => v)},
  };
});

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({children}) => children,
    Screen:    () => null,
  }),
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({children}) => children,
    Screen:    () => null,
  }),
}));

// ── react-native-track-player ─────────────────────────────────────────────────
jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    setupPlayer:             jest.fn(() => Promise.resolve()),
    add:                     jest.fn(() => Promise.resolve()),
    play:                    jest.fn(() => Promise.resolve()),
    pause:                   jest.fn(() => Promise.resolve()),
    stop:                    jest.fn(() => Promise.resolve()),
    reset:                   jest.fn(() => Promise.resolve()),
    getState:                jest.fn(() => Promise.resolve('none')),
    registerPlaybackService: jest.fn(),
  },
  State:      {Playing: 'playing', Paused: 'paused', Stopped: 'stopped', None: 'none'},
  Event:      {RemotePlay: 'remote-play', RemotePause: 'remote-pause', RemoteStop: 'remote-stop'},
  Capability: {Play: 1, Pause: 2, Stop: 3},
  usePlaybackState: jest.fn(() => ({state: 'none'})),
  useProgress:      jest.fn(() => ({position: 0, duration: 0, buffered: 0})),
}));

// ── react-native-webview ──────────────────────────────────────────────────────
jest.mock('react-native-webview', () => ({WebView: 'WebView'}));

// ── react-native Image static methods ─────────────────────────────────────────
// The preset leaves Image.prefetch/getSize undefined — patch them here so
// code that calls Image.prefetch() doesn't crash. Do NOT mock the whole
// Image module (that would break ImageBackground which imports Image internally).
const RNImage = require('react-native').Image;
if (RNImage && !RNImage.prefetch) {
  RNImage.prefetch = jest.fn(() => Promise.resolve(true));
}
if (RNImage && !RNImage.getSize) {
  RNImage.getSize = jest.fn();
}

// ── react-native-svg ──────────────────────────────────────────────────────────
// Use component stubs (not strings) so SVG containers that wrap children render cleanly.
jest.mock('react-native-svg', () => {
  const React = require('react');
  const {View, Text} = require('react-native');
  const Stub = ({children}) => React.createElement(View, null, children);
  const TextStub = ({children}) => React.createElement(Text, null, children);
  return {
    __esModule: true,
    default: Stub,
    Svg: Stub, Circle: Stub, Ellipse: Stub, G: Stub,
    Line: Stub, Path: Stub, Polygon: Stub, Polyline: Stub,
    Rect: Stub, Use: Stub, Image: Stub, Symbol: Stub,
    Defs: Stub, LinearGradient: Stub, RadialGradient: Stub,
    Stop: Stub, ClipPath: Stub, Pattern: Stub, Mask: Stub,
    Text: TextStub, TSpan: TextStub, TextPath: Stub,
  };
});

// ── App navigationRef ─────────────────────────────────────────────────────────
jest.mock('./App', () => ({
  navigationRef: {navigate: jest.fn(), isReady: jest.fn(() => true), current: null},
}), {virtual: true});

// ── Lightweight component stubs ───────────────────────────────────────────────
jest.mock('./src/components/CachedImage', () => {
  const React = require('react');
  const {Image} = require('react-native');
  const CachedImage = ({uri, style}) => React.createElement(Image, {source: {uri}, style, testID: 'cached-image'});
  return {
    __esModule: true,
    default: CachedImage,
    prefetchImages: jest.fn(),
  };
});
jest.mock('./src/components/ProgressionChart', () => ({__esModule: true, default: () => null}));

// ── Asset stubs ───────────────────────────────────────────────────────────────
jest.mock('./src/assets/driverImages', () => ({getDriverImage: () => null}));
jest.mock('./src/assets/teamImages', () => ({getTeamImage: () => null}));
jest.mock('./src/assets/seasonData', () => ({getSeasonData: jest.fn(() => null)}));
jest.mock('./src/utils/notifications', () => ({
  setupNotificationChannels: jest.fn(() => Promise.resolve()),
  requestNotificationPermission: jest.fn(() => Promise.resolve(true)),
  getFCMToken: jest.fn(() => Promise.resolve('test-token')),
  onForegroundMessage: jest.fn(() => jest.fn()),
  checkForNewPodcast: jest.fn(() => Promise.resolve()),
  showLocalNotification: jest.fn(() => Promise.resolve()),
}));
