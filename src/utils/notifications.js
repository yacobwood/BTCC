import {getMessaging, getToken, onMessage, requestPermission} from '@react-native-firebase/messaging';
import notifee, {AndroidImportance, AndroidStyle} from '@notifee/react-native';
import {Platform, PermissionsAndroid} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function setupNotificationChannels() {
  await notifee.createChannel({id: 'general', name: 'General', importance: AndroidImportance.HIGH});
  await notifee.createChannel({id: 'news', name: 'News Alerts', importance: AndroidImportance.HIGH});
  await notifee.createChannel({id: 'race', name: 'Race Alerts', importance: AndroidImportance.HIGH});
  await notifee.createChannel({id: 'qualifying', name: 'Qualifying Alerts', importance: AndroidImportance.HIGH});
  await notifee.createChannel({id: 'free_practice', name: 'Free Practice Alerts', importance: AndroidImportance.HIGH});
  await notifee.createChannel({id: 'results', name: 'Results Alerts', importance: AndroidImportance.HIGH});
  await notifee.createChannel({id: 'weekend_preview', name: 'Weekend Preview', importance: AndroidImportance.HIGH});
  await notifee.createChannel({id: 'standings', name: 'Standings Update', importance: AndroidImportance.HIGH});
  // Delete and recreate to force importance upgrade on existing installs
  await notifee.deleteChannel('podcasts');
  await notifee.createChannel({id: 'podcasts', name: 'Podcast Alerts', importance: AndroidImportance.HIGH});
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
    const token = await getToken(messaging);
    console.log('[FCM] Device token:', token);
    return token;
  } catch (e) { console.log('[FCM] Token error:', e); return null; }
}

export function onForegroundMessage(callback) {
  const messaging = getMessaging();
  return onMessage(messaging, async remoteMessage => {
    callback(remoteMessage);
    const {data, notification} = remoteMessage;
    // If a notification payload is present, the system already shows it — skip notifee
    if (notification) return;
    if (!data?.title) return;
    const channelId = data.channel || 'news';
    const imageUrl = data.imageUrl || null;
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
        largeIcon: 'ic_notification_large',
        circularLargeIcon: true,
        pressAction: {id: 'default'},
        ...(imageUrl ? {style: {type: AndroidStyle.BIGPICTURE, picture: imageUrl}} : {}),
      },
    });
  });
}

export async function showLocalNotification(title, body, channelId = 'news', data = {}) {
  await notifee.displayNotification({
    title, body, data,
    android: {channelId, smallIcon: 'ic_launcher', pressAction: {id: 'default'}},
  });
}

const FLAGS_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/flags.json';
const RSS_URL = 'https://rss.buzzsprout.com/1065916.rss';
const LAST_PODCAST_KEY = 'last_podcast_url';

export async function checkForNewPodcast(podcastAlertsEnabled) {
  if (!podcastAlertsEnabled) return;
  try {
    const [flagsRes, rssRes, lastUrl] = await Promise.all([
      fetch(FLAGS_URL).then(r => r.json()),
      fetch(RSS_URL, {headers: {'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'}}).then(r => r.text()),
      AsyncStorage.getItem(LAST_PODCAST_KEY).catch(() => null),
    ]);

    if (!flagsRes.podcasts_enabled) return;

    // Parse latest episode
    const match = /<item>([\s\S]*?)<\/item>/.exec(rssRes);
    if (!match) return;
    const block = match[1];
    const title = (/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/.exec(block) || /<title>([\s\S]*?)<\/title>/.exec(block) || [])[1]?.trim() || '';
    const url = /enclosure[^>]+url="([^"]+)"/.exec(block)?.[1] || '';
    if (!url || url === lastUrl) return;

    await AsyncStorage.setItem(LAST_PODCAST_KEY, url);
    await showLocalNotification(
      'New BTCC Podcast',
      title,
      'podcasts',
      {type: 'podcast', url}
    );
  } catch {}
}
