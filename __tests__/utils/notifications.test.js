// This file tests the notifications module itself — unmock it so the real
// implementation is loaded instead of the global stub in jest.setup.js.
jest.unmock('../../src/utils/notifications');

import {Platform, PermissionsAndroid} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {AndroidImportance} from '@notifee/react-native';
import {
  getMessaging,
  getToken,
  onMessage,
  requestPermission,
} from '@react-native-firebase/messaging';
import {
  setupNotificationChannels,
  requestNotificationPermission,
  getFCMToken,
  onForegroundMessage,
  checkForNewPodcast,
  showLocalNotification,
} from '../../src/utils/notifications';

// ── setupNotificationChannels ──────────────────────────────────────────────────
describe('setupNotificationChannels', () => {
  it('creates all 9 notification channels', async () => {
    await setupNotificationChannels();
    expect(notifee.createChannel).toHaveBeenCalledTimes(9);
  });

  it('creates channel with id "news"', async () => {
    await setupNotificationChannels();
    expect(notifee.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({id: 'news', importance: AndroidImportance.HIGH}),
    );
  });

  it('creates channel with id "podcasts" at HIGH importance', async () => {
    await setupNotificationChannels();
    expect(notifee.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({id: 'podcasts', importance: AndroidImportance.HIGH}),
    );
  });

  const HIGH_CHANNELS = ['news', 'race', 'qualifying', 'free_practice', 'results', 'weekend_preview', 'standings'];
  HIGH_CHANNELS.forEach(id => {
    it(`channel "${id}" has HIGH importance`, async () => {
      await setupNotificationChannels();
      expect(notifee.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({id, importance: AndroidImportance.HIGH}),
      );
    });
  });
});

// ── requestNotificationPermission ─────────────────────────────────────────────
describe('requestNotificationPermission', () => {
  // Helper to override Platform.OS (the property may not be directly assignable
  // in the react-native test environment, so we use Object.defineProperty)
  function setPlatform(os, version = 0) {
    Object.defineProperty(Platform, 'OS', {get: () => os, configurable: true});
    Object.defineProperty(Platform, 'Version', {get: () => version, configurable: true});
  }

  afterEach(() => {
    // Restore to ios default
    setPlatform('ios', 0);
  });

  it('requests Android POST_NOTIFICATIONS on Android >= 33', async () => {
    setPlatform('android', 33);
    PermissionsAndroid.request = jest.fn(() =>
      Promise.resolve(PermissionsAndroid.RESULTS.GRANTED),
    );

    const result = await requestNotificationPermission();

    expect(PermissionsAndroid.request).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    expect(result).toBe(true);
  });

  it('returns false when Android permission denied', async () => {
    setPlatform('android', 33);
    PermissionsAndroid.request = jest.fn(() =>
      Promise.resolve(PermissionsAndroid.RESULTS.DENIED),
    );

    const result = await requestNotificationPermission();
    expect(result).toBe(false);
  });

  it('skips Android permission request on Android < 33 and uses FCM instead', async () => {
    setPlatform('android', 28);
    requestPermission.mockResolvedValueOnce(1);

    const result = await requestNotificationPermission();

    // PermissionsAndroid.request not expected for android < 33
    expect(requestPermission).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('uses FCM requestPermission on iOS', async () => {
    setPlatform('ios');
    requestPermission.mockResolvedValueOnce(1); // AUTHORIZED

    const result = await requestNotificationPermission();

    expect(requestPermission).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('returns true for PROVISIONAL (2) on iOS', async () => {
    setPlatform('ios');
    requestPermission.mockResolvedValueOnce(2); // PROVISIONAL

    expect(await requestNotificationPermission()).toBe(true);
  });

  it('returns false for DENIED (0) on iOS', async () => {
    setPlatform('ios');
    requestPermission.mockResolvedValueOnce(0);

    expect(await requestNotificationPermission()).toBe(false);
  });
});

// ── getFCMToken ────────────────────────────────────────────────────────────────
describe('getFCMToken', () => {
  it('returns the token from Firebase', async () => {
    getToken.mockResolvedValueOnce('abc123token');
    const token = await getFCMToken();
    expect(token).toBe('abc123token');
  });

  it('returns null when getToken throws', async () => {
    getToken.mockRejectedValueOnce(new Error('no permission'));
    const token = await getFCMToken();
    expect(token).toBeNull();
  });
});

// ── onForegroundMessage ────────────────────────────────────────────────────────
describe('onForegroundMessage', () => {
  it('subscribes to FCM onMessage', () => {
    const cb = jest.fn();
    onForegroundMessage(cb);
    expect(onMessage).toHaveBeenCalledWith(expect.anything(), expect.any(Function));
  });

  it('returns the unsubscribe function', () => {
    const unsub = jest.fn();
    onMessage.mockReturnValueOnce(unsub);
    const result = onForegroundMessage(jest.fn());
    expect(result).toBe(unsub);
  });

  it('calls notifee.displayNotification with the FCM data payload', async () => {
    let capturedHandler;
    onMessage.mockImplementationOnce((_, handler) => {
      capturedHandler = handler;
      return jest.fn();
    });

    onForegroundMessage(jest.fn());

    // Data-only message (no notification key) — notifee handles the display
    const remoteMessage = {
      data: {channel: 'race', type: 'round', round: '1', title: 'Race starting!'},
    };
    await capturedHandler(remoteMessage);

    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        data: remoteMessage.data,
        android: expect.objectContaining({channelId: 'race'}),
      }),
    );
  });

  it('falls back to "news" channel when no channel in data', async () => {
    let capturedHandler;
    onMessage.mockImplementationOnce((_, handler) => {
      capturedHandler = handler;
      return jest.fn();
    });

    onForegroundMessage(jest.fn());
    // Data-only message with a title but no channel
    await capturedHandler({data: {title: 'News headline'}});

    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        android: expect.objectContaining({channelId: 'news'}),
      }),
    );
  });

  it('invokes the callback with the remote message', async () => {
    let capturedHandler;
    onMessage.mockImplementationOnce((_, handler) => {
      capturedHandler = handler;
      return jest.fn();
    });

    const userCallback = jest.fn();
    onForegroundMessage(userCallback);

    const msg = {notification: {title: 'T', body: 'B'}, data: {}};
    await capturedHandler(msg);

    expect(userCallback).toHaveBeenCalledWith(msg);
  });
});

// ── showLocalNotification ──────────────────────────────────────────────────────
describe('showLocalNotification', () => {
  it('calls notifee.displayNotification with correct args', async () => {
    await showLocalNotification('Title', 'Body', 'podcasts', {type: 'podcast'});

    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Title',
        body: 'Body',
        data: {type: 'podcast'},
        android: expect.objectContaining({channelId: 'podcasts'}),
      }),
    );
  });

  it('defaults channelId to "news"', async () => {
    await showLocalNotification('T', 'B');
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({android: expect.objectContaining({channelId: 'news'})}),
    );
  });
});

// ── checkForNewPodcast ─────────────────────────────────────────────────────────
const PODCAST_RSS = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title><![CDATA[Episode 42 - Race Review]]></title>
    <enclosure url="https://buzzsprout.com/1065916/ep42.mp3" type="audio/mpeg" length="12345"/>
  </item>
</channel></rss>`;

describe('checkForNewPodcast', () => {
  it('does nothing when podcastAlertsEnabled is false', async () => {
    await checkForNewPodcast(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does nothing when flags.podcasts_enabled is false', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('flags.json')) {
        return Promise.resolve({ok: true, json: () => Promise.resolve({podcasts_enabled: false})});
      }
      return Promise.resolve({ok: true, text: () => Promise.resolve(PODCAST_RSS)});
    });

    await checkForNewPodcast(true);

    expect(notifee.displayNotification).not.toHaveBeenCalled();
  });

  it('shows a notification for a new episode URL', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('flags.json')) {
        return Promise.resolve({ok: true, json: () => Promise.resolve({podcasts_enabled: true})});
      }
      return Promise.resolve({ok: true, text: () => Promise.resolve(PODCAST_RSS)});
    });
    AsyncStorage.getItem.mockResolvedValue(null); // no previously seen URL

    await checkForNewPodcast(true);

    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New BTCC Podcast',
        body: 'Episode 42 - Race Review',
        data: expect.objectContaining({type: 'podcast'}),
        android: expect.objectContaining({channelId: 'podcasts'}),
      }),
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'last_podcast_url',
      'https://buzzsprout.com/1065916/ep42.mp3',
    );
  });

  it('does NOT show notification when episode URL matches the last seen URL', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('flags.json')) {
        return Promise.resolve({ok: true, json: () => Promise.resolve({podcasts_enabled: true})});
      }
      return Promise.resolve({ok: true, text: () => Promise.resolve(PODCAST_RSS)});
    });
    // Same URL already seen
    AsyncStorage.getItem.mockResolvedValue('https://buzzsprout.com/1065916/ep42.mp3');

    await checkForNewPodcast(true);

    expect(notifee.displayNotification).not.toHaveBeenCalled();
  });

  it('does not throw when fetch fails', async () => {
    global.fetch.mockRejectedValue(new Error('network down'));
    await expect(checkForNewPodcast(true)).resolves.toBeUndefined();
  });

  it('does not show notification when RSS has no items', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('flags.json')) {
        return Promise.resolve({ok: true, json: () => Promise.resolve({podcasts_enabled: true})});
      }
      return Promise.resolve({ok: true, text: () => Promise.resolve('<rss><channel></channel></rss>')});
    });

    await checkForNewPodcast(true);

    expect(notifee.displayNotification).not.toHaveBeenCalled();
  });
});
