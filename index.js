import {AppRegistry, LogBox, Platform} from 'react-native';
import {getMessaging, setBackgroundMessageHandler} from '@react-native-firebase/messaging';
import notifee, {EventType} from '@notifee/react-native';
import App, {navigationRef} from './App';
import {handleNotificationOpen} from './src/utils/notifNavigation';
import {displayAndroidDataNotification} from './src/utils/notifications';
import {name as appName} from './app.json';

// Suppresses both the in-app yellow-box warning overlay and the "Open
// debugger to view warnings" notification banner during dev testing -
// dev-only (LogBox is a no-op in release builds regardless). Runs before
// AppRegistry.registerComponent, i.e. before the app ever renders, so it's
// active for every warning the app itself can trigger.
if (__DEV__) {
  LogBox.ignoreAllLogs(true);
}

const TrackPlayer = Platform.OS === 'ios' ? require('react-native-track-player').default : null;

if (Platform.OS === 'android') {
  const messaging = getMessaging();
  // Display logic lives in src/utils/notifications.js, shared with the
  // foreground path (onForegroundMessage) - see displayAndroidDataNotification
  // for why this can't be duplicated here.
  setBackgroundMessageHandler(messaging, remoteMessage => displayAndroidDataNotification(remoteMessage));
}

// Required by notifee - must be registered before the app starts.
// This is NOT redundant with App.tsx's notifee.getInitialNotification() polling:
// that API only ever reports the notification that cold-started the app (killed
// -> tapped -> launched). It does not, and structurally cannot, fire again for a
// notification tapped while the app is merely backgrounded (still alive, just not
// foreground) - that's exactly what this handler is for. Previously a no-op stub,
// which meant a background-state tap just foregrounded the app with no navigation
// at all - fixed 2026-08-12.
notifee.onBackgroundEvent(async ({type, detail}) => {
  if (type === EventType.PRESS) {
    handleNotificationOpen(navigationRef, detail.notification?.data);
  }
});

AppRegistry.registerComponent(appName, () => App);
if (Platform.OS === 'ios' && TrackPlayer) {
  TrackPlayer.registerPlaybackService(() => async () => {});
}
