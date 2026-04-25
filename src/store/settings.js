import React, {createContext, useContext, useState, useCallback, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getMessaging, subscribeToTopic, unsubscribeFromTopic} from '@react-native-firebase/messaging';

// Leaf settings that map 1:1 to an FCM topic
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

// For each leaf, which parent keys must also be true for the subscription to be active
const PARENT_CHAIN = {
  newsAlerts:        [],
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
};

const STORAGE_KEYS = {
  newsAlerts:        'setting_news_alerts',
  weekendPreview:    'setting_weekend_preview',
  standingsUpdate:   'setting_standings_update',
  podcastAlerts:     'setting_podcast_alerts',
  preRace:           'setting_pre_race',
  preRaceFP:         'setting_pre_race_fp',
  preRaceQualifying: 'setting_pre_race_qualifying',
  preRaceQRace:      'setting_pre_race_qrace',
  preRaceRace:       'setting_pre_race_race',
  preRaceRace1:      'setting_pre_race_race1',
  preRaceRace2:      'setting_pre_race_race2',
  preRaceRace3:      'setting_pre_race_race3',
  results:           'setting_results',
  resultsFP:         'setting_results_fp',
  resultsQualifying: 'setting_results_qualifying',
  resultsQRace:      'setting_results_qrace',
  resultsRace:       'setting_results_race',
  resultsRace1:      'setting_results_race1',
  resultsRace2:      'setting_results_race2',
  resultsRace3:      'setting_results_race3',
  hubPreview:        'setting_hub_preview',
};

const defaults = {
  newsAlerts:        true,
  weekendPreview:    true,
  standingsUpdate:   true,
  podcastAlerts:     true,
  preRace:           true,
  preRaceFP:         true,
  preRaceQualifying: true,
  preRaceQRace:      true,
  preRaceRace:       true,
  preRaceRace1:      true,
  preRaceRace2:      true,
  preRaceRace3:      true,
  results:           true,
  resultsFP:         true,
  resultsQualifying: true,
  resultsQRace:      true,
  resultsRace:       true,
  resultsRace1:      true,
  resultsRace2:      true,
  resultsRace3:      true,
  hubPreview:        false,
};

function isEffective(settings, key) {
  if (!settings[key]) return false;
  return (PARENT_CHAIN[key] || []).every(p => settings[p]);
}

function syncAllTopics(settings) {
  const messaging = getMessaging();
  for (const [key, topic] of Object.entries(LEAF_TOPICS)) {
    const enabled = isEffective(settings, key);
    const fn = enabled ? subscribeToTopic : unsubscribeFromTopic;
    fn(messaging, topic).catch(() => {});
  }
}

const SettingsContext = createContext({settings: defaults, setSetting: () => {}});

export function SettingsProvider({children}) {
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
        if (val !== null) loaded[key] = val === 'true';
      }
      setSettings(loaded);
      syncAllTopics(loaded);
    })();
  }, []);

  const setSetting = useCallback((key, value) => {
    setSettings(prev => {
      const next = {...prev, [key]: value};
      AsyncStorage.setItem(STORAGE_KEYS[key], String(value)).catch(() => {});
      // Re-sync all leaf topics since parent state may have changed
      syncAllTopics(next);
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{settings, setSetting}}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
