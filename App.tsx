import React, {useEffect, useState, useRef} from 'react';
import {versionCode as VERSION_CODE} from './package.json';
import {StatusBar, AppState, Platform} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import RNBootSplash from 'react-native-bootsplash';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createNavigationContainerRef} from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import {FavouriteDriverProvider} from './src/store/favouriteDriver';
import {UnitsProvider} from './src/store/units';
import {SettingsProvider, useSettings} from './src/store/settings';
import {RadioProvider} from './src/store/radio';
import {FeatureFlagsProvider, useFeatureFlags} from './src/store/featureFlags';
import {LiveUrlsProvider} from './src/store/liveUrls';
import {runBackgroundPrefetch} from './src/utils/backgroundPrefetch';
import {cacheEvictStale, cacheDelete} from './src/store/cache';
import notifee, {EventType} from '@notifee/react-native';
import {navigateFromData} from './src/utils/notifNavigation';
import {setupNotificationChannels, requestNotificationPermission, onForegroundMessage} from './src/utils/notifications';
import {getCrashlytics, setCrashlyticsCollectionEnabled} from '@react-native-firebase/crashlytics';
import {getMessaging, onNotificationOpenedApp, getInitialNotification} from '@react-native-firebase/messaging';
import OnboardingDialog from './src/components/OnboardingDialog';
import UpdateDialog from './src/components/UpdateDialog';
import SpoilerClearedDialog from './src/components/SpoilerClearedDialog';
import ErrorBoundary from './src/components/ErrorBoundary';

export const navigationRef = createNavigationContainerRef();

function _navigate(data: Record<string, string> | undefined) {
  navigateFromData(navigationRef as any, data);
}

// Keep old name for any legacy call sites
export function navigateToRound(round: string) {
  _navigate({round});
}


const ONBOARDING_KEY = 'onboarding_shown';

function AppDialogs() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [showSpoilerCleared, setShowSpoilerCleared] = useState(false);
  const {update_available, update_min_version, update_min_version_ios, update_min_version_android} = useFeatureFlags();
  const {setSetting} = useSettings();

  useEffect(() => {
    (async () => {
      const [onboardingShown, spoilerFreeVal, expiryVal] = await Promise.all([
        AsyncStorage.getItem(ONBOARDING_KEY),
        AsyncStorage.getItem('setting_spoiler_free'),
        AsyncStorage.getItem('setting_spoiler_free_expiry'),
      ]);
      if (!onboardingShown) setShowOnboarding(true);

      // Auto-disable spoiler-free on app open — read directly from storage to avoid context timing
      if (spoilerFreeVal === 'true') {
        const expired = !expiryVal || new Date() >= new Date(expiryVal);
        setSetting('spoilerFree', false);
        if (!expired) setShowSpoilerCleared(true);
      }

      RNBootSplash.hide({fade: true});
    })();
  }, []);

  // Flag-based override for testing via admin page device overrides
  useEffect(() => {
    const platformMinVersion = Platform.OS === 'ios'
      ? (update_min_version_ios || update_min_version)
      : (update_min_version_android || update_min_version);
    if (update_available && platformMinVersion > VERSION_CODE) {
      setShowUpdate(true);
    } else {
      setShowUpdate(false);
    }
  }, [update_available, update_min_version, update_min_version_ios, update_min_version_android]);

  const handleOnboardingAllow = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
    requestNotificationPermission();
  };

  const handleOnboardingSkip = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
  };

  return (
    <>
      <OnboardingDialog visible={showOnboarding} onAllow={handleOnboardingAllow} onSkip={handleOnboardingSkip} />
      <UpdateDialog visible={showUpdate} onDismiss={() => setShowUpdate(false)} />
      <SpoilerClearedDialog visible={showSpoilerCleared} onDismiss={() => setShowSpoilerCleared(false)} />
    </>
  );
}

export default function App() {
  useEffect(() => {
    const crashlytics = getCrashlytics();
    setCrashlyticsCollectionEnabled(crashlytics, true);
    setupNotificationChannels();
    runBackgroundPrefetch();
    cacheEvictStale();

    // Handle notifee notification press (background or killed state).
    // notifee.getInitialNotification() stores the press natively — no AsyncStorage race condition.
    // initialConsumed prevents double-navigation on cold start (mount fires active state immediately after).
    let initialConsumed = false;
    const consumeNotifeePress = () => {
      notifee.getInitialNotification().then(initial => {
        if (initial?.notification?.data && !initialConsumed) {
          initialConsumed = true;
          _navigate(initial.notification.data as Record<string, string>);
        }
      }).catch(() => {});
    };
    consumeNotifeePress();
    const appStateUnsub = AppState.addEventListener('change', state => {
      if (state === 'active') consumeNotifeePress();
    });

    const unsubscribeFg = onForegroundMessage(msg => {
      if (msg?.data?.type === 'results_refresh') {
        const year = msg.data.year || '2026';
        cacheDelete(`results_${year}`).catch(() => {});
      }
    });

    // Notifee local notification tapped while app is in foreground
    const unsubscribeNotifee = notifee.onForegroundEvent(({type, detail}) => {
      if (type === EventType.PRESS) {
        _navigate(detail.notification?.data as Record<string, string>);
      }
    });

    // App opened from background by tapping an FCM notification
    const messaging = getMessaging();
    const unsubscribeBg = onNotificationOpenedApp(messaging, message => {
      _navigate(message?.data as Record<string, string>);
    });

    // App launched cold by tapping an FCM notification
    getInitialNotification(messaging).then(message => {
      _navigate(message?.data as Record<string, string>);
    });

    return () => { unsubscribeFg(); unsubscribeBg(); unsubscribeNotifee(); appStateUnsub.remove(); };
  }, []);

  return (
    <ErrorBoundary>
    <SafeAreaProvider style={{flex: 1, backgroundColor: '#080912'}}>
    <FeatureFlagsProvider>
    <LiveUrlsProvider>
    <FavouriteDriverProvider>
      <UnitsProvider>
        <SettingsProvider>
          <RadioProvider>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <AppNavigator navigationRef={navigationRef} />
            <AppDialogs />
          </RadioProvider>
        </SettingsProvider>
      </UnitsProvider>
    </FavouriteDriverProvider>
    </LiveUrlsProvider>
    </FeatureFlagsProvider>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}
