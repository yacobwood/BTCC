import {AppRegistry} from 'react-native';
import {getMessaging, setBackgroundMessageHandler} from '@react-native-firebase/messaging';
import App from './App';
import {name as appName} from './app.json';

const messaging = getMessaging();
setBackgroundMessageHandler(messaging, async remoteMessage => {
  // Background messages handled by system tray
});

AppRegistry.registerComponent(appName, () => App);
