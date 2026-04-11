import {AppRegistry, Platform} from 'react-native';
import {getMessaging, setBackgroundMessageHandler} from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import App from './App';
import {name as appName} from './app.json';

const TrackPlayer = Platform.OS === 'ios' ? require('react-native-track-player').default : null;

if (Platform.OS === 'android') {
  const messaging = getMessaging();
  setBackgroundMessageHandler(messaging, async remoteMessage => {
    // Background messages handled by system tray
  });
}

// Required by notifee — must be registered before the app starts.
// Navigation is handled via notifee.getInitialNotification() in App.tsx
// which reads the press data from notifee's native layer (no race condition).
notifee.onBackgroundEvent(async () => {});

AppRegistry.registerComponent(appName, () => App);
if (Platform.OS === 'ios' && TrackPlayer) {
  TrackPlayer.registerPlaybackService(() => async () => {});
}
