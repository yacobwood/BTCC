import {getMessaging, getToken, onMessage, requestPermission} from '@react-native-firebase/messaging';
import notifee, {AndroidImportance} from '@notifee/react-native';
import {Platform, PermissionsAndroid} from 'react-native';

export async function setupNotificationChannels() {
  await notifee.createChannel({id: 'news', name: 'News Alerts', importance: AndroidImportance.HIGH});
  await notifee.createChannel({id: 'race', name: 'Race Alerts', importance: AndroidImportance.HIGH});
  await notifee.createChannel({id: 'qualifying', name: 'Qualifying Alerts', importance: AndroidImportance.HIGH});
  await notifee.createChannel({id: 'free_practice', name: 'Free Practice Alerts', importance: AndroidImportance.HIGH});
  await notifee.createChannel({id: 'results', name: 'Results Alerts', importance: AndroidImportance.HIGH});
  await notifee.createChannel({id: 'weekend_preview', name: 'Weekend Preview', importance: AndroidImportance.HIGH});
  await notifee.createChannel({id: 'standings', name: 'Standings Update', importance: AndroidImportance.HIGH});
}

export async function requestNotificationPermission() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  const messaging = getMessaging();
  const authStatus = await requestPermission(messaging);
  return authStatus === 1 || authStatus === 2; // AUTHORIZED or PROVISIONAL
}

export async function getFCMToken() {
  try {
    const messaging = getMessaging();
    return await getToken(messaging);
  } catch { return null; }
}

export function onForegroundMessage(callback) {
  const messaging = getMessaging();
  return onMessage(messaging, async remoteMessage => {
    callback(remoteMessage);
    const channelId = remoteMessage.data?.channel || 'news';
    await notifee.displayNotification({
      title: remoteMessage.notification?.title || 'BTCC Hub',
      body: remoteMessage.notification?.body || '',
      android: {channelId, smallIcon: 'ic_launcher', pressAction: {id: 'default'}},
    });
  });
}

export async function showLocalNotification(title, body, channelId = 'news', data = {}) {
  await notifee.displayNotification({
    title, body, data,
    android: {channelId, smallIcon: 'ic_launcher', pressAction: {id: 'default'}},
  });
}
