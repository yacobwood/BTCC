import {AppRegistry, Platform} from 'react-native';
import {getMessaging, setBackgroundMessageHandler} from '@react-native-firebase/messaging';
import notifee, {AndroidStyle} from '@notifee/react-native';
import App from './App';
import {name as appName} from './app.json';

const TrackPlayer = Platform.OS === 'ios' ? require('react-native-track-player').default : null;

if (Platform.OS === 'android') {
  const messaging = getMessaging();
  setBackgroundMessageHandler(messaging, async remoteMessage => {
    const {data} = remoteMessage;
    if (!data?.title) return;
    const channelId = data.channel || 'news';
    const imageUrl = data.imageUrl || null;
    // Broadcasts use 'general' channel and have title + body separately;
    // article/podcast messages use data.title as the notification body
    const isGeneral = channelId === 'general';
    const notifTitle = isGeneral ? data.title : (channelId === 'podcasts' ? 'New Podcast' : 'New Article');
    const notifBody = isGeneral ? (data.body || '') : data.title;
    await notifee.displayNotification({
      title: notifTitle,
      body: notifBody,
      data,
      android: {
        channelId,
        smallIcon: 'ic_launcher',
        largeIcon: 'ic_launcher',
        circularLargeIcon: true,
        pressAction: {id: 'default'},
        ...(imageUrl ? {style: {type: AndroidStyle.BIGPICTURE, picture: imageUrl}} : {}),
      },
    });
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
