import React from 'react';
import {act, create} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {subscribeToTopic, unsubscribeFromTopic} from '@react-native-firebase/messaging';
import {SettingsProvider, useSettings} from '../../src/store/settings';

// All leaf keys that map to FCM topics
const LEAF_TOPICS = {
  newsAlerts:        'news_alerts',
  weekendPreview:    'weekend_preview',
  standingsUpdate:   'standings_update',
  podcastAlerts:     'podcast_alerts',
  preRaceFP:         'pre_fp',
  preRaceQualifying: 'pre_qualifying',
  preRaceQRace:      'pre_qrace',
  preRaceRace1:      'pre_race1',
  preRaceRace2:      'pre_race2',
  preRaceRace3:      'pre_race3',
  resultsFP:         'results_fp',
  resultsQualifying: 'results_qualifying',
  resultsQRace:      'results_qrace',
  resultsRace1:      'results_race1',
  resultsRace2:      'results_race2',
  resultsRace3:      'results_race3',
};

const PARENT_KEYS = [
  'preRace', 'preRaceRace', 'results', 'resultsRace',
];

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
    it('all leaf settings default to true before AsyncStorage loads', () => {
      let getHook;
      act(() => {
        getHook = renderProvider();
      });
      for (const key of Object.keys(LEAF_TOPICS)) {
        expect(getHook().settings[key]).toBe(true);
      }
    });

    it('all parent settings default to true', () => {
      let getHook;
      act(() => {
        getHook = renderProvider();
      });
      for (const key of PARENT_KEYS) {
        expect(getHook().settings[key]).toBe(true);
      }
    });

    it('hubPreview defaults to false', () => {
      let getHook;
      act(() => {
        getHook = renderProvider();
      });
      expect(getHook().settings.hubPreview).toBe(false);
    });
  });

  describe('persistence load', () => {
    it('loads a stored leaf setting and applies it', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'setting_news_alerts') return Promise.resolve('false');
        return Promise.resolve(null);
      });

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      expect(getHook().settings.newsAlerts).toBe(false);
      expect(getHook().settings.preRaceFP).toBe(true);
    });

    it('loads a stored parent setting and applies it', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'setting_pre_race') return Promise.resolve('false');
        return Promise.resolve(null);
      });

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      expect(getHook().settings.preRace).toBe(false);
    });
  });

  describe('legacy migration', () => {
    it('migrates setting_race_alerts=false into pre-race race sub-settings', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'setting_race_alerts') return Promise.resolve('false');
        return Promise.resolve(null);
      });

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      expect(getHook().settings.preRaceRace).toBe(false);
      expect(getHook().settings.preRaceRace1).toBe(false);
      expect(getHook().settings.preRaceRace2).toBe(false);
      expect(getHook().settings.preRaceRace3).toBe(false);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('setting_race_alerts');
    });

    it('migrates setting_results_alerts=false into all results sub-settings', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'setting_results_alerts') return Promise.resolve('false');
        return Promise.resolve(null);
      });

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      expect(getHook().settings.results).toBe(false);
      expect(getHook().settings.resultsRace1).toBe(false);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('setting_results_alerts');
    });
  });

  describe('FCM topic sync on load', () => {
    it('subscribes to all leaf topics when all settings are enabled', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);

      await act(async () => {
        renderProvider();
      });

      for (const topic of Object.values(LEAF_TOPICS)) {
        expect(subscribeToTopic).toHaveBeenCalledWith(expect.anything(), topic);
      }
    });

    it('unsubscribes a leaf topic when its setting is disabled', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'setting_pre_race_fp') return Promise.resolve('false');
        return Promise.resolve(null);
      });

      await act(async () => {
        renderProvider();
      });

      expect(unsubscribeFromTopic).toHaveBeenCalledWith(expect.anything(), 'pre_fp');
      expect(subscribeToTopic).toHaveBeenCalledWith(expect.anything(), 'news_alerts');
    });

    it('unsubscribes child leaf topics when parent is disabled', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'setting_pre_race') return Promise.resolve('false');
        return Promise.resolve(null);
      });

      await act(async () => {
        renderProvider();
      });

      // All pre-race leaf topics should be unsubscribed
      expect(unsubscribeFromTopic).toHaveBeenCalledWith(expect.anything(), 'pre_fp');
      expect(unsubscribeFromTopic).toHaveBeenCalledWith(expect.anything(), 'pre_qualifying');
      expect(unsubscribeFromTopic).toHaveBeenCalledWith(expect.anything(), 'pre_race1');
      // Unrelated topics should still be subscribed
      expect(subscribeToTopic).toHaveBeenCalledWith(expect.anything(), 'news_alerts');
    });

    it('unsubscribes race sub-topics when race sub-parent is disabled', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'setting_pre_race_race') return Promise.resolve('false');
        return Promise.resolve(null);
      });

      await act(async () => {
        renderProvider();
      });

      expect(unsubscribeFromTopic).toHaveBeenCalledWith(expect.anything(), 'pre_race1');
      expect(unsubscribeFromTopic).toHaveBeenCalledWith(expect.anything(), 'pre_race2');
      expect(unsubscribeFromTopic).toHaveBeenCalledWith(expect.anything(), 'pre_race3');
      // Other pre-race topics not affected
      expect(subscribeToTopic).toHaveBeenCalledWith(expect.anything(), 'pre_fp');
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
        getHook().setSetting('preRaceRace1', false);
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('setting_pre_race_race1', 'false');
    });

    it('unsubscribes from topic when leaf setting disabled', async () => {
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        getHook().setSetting('resultsRace2', false);
      });

      expect(unsubscribeFromTopic).toHaveBeenCalledWith(expect.anything(), 'results_race2');
    });

    it('subscribes to topic when leaf setting re-enabled', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'setting_results_fp') return Promise.resolve('false');
        return Promise.resolve(null);
      });
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        getHook().setSetting('resultsFP', true);
      });

      expect(subscribeToTopic).toHaveBeenCalledWith(expect.anything(), 'results_fp');
    });

    it('disabling parent unsubscribes children even if children are individually enabled', async () => {
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        getHook().setSetting('results', false);
      });

      expect(unsubscribeFromTopic).toHaveBeenCalledWith(expect.anything(), 'results_fp');
      expect(unsubscribeFromTopic).toHaveBeenCalledWith(expect.anything(), 'results_race1');
    });

    it('re-enabling parent re-subscribes individually enabled children', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'setting_results') return Promise.resolve('false');
        return Promise.resolve(null);
      });
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        getHook().setSetting('results', true);
      });

      expect(subscribeToTopic).toHaveBeenCalledWith(expect.anything(), 'results_fp');
      expect(subscribeToTopic).toHaveBeenCalledWith(expect.anything(), 'results_race1');
    });
  });
});
