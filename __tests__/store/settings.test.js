import React from 'react';
import {act, create} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {subscribeToTopic, unsubscribeFromTopic} from '@react-native-firebase/messaging';
import {SettingsProvider, useSettings} from '../../src/store/settings';

const ALL_DEFAULT_ON = {
  newsAlerts: true, raceAlerts: true, qualifyingAlerts: true,
  fpAlerts: true, resultsAlerts: true, weekendPreview: true,
  standingsUpdate: true, podcastAlerts: true,
};

const TOPIC_MAP = {
  newsAlerts: 'news_alerts', raceAlerts: 'race_alerts',
  qualifyingAlerts: 'qualifying_alerts', fpAlerts: 'fp_alerts',
  resultsAlerts: 'results_alerts', weekendPreview: 'weekend_preview',
  standingsUpdate: 'standings_update',
};

function renderProvider() {
  let hook;
  function Tester() {
    hook = useSettings();
    return null;
  }
  create(
    <SettingsProvider>
      <Tester />
    </SettingsProvider>
  );
  return () => hook;
}

describe('SettingsProvider', () => {
  describe('defaults', () => {
    it('all settings default to true before AsyncStorage loads', async () => {
      // Keep AsyncStorage returning null (default mock)
      let getHook;
      // Don't await so we get the initial render before async load
      act(() => {
        getHook = renderProvider();
      });
      expect(getHook().settings).toEqual(ALL_DEFAULT_ON);
    });
  });

  describe('persistence load', () => {
    it('loads stored settings and applies them', async () => {
      // newsAlerts stored as 'false'
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'setting_news_alerts') return Promise.resolve('false');
        return Promise.resolve(null);
      });

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      expect(getHook().settings.newsAlerts).toBe(false);
      // Other settings remain true (null → default)
      expect(getHook().settings.raceAlerts).toBe(true);
    });
  });

  describe('FCM topic sync on load', () => {
    it('subscribes to topics that are enabled in storage', async () => {
      AsyncStorage.getItem.mockResolvedValue(null); // all default true

      await act(async () => {
        renderProvider();
      });

      // All 7 FCM topics should have been subscribed on mount
      Object.values(TOPIC_MAP).forEach(topic => {
        expect(subscribeToTopic).toHaveBeenCalledWith(expect.anything(), topic);
      });
    });

    it('unsubscribes from topics that are disabled in storage', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'setting_race_alerts') return Promise.resolve('false');
        return Promise.resolve(null);
      });

      await act(async () => {
        renderProvider();
      });

      expect(unsubscribeFromTopic).toHaveBeenCalledWith(expect.anything(), 'race_alerts');
      expect(subscribeToTopic).toHaveBeenCalledWith(expect.anything(), 'news_alerts');
    });
  });

  describe('setSetting', () => {
    it('updates the setting in state', async () => {
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        getHook().setSetting('newsAlerts', false);
      });

      expect(getHook().settings.newsAlerts).toBe(false);
    });

    it('persists the new value to AsyncStorage', async () => {
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        getHook().setSetting('raceAlerts', false);
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('setting_race_alerts', 'false');
    });

    it('calls unsubscribeFromTopic when setting disabled', async () => {
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        getHook().setSetting('qualifyingAlerts', false);
      });

      expect(unsubscribeFromTopic).toHaveBeenCalledWith(expect.anything(), 'qualifying_alerts');
    });

    it('calls subscribeToTopic when setting enabled', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'setting_fp_alerts') return Promise.resolve('false');
        return Promise.resolve(null);
      });
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        getHook().setSetting('fpAlerts', true);
      });

      expect(subscribeToTopic).toHaveBeenCalledWith(expect.anything(), 'fp_alerts');
    });

    it('does NOT call topic sync for podcastAlerts (not in FCM TOPIC_MAP)', async () => {
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });
      const callsBefore = subscribeToTopic.mock.calls.length + unsubscribeFromTopic.mock.calls.length;

      await act(async () => {
        getHook().setSetting('podcastAlerts', false);
      });

      const callsAfter = subscribeToTopic.mock.calls.length + unsubscribeFromTopic.mock.calls.length;
      expect(callsAfter).toBe(callsBefore); // no extra calls
    });
  });
});
