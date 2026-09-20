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
import {handleNotificationOpen, navigateToNewToBtcc} from './src/utils/notifNavigation';
import {setupNotificationChannels, requestNotificationPermission, onForegroundMessage} from './src/utils/notifications';
import {Analytics} from './src/utils/analytics';
import {getCrashlytics, setCrashlyticsCollectionEnabled} from '@react-native-firebase/crashlytics';
import {getMessaging, onNotificationOpenedApp, getInitialNotification} from '@react-native-firebase/messaging';
import OnboardingDialog from './src/components/OnboardingDialog';
import UpdateDialog from './src/components/UpdateDialog';
import SpoilerClearedDialog from './src/components/SpoilerClearedDialog';
import CrossPromoDialog from './src/components/CrossPromoDialog';
import ErrorBoundary from './src/components/ErrorBoundary';
import {AuthProvider} from './src/store/auth';

export const navigationRef = createNavigationContainerRef();

function _navigate(data: Record<string, string> | undefined) {
  handleNotificationOpen(navigationRef as any, data);
}

// Keep old name for any legacy call sites
export function navigateToRound(round: string) {
  _navigate({round});
}


const ONBOARDING_KEY = 'onboarding_shown';
const CROSS_PROMO_TICKETSTACK_KEY = 'cross_promo_ticketstack_shown';

function AppDialogs() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [showSpoilerCleared, setShowSpoilerCleared] = useState(false);
  const [showCrossPromo, setShowCrossPromo] = useState(false);
  const {update_available, update_min_version, update_min_version_ios, update_min_version_android} = useFeatureFlags();
  const {spoilerJustCleared} = useSettings();

  useEffect(() => {
    (async () => {
      const onboardingShown = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!onboardingShown) {
        setShowOnboarding(true);
        Analytics.screen('onboarding');
      } else {
        // Deliberately gated behind onboarding already being done, so this
        // never stacks onto a brand-new user's very first launch - a
        // returning/existing user sees it once, on their next open after
        // this ships. See CrossPromoDialog.js for why the wording avoids
        // any claim of a formal sponsorship.
        const crossPromoShown = await AsyncStorage.getItem(CROSS_PROMO_TICKETSTACK_KEY);
        if (!crossPromoShown) {
          setShowCrossPromo(true);
        }
      }
      RNBootSplash.hide({fade: true});
    })();
  }, []);

  const handleCrossPromoDismiss = async () => {
    await AsyncStorage.setItem(CROSS_PROMO_TICKETSTACK_KEY, 'true');
    setShowCrossPromo(false);
  };

  // Auto-disabling spoiler-free itself (and deciding whether it's worth
  // telling the user) now happens inside SettingsProvider's own load, as
  // part of the same pass that computes every other setting - see its
  // spoilerJustCleared comment for why this used to live here as an
  // independent effect and raced it.
  useEffect(() => {
    if (spoilerJustCleared) setShowSpoilerCleared(true);
  }, [spoilerJustCleared]);

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
    Analytics.onboardingChoiceMade('allow');
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
    requestNotificationPermission();
  };

  const handleOnboardingSkip = async () => {
    Analytics.onboardingChoiceMade('skip');
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
  };

  const handleOnboardingLearnBasics = async () => {
    Analytics.onboardingChoiceMade('learn_basics');
    // Deliberately does NOT set ONBOARDING_KEY - "Learn the basics" is a
    // detour, not a decision about notifications. Leaving the flag unset
    // means the prompt asks again on the next cold start instead of the
    // notification choice silently vanishing forever (bug: a curious new
    // user who taps this never gets asked at all). Nothing re-shows it
    // mid-session since the check only runs once, on mount.
    setShowOnboarding(false);
    navigateToNewToBtcc(navigationRef);
  };

  return (
    <>
      <OnboardingDialog
        visible={showOnboarding}
        onAllow={handleOnboardingAllow}
        onSkip={handleOnboardingSkip}
        onLearnBasics={handleOnboardingLearnBasics}
      />
      <UpdateDialog visible={showUpdate} onDismiss={() => setShowUpdate(false)} />
      <SpoilerClearedDialog visible={showSpoilerCleared} onDismiss={() => setShowSpoilerCleared(false)} />
      <CrossPromoDialog visible={showCrossPromo} onDismiss={handleCrossPromoDismiss} />
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
    <AuthProvider>
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
    </AuthProvider>
    </ErrorBoundary>
  );
}
