import React, {createContext, useContext, useState, useCallback, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getMessaging, subscribeToTopic, unsubscribeFromTopic} from '@react-native-firebase/messaging';

// Maps setting key → FCM topic name
const TOPIC_MAP = {
  raceAlerts: 'race_alerts',
  qualifyingAlerts: 'qualifying_alerts',
  fpAlerts: 'fp_alerts',
  resultsAlerts: 'results_alerts',
  weekendPreview: 'weekend_preview',
  standingsUpdate: 'standings_update',
};

function syncTopic(topic, enabled) {
  const messaging = getMessaging();
  const fn = enabled ? subscribeToTopic : unsubscribeFromTopic;
  fn(messaging, topic).catch(() => {});
}

const KEYS = {
  newsAlerts: 'setting_news_alerts',
  raceAlerts: 'setting_race_alerts',
  qualifyingAlerts: 'setting_qualifying_alerts',
  fpAlerts: 'setting_fp_alerts',
  resultsAlerts: 'setting_results_alerts',
  weekendPreview: 'setting_weekend_preview',
  standingsUpdate: 'setting_standings_update',
  podcastAlerts: 'setting_podcast_alerts',
};

const defaults = {
  newsAlerts: true,
  raceAlerts: true,
  qualifyingAlerts: true,
  fpAlerts: true,
  resultsAlerts: true,
  weekendPreview: true,
  standingsUpdate: true,
  podcastAlerts: true,
};

const SettingsContext = createContext({settings: defaults, setSetting: () => {}});

export function SettingsProvider({children}) {
  const [settings, setSettings] = useState(defaults);

  useEffect(() => {
    (async () => {
      const loaded = {...defaults};
      for (const [key, storageKey] of Object.entries(KEYS)) {
        const val = await AsyncStorage.getItem(storageKey).catch(() => null);
        if (val !== null) loaded[key] = val === 'true';
      }
      setSettings(loaded);
      // Sync all FCM topic subscriptions to match stored settings
      for (const [key, topic] of Object.entries(TOPIC_MAP)) {
        syncTopic(topic, loaded[key]);
      }
    })();
  }, []);

  const setSetting = useCallback((key, value) => {
    setSettings(prev => ({...prev, [key]: value}));
    if (KEYS[key]) AsyncStorage.setItem(KEYS[key], String(value)).catch(() => {});
    if (TOPIC_MAP[key]) syncTopic(TOPIC_MAP[key], value);
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
