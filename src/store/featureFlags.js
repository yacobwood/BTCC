import React, {createContext, useContext, useState, useEffect} from 'react';

const FLAGS_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/flags.json';

const defaults = {
  podcasts_enabled: false,
  podcast_last_episode_url: '',
};

const FeatureFlagsContext = createContext(defaults);

export function FeatureFlagsProvider({children}) {
  const [flags, setFlags] = useState(defaults);

  useEffect(() => {
    fetch(FLAGS_URL)
      .then(r => r.json())
      .then(data => setFlags(prev => ({...prev, ...data})))
      .catch(() => {});
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
