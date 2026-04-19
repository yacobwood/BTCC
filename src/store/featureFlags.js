import React, {createContext, useContext, useState, useEffect} from 'react';
import {getMessaging, getToken} from '@react-native-firebase/messaging';

const FLAGS_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/flags.json';

const defaults = {
  radio_tab: true,
  podcasts_enabled: false,
  podcast_last_episode_url: '',
  debug_mode: false,
  hub_news_enabled: true,
  live_timing_in_app: false,
};

const FeatureFlagsContext = createContext(defaults);

export function FeatureFlagsProvider({children}) {
  const [flags, setFlags] = useState(defaults);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetch(FLAGS_URL).then(r => r.json());
        const {overrides = {}, ...globalFlags} = data;

        // Apply per-device overrides if this device has any
        let deviceOverrides = {};
        try {
          const token = await getToken(getMessaging());
          if (token && overrides[token]) deviceOverrides = overrides[token];
        } catch {}

        setFlags(prev => ({...prev, ...globalFlags, ...deviceOverrides}));
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
