import React, {createContext, useContext, useState, useCallback, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getMessaging, subscribeToTopic, unsubscribeFromTopic} from '@react-native-firebase/messaging';
import {useAuth} from './auth';
import {saveProfile} from '../utils/userProfile';
import {syncChatMentionToken} from '../utils/notifications';
import {syncWidgetTimeFormat} from '../utils/widgetSettings';

// Leaf settings that map 1:1 to an FCM topic
const LEAF_TOPICS = {
  newsAlerts:        'news_alerts',
  digestAlerts:      'digest_alerts',
  explainerAlerts:   'explainer_alerts',
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
  // Deliberately NOT in RESULT_LEAF_KEYS below - its whole point is to pull a
  // spoiler-free user back in without ever stating the actual result, so
  // spoilerFree must never suppress it the way it suppresses resultsRace*.
  resultsTeaser:     'results_teaser',
};

// For each leaf, which parent keys must also be true for the subscription to be active
const PARENT_CHAIN = {
  newsAlerts:        [],
  digestAlerts:      [],
  explainerAlerts:   [],
  weekendPreview:    [],
  standingsUpdate:   [],
  podcastAlerts:     [],
  preRaceFP:         ['preRace'],
  preRaceQualifying: ['preRace'],
  preRaceQRace:      ['preRace'],
  preRaceRace1:      ['preRace', 'preRaceRace'],
  preRaceRace2:      ['preRace', 'preRaceRace'],
  preRaceRace3:      ['preRace', 'preRaceRace'],
  resultsFP:         ['results'],
  resultsQualifying: ['results'],
  resultsQRace:      ['results'],
  resultsRace1:      ['results', 'resultsRace'],
  resultsRace2:      ['results', 'resultsRace'],
  resultsRace3:      ['results', 'resultsRace'],
  resultsTeaser:     [],
};

const STORAGE_KEYS = {
  newsAlerts:          'setting_news_alerts',
  digestAlerts:        'setting_digest_alerts',
  explainerAlerts:     'setting_explainer_alerts',
  weekendPreview:      'setting_weekend_preview',
  standingsUpdate:     'setting_standings_update',
  podcastAlerts:       'setting_podcast_alerts',
  preRace:             'setting_pre_race',
  preRaceFP:           'setting_pre_race_fp',
  preRaceQualifying:   'setting_pre_race_qualifying',
  preRaceQRace:        'setting_pre_race_qrace',
  preRaceRace:         'setting_pre_race_race',
  preRaceRace1:        'setting_pre_race_race1',
  preRaceRace2:        'setting_pre_race_race2',
  preRaceRace3:        'setting_pre_race_race3',
  results:             'setting_results',
  resultsFP:           'setting_results_fp',
  resultsQualifying:   'setting_results_qualifying',
  resultsQRace:        'setting_results_qrace',
  resultsRace:         'setting_results_race',
  resultsRace1:        'setting_results_race1',
  resultsRace2:        'setting_results_race2',
  resultsRace3:        'setting_results_race3',
  resultsTeaser:       'setting_results_teaser',
  hubPreview:          'setting_hub_preview',
  spoilerFree:         'setting_spoiler_free',
  spoilerFreeExpiry:   'setting_spoiler_free_expiry',
  chatFab:             'setting_chat_fab',
  chatMentions:        'setting_chat_mentions',
  use12HourTime:       'setting_12hr_time',
};

const defaults = {
  newsAlerts:          true,
  digestAlerts:        true,
  explainerAlerts:     true,
  weekendPreview:      true,
  standingsUpdate:     true,
  podcastAlerts:       true,
  preRace:             true,
  preRaceFP:           true,
  preRaceQualifying:   true,
  preRaceQRace:        true,
  preRaceRace:         true,
  preRaceRace1:        true,
  preRaceRace2:        true,
  preRaceRace3:        true,
  results:             true,
  resultsFP:           true,
  resultsQualifying:   true,
  resultsQRace:        true,
  resultsRace:         true,
  resultsRace1:        true,
  resultsRace2:        true,
  resultsRace3:        true,
  resultsTeaser:       true,
  hubPreview:          false,
  spoilerFree:         false,
  spoilerFreeExpiry:   null,
  chatFab:             true,
  chatMentions:        true,
  use12HourTime:       false,
};

function isEffective(settings, key) {
  if (!settings[key]) return false;
  return (PARENT_CHAIN[key] || []).every(p => settings[p]);
}

const RESULT_LEAF_KEYS = new Set([
  'resultsFP', 'resultsQualifying', 'resultsQRace',
  'resultsRace1', 'resultsRace2', 'resultsRace3',
]);

function syncAllTopics(settings) {
  const messaging = getMessaging();
  // All installs subscribe to these unconditionally — no user toggle.
  subscribeToTopic(messaging, 'broadcast').catch(() => {});
  // results_live receives silent cache-invalidation signals from the scraper bot.
  subscribeToTopic(messaging, 'results_live').catch(() => {});
  for (const [key, topic] of Object.entries(LEAF_TOPICS)) {
    const spoilerBlocked = settings.spoilerFree && RESULT_LEAF_KEYS.has(key);
    const enabled = !spoilerBlocked && isEffective(settings, key);
    const fn = enabled ? subscribeToTopic : unsubscribeFromTopic;
    fn(messaging, topic).catch(() => {});
  }
}

// Returns ISO string for next Monday at 23:00 local time
function nextMondayNight() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun ... 6=Sat
  const daysUntilMonday = (8 - day) % 7; // 0 if today is Monday (expire tonight)
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  monday.setHours(23, 0, 0, 0);
  return monday.toISOString();
}

const SYNCED_KEYS = new Set([
  'newsAlerts', 'digestAlerts', 'explainerAlerts', 'weekendPreview', 'standingsUpdate', 'podcastAlerts',
  'preRace', 'preRaceFP', 'preRaceQualifying', 'preRaceQRace', 'preRaceRace',
  'preRaceRace1', 'preRaceRace2', 'preRaceRace3',
  'results', 'resultsFP', 'resultsQualifying', 'resultsQRace', 'resultsRace',
  'resultsRace1', 'resultsRace2', 'resultsRace3', 'resultsTeaser',
  'spoilerFree', 'use12HourTime',
]);

const SettingsContext = createContext({settings: defaults, setSetting: (_key, _value) => {}});

export function SettingsProvider({children}) {
  const {user} = useAuth();
  const [settings, setSettings] = useState(defaults);

  useEffect(() => {
    (async () => {
      const loaded = {...defaults};
      // Migrate legacy single topics → new granular keys
      const legacyMap = {
        setting_race_alerts:      ['preRaceRace', 'preRaceRace1', 'preRaceRace2', 'preRaceRace3'],
        setting_qualifying_alerts: ['preRaceQualifying', 'preRaceQRace'],
        setting_fp_alerts:         ['preRaceFP'],
        setting_results_alerts:    ['results', 'resultsFP', 'resultsQualifying', 'resultsQRace', 'resultsRace', 'resultsRace1', 'resultsRace2', 'resultsRace3'],
      };
      for (const [legacyKey, newKeys] of Object.entries(legacyMap)) {
        const val = await AsyncStorage.getItem(legacyKey).catch(() => null);
        if (val !== null) {
          const enabled = val === 'true';
          for (const k of newKeys) loaded[k] = enabled;
          await AsyncStorage.removeItem(legacyKey).catch(() => {});
        }
      }
      for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
        const val = await AsyncStorage.getItem(storageKey).catch(() => null);
        if (val !== null) {
          // spoilerFreeExpiry is an ISO string, not a boolean
          loaded[key] = key === 'spoilerFreeExpiry' ? val : val === 'true';
        }
      }
      setSettings(loaded);
      syncAllTopics(loaded);
      syncChatMentionToken(user?.uid, loaded.chatMentions);
      // Push to native widget storage on every load - covers a fresh install/new
      // device pulling the value back from the Firestore profile, not just a
      // same-device toggle (see setSetting below).
      syncWidgetTimeFormat(loaded.use12HourTime);
    })();
  }, [user]);

  const setSetting = useCallback((key, value) => {
    setSettings(prev => {
      const next = {...prev, [key]: value};
      AsyncStorage.setItem(STORAGE_KEYS[key], String(value)).catch(() => {});
      if (user && !user.isAnonymous && SYNCED_KEYS.has(key)) {
        saveProfile(user.uid, {[key]: value}).catch(() => {});
      }
      // Manage spoiler-free expiry alongside the toggle
      if (key === 'spoilerFree') {
        const expiry = value ? nextMondayNight() : null;
        next.spoilerFreeExpiry = expiry;
        if (expiry) {
          AsyncStorage.setItem(STORAGE_KEYS.spoilerFreeExpiry, expiry).catch(() => {});
        } else {
          AsyncStorage.removeItem(STORAGE_KEYS.spoilerFreeExpiry).catch(() => {});
        }
      }
      // Re-sync all leaf topics since parent state may have changed
      syncAllTopics(next);
      // Not a topic - registers/removes this device's own token directly (see notifications.js)
      if (key === 'chatMentions') syncChatMentionToken(user?.uid, next.chatMentions);
      // Not a topic - hands the value to the native widget (AsyncStorage isn't
      // readable from the widget process on either platform, see widgetSettings.js)
      if (key === 'use12HourTime') syncWidgetTimeFormat(next.use12HourTime);
      return next;
    });
  }, [user]);

  return (
    <SettingsContext.Provider value={{settings, setSetting}}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
