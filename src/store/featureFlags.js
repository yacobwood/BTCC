import React, {createContext, useContext, useState, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getMessaging, getToken} from '@react-native-firebase/messaging';

const FLAGS_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/flags.json';
const FLAGS_CACHE_KEY = 'feature_flags_cache';

const defaults = {
  radio_tab: false,
  podcasts_enabled: false,
  podcast_last_episode_url: '',
  debug_mode: false,
  hub_news_enabled: true,
  live_timing_in_app: false,
  live_chat: false,
  update_available: false,
  update_min_version: 0,
  update_min_version_ios: 0,
  update_min_version_android: 0,
};

const FeatureFlagsContext = createContext(defaults);

export function FeatureFlagsProvider({children}) {
  const [flags, setFlags] = useState(defaults);

  useEffect(() => {
    (async () => {
      // Phase 1: apply last-known flags instantly so the app never blocks on network
      try {
        const cached = await AsyncStorage.getItem(FLAGS_CACHE_KEY);
        if (cached) setFlags(prev => ({...prev, ...JSON.parse(cached)}));
      } catch {}

      // Phase 2: fetch fresh flags with a hard timeout
      try {
        const data = await fetch(FLAGS_URL, {signal: AbortSignal.timeout(8000)}).then(r => r.json());
        const {overrides = {}, ...globalFlags} = data;

        // Apply per-device overrides if this device has any
        let deviceOverrides = {};
        try {
          const token = await getToken(getMessaging());
          if (token && overrides[token]) deviceOverrides = overrides[token];
        } catch {}

        setFlags(prev => ({...prev, ...globalFlags, ...deviceOverrides}));
        // Cache global flags only (device overrides are ephemeral)
        AsyncStorage.setItem(FLAGS_CACHE_KEY, JSON.stringify(globalFlags)).catch(() => {});
      } catch {}
    })();
  }, []);

  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
