import React from 'react';
import {act, create} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {subscribeToTopic, unsubscribeFromTopic} from '@react-native-firebase/messaging';
import {SettingsProvider, useSettings} from '../../src/store/settings';

jest.mock('../../src/store/auth', () => ({
  useAuth: jest.fn(() => ({user: null, isAnonymous: true})),
}));
jest.mock('../../src/utils/userProfile', () => ({
  saveProfile: jest.fn(() => Promise.resolve()),
}));

// All leaf keys that map to FCM topics
const LEAF_TOPICS = {
  newsAlerts:        'news_alerts',
  digestAlerts:      'digest_alerts',
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

  describe('digestAlerts', () => {
    it('defaults to true', () => {
      let getHook;
      act(() => { getHook = renderProvider(); });
      expect(getHook().settings.digestAlerts).toBe(true);
    });

    it('subscribes to digest_alerts topic by default', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      await act(async () => { renderProvider(); });
      expect(subscribeToTopic).toHaveBeenCalledWith(expect.anything(), 'digest_alerts');
    });

    it('disabling digestAlerts unsubscribes from digest_alerts topic', async () => {
      let getHook;
      await act(async () => { getHook = renderProvider(); });
      await act(async () => { getHook().setSetting('digestAlerts', false); });
      expect(unsubscribeFromTopic).toHaveBeenCalledWith(expect.anything(), 'digest_alerts');
    });

    it('persists digestAlerts to AsyncStorage', async () => {
      let getHook;
      await act(async () => { getHook = renderProvider(); });
      await act(async () => { getHook().setSetting('digestAlerts', false); });
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('setting_digest_alerts', 'false');
    });

    it('loads digestAlerts=false from storage', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'setting_digest_alerts') return Promise.resolve('false');
        return Promise.resolve(null);
      });
      let getHook;
      await act(async () => { getHook = renderProvider(); });
      expect(getHook().settings.digestAlerts).toBe(false);
    });
  });

  describe('spoilerFree', () => {
    it('defaults to false', () => {
      let getHook;
      act(() => { getHook = renderProvider(); });
      expect(getHook().settings.spoilerFree).toBe(false);
    });

    it('enabling spoilerFree sets spoilerFreeExpiry to a future ISO date string', async () => {
      let getHook;
      await act(async () => { getHook = renderProvider(); });
      await act(async () => { getHook().setSetting('spoilerFree', true); });
      const expiry = getHook().settings.spoilerFreeExpiry;
      expect(typeof expiry).toBe('string');
      expect(new Date(expiry).getTime()).toBeGreaterThan(Date.now());
    });

    it('enabling spoilerFree sets spoilerFreeExpiry to a Monday at 23:00', async () => {
      let getHook;
      await act(async () => { getHook = renderProvider(); });
      await act(async () => { getHook().setSetting('spoilerFree', true); });
      const expiry = new Date(getHook().settings.spoilerFreeExpiry);
      expect(expiry.getDay()).toBe(1);   // Monday
      expect(expiry.getHours()).toBe(23);
      expect(expiry.getMinutes()).toBe(0);
    });

    it('enabling spoilerFree persists expiry to AsyncStorage', async () => {
      let getHook;
      await act(async () => { getHook = renderProvider(); });
      await act(async () => { getHook().setSetting('spoilerFree', true); });
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'setting_spoiler_free_expiry',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      );
    });

    it('disabling spoilerFree clears spoilerFreeExpiry', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'setting_spoiler_free') return Promise.resolve('true');
        if (key === 'setting_spoiler_free_expiry') return Promise.resolve(new Date(Date.now() + 86400000).toISOString());
        return Promise.resolve(null);
      });
      let getHook;
      await act(async () => { getHook = renderProvider(); });
      await act(async () => { getHook().setSetting('spoilerFree', false); });
      expect(getHook().settings.spoilerFreeExpiry).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('setting_spoiler_free_expiry');
    });

    it('spoilerFree=true unsubscribes all result leaf topics', async () => {
      let getHook;
      await act(async () => { getHook = renderProvider(); });
      await act(async () => { getHook().setSetting('spoilerFree', true); });
      const resultTopics = ['results_fp', 'results_qualifying', 'results_qrace', 'results_race1', 'results_race2', 'results_race3'];
      for (const topic of resultTopics) {
        expect(unsubscribeFromTopic).toHaveBeenCalledWith(expect.anything(), topic);
      }
    });

    it('spoilerFree=true does not unsubscribe non-result topics', async () => {
      let getHook;
      await act(async () => { getHook = renderProvider(); });
      await act(async () => { getHook().setSetting('spoilerFree', true); });
      expect(subscribeToTopic).toHaveBeenCalledWith(expect.anything(), 'news_alerts');
      expect(subscribeToTopic).toHaveBeenCalledWith(expect.anything(), 'digest_alerts');
    });

    it('spoilerFreeExpiry is loaded as a string (not parsed as boolean)', async () => {
      const isoDate = new Date(Date.now() + 86400000).toISOString();
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'setting_spoiler_free_expiry') return Promise.resolve(isoDate);
        return Promise.resolve(null);
      });
      let getHook;
      await act(async () => { getHook = renderProvider(); });
      expect(getHook().settings.spoilerFreeExpiry).toBe(isoDate);
    });
  });

  describe('Firestore live sync', () => {
    beforeEach(() => {
      const {saveProfile} = require('../../src/utils/userProfile');
      saveProfile.mockClear();
    });

    it('calls saveProfile with new value when logged-in user changes a synced setting', async () => {
      const {useAuth} = require('../../src/store/auth');
      const {saveProfile} = require('../../src/utils/userProfile');
      useAuth.mockReturnValue({user: {uid: 'test-uid', isAnonymous: false}, isAnonymous: false});

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        getHook().setSetting('newsAlerts', false);
      });

      expect(saveProfile).toHaveBeenCalledWith('test-uid', {newsAlerts: false});
    });

    it('calls saveProfile for preRace parent key (it is synced)', async () => {
      const {useAuth} = require('../../src/store/auth');
      const {saveProfile} = require('../../src/utils/userProfile');
      useAuth.mockReturnValue({user: {uid: 'test-uid', isAnonymous: false}, isAnonymous: false});

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        getHook().setSetting('preRace', false);
      });

      expect(saveProfile).toHaveBeenCalledWith('test-uid', {preRace: false});
    });

    it('does not call saveProfile for hubPreview (not synced)', async () => {
      const {useAuth} = require('../../src/store/auth');
      const {saveProfile} = require('../../src/utils/userProfile');
      useAuth.mockReturnValue({user: {uid: 'test-uid', isAnonymous: false}, isAnonymous: false});

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        getHook().setSetting('hubPreview', true);
      });

      expect(saveProfile).not.toHaveBeenCalled();
    });

    it('does not call saveProfile for chatFab (not synced)', async () => {
      const {useAuth} = require('../../src/store/auth');
      const {saveProfile} = require('../../src/utils/userProfile');
      useAuth.mockReturnValue({user: {uid: 'test-uid', isAnonymous: false}, isAnonymous: false});

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        getHook().setSetting('chatFab', false);
      });

      expect(saveProfile).not.toHaveBeenCalled();
    });

    it('does not call saveProfile when user is anonymous', async () => {
      const {useAuth} = require('../../src/store/auth');
      const {saveProfile} = require('../../src/utils/userProfile');
      useAuth.mockReturnValue({user: null, isAnonymous: true});

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        getHook().setSetting('newsAlerts', false);
      });

      expect(saveProfile).not.toHaveBeenCalled();
    });
  });
});
