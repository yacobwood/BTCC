import React, {createContext, useContext, useState, useEffect, useMemo} from 'react';
import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getMessaging, getToken} from '@react-native-firebase/messaging';
import DeviceInfo from 'react-native-device-info';

const FLAGS_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/flags.json';
const FLAGS_CACHE_KEY = 'feature_flags_cache';

const defaults = {
  radio_tab: false,
  podcasts_enabled: false,
  debug_mode: false,
  hub_news_enabled: true,
  live_timing_in_app: false,
  live_chat: false,
  live_chat_min_build_android: 68,
  live_chat_min_build_ios: 68,
  update_available: true,
  update_min_version_ios: 0,
  update_min_version_android: 63,
  broadcaster_override: null,
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
      // AbortSignal.timeout() is not supported on all Hermes/Android versions  - 
      // use a manual AbortController instead.
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        // unref so the timer doesn't keep the process alive in test environments
        if (timeoutId?.unref) timeoutId.unref();
        const data = await fetch(FLAGS_URL, {signal: controller.signal})
          .then(r => { clearTimeout(timeoutId); return r.json(); });
        const {overrides = {}, ...globalFlags} = data;

        // Apply global flags immediately  -  don't block on token lookup
        setFlags(prev => ({...prev, ...globalFlags}));

        // Apply per-device overrides if this device has any (best-effort, 3s timeout)
        try {
          const token = await Promise.race([
            getToken(getMessaging()),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
          ]);
          if (token && overrides[token]) {
            setFlags(prev => ({...prev, ...overrides[token]}));
          }
        } catch {}
        // Cache global flags only (device overrides are ephemeral)
        AsyncStorage.setItem(FLAGS_CACHE_KEY, JSON.stringify(globalFlags)).catch(() => {});
      } catch {}
    })();
  }, []);

  const effectiveFlags = useMemo(() => {
    const build = parseInt(DeviceInfo.getBuildNumber(), 10);
    const minBuild = Platform.OS === 'android'
      ? (flags.live_chat_min_build_android ?? 0)
      : (flags.live_chat_min_build_ios ?? 0);
    return {
      ...flags,
      live_chat: flags.live_chat && (minBuild === 0 || build >= minBuild),
    };
  }, [flags]);

  return (
    <FeatureFlagsContext.Provider value={effectiveFlags}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
