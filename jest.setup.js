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

// ── react-native-bootsplash ────────────────────────────────────────────────────
jest.mock('react-native-bootsplash', () => ({
  __esModule: true,
  default: {hide: jest.fn(() => Promise.resolve())},
}));

// ── react-native-google-mobile-ads ────────────────────────────────────────────
jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: jest.fn(() => ({initialize: jest.fn(() => Promise.resolve())})),
  BannerAd: 'BannerAd',
  BannerAdSize: {BANNER: 'BANNER', MEDIUM_RECTANGLE: 'MEDIUM_RECTANGLE'},
  TestIds: {BANNER: 'ca-app-pub-test/banner'},
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
    useFocusEffect: jest.fn((cb) => { cb(); }),
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
jest.mock('react-native-svg', () => ({
  Svg: 'Svg', Path: 'Path', Circle: 'Circle',
  Line: 'Line', Text: 'SvgText', G: 'G', Polyline: 'Polyline',
}));

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
jest.mock('./src/components/AdBanner', () => ({__esModule: true, default: () => null}));
jest.mock('./src/components/AdSearchBanner', () => ({__esModule: true, default: () => null}));
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
