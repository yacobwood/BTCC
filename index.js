import {AppRegistry, Platform} from 'react-native';
import {getMessaging, setBackgroundMessageHandler} from '@react-native-firebase/messaging';
import notifee, {AndroidStyle, EventType} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App, {navigationRef} from './App';
import {handleNotificationOpen} from './src/utils/notifNavigation';
import {name as appName} from './app.json';

const TrackPlayer = Platform.OS === 'ios' ? require('react-native-track-player').default : null;

if (Platform.OS === 'android') {
  const messaging = getMessaging();
  setBackgroundMessageHandler(messaging, async remoteMessage => {
    const {data} = remoteMessage;
    // Silent cache-invalidation from scraper — no notification, just bust the cache.
    if (data?.type === 'results_refresh') {
      const year = data.year || '2026';
      await AsyncStorage.removeItem(`cache_results_${year}`).catch(() => {});
      return;
    }
    if (!data?.title) return;
    const channelId = data.channel || 'news';
    const imageUrl = data.imageUrl || null;
    // Broadcasts use 'general' channel and have title + body separately;
    // article/podcast messages use data.title as the notification body
    // If data.body present: custom/broadcast with explicit title+body
    // Otherwise: scraper-style where data.title is the article title (used as body)
    const notifTitle = data.body ? data.title : (channelId === 'podcasts' ? 'New Podcast' : 'New Article');
    const notifBody = data.body || data.title;
    await notifee.displayNotification({
      title: notifTitle,
      body: notifBody,
      data,
      android: {
        channelId,
        smallIcon: 'ic_notification',
        largeIcon: 'ic_notification_large',
        circularLargeIcon: true,
        pressAction: {id: 'default'},
        ...(imageUrl ? {style: {type: AndroidStyle.BIGPICTURE, picture: imageUrl}} : {}),
      },
    });
  });
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
