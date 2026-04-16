import React, {useEffect, useState, useRef} from 'react';
import {StatusBar, AppState} from 'react-native';
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
import {maybeRequestReview} from './src/utils/reviewPrompt';
import {runBackgroundPrefetch} from './src/utils/backgroundPrefetch';
import notifee, {EventType} from '@notifee/react-native';
import {navigateFromData} from './src/utils/notifNavigation';
import {setupNotificationChannels, requestNotificationPermission, onForegroundMessage, checkForNewPodcast} from './src/utils/notifications';
import {getCrashlytics, setCrashlyticsCollectionEnabled} from '@react-native-firebase/crashlytics';
import MobileAds from 'react-native-google-mobile-ads';
import {getMessaging, onNotificationOpenedApp, getInitialNotification} from '@react-native-firebase/messaging';
import OnboardingDialog from './src/components/OnboardingDialog';
import UpdateDialog from './src/components/UpdateDialog';
import InAppUpdate from 'react-native-in-app-update';

export const navigationRef = createNavigationContainerRef();

const calendar = require('./src/data/calendar.json');

function _navigate(data: Record<string, string> | undefined) {
  navigateFromData(navigationRef as any, data);
}

// Keep old name for any legacy call sites
export function navigateToRound(round: string) {
  _navigate({round});
}

function PodcastChecker() {
  const {settings} = useSettings();
  useEffect(() => {
    checkForNewPodcast(settings.podcastAlerts);
  }, [settings.podcastAlerts]);
  return null;
}

const ONBOARDING_KEY = 'onboarding_shown';
const VERSION_CODE = 47;

function AppDialogs() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const {update_available, update_min_version} = useFeatureFlags();

  useEffect(() => {
    (async () => {
      const onboardingShown = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!onboardingShown) setShowOnboarding(true);
      RNBootSplash.hide({fade: true});
    })();
  }, []);

  // Play Store check (works on production installs)
  useEffect(() => {
    InAppUpdate.checkUpdate().then((result: any) => { if (result?.updateAvailability === 1) setShowUpdate(true); }).catch(() => {});
  }, []);

  // Flag-based override for testing (set update_available + update_min_version: 1000 in device overrides)
  useEffect(() => {
    if (update_available && update_min_version > VERSION_CODE) setShowUpdate(true);
  }, [update_available, update_min_version]);

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
    </>
  );
}

export default function App() {
  useEffect(() => {
    MobileAds().initialize();
    const crashlytics = getCrashlytics();
    setCrashlyticsCollectionEnabled(crashlytics, true);
    setupNotificationChannels();
    maybeRequestReview();
    runBackgroundPrefetch();

    // Handle notifee notification press (background or killed state).
    // notifee.getInitialNotification() stores the press natively — no AsyncStorage race condition.
    const consumeNotifeePress = () => {
      notifee.getInitialNotification().then(initial => {
        if (initial?.notification?.data) {
          console.log('[NOTIF] notifee initial:', JSON.stringify(initial.notification.data));
          _navigate(initial.notification.data as Record<string, string>);
        }
      }).catch(() => {});
    };
    consumeNotifeePress();
    const appStateUnsub = AppState.addEventListener('change', state => {
      if (state === 'active') consumeNotifeePress();
    });

    const unsubscribeFg = onForegroundMessage(() => {});

    // Notifee local notification tapped while app is in foreground
    const unsubscribeNotifee = notifee.onForegroundEvent(({type, detail}) => {
      if (type === EventType.PRESS) {
        console.log('[NOTIF] notifee press:', JSON.stringify(detail.notification?.data));
        _navigate(detail.notification?.data as Record<string, string>);
      }
    });

    // App opened from background by tapping an FCM notification
    const messaging = getMessaging();
    const unsubscribeBg = onNotificationOpenedApp(messaging, message => {
      console.log('[NOTIF] onNotificationOpenedApp:', JSON.stringify(message?.data));
      _navigate(message?.data as Record<string, string>);
    });

    // App launched cold by tapping an FCM notification
    getInitialNotification(messaging).then(message => {
      console.log('[NOTIF] getInitialNotification:', JSON.stringify(message?.data));
      _navigate(message?.data as Record<string, string>);
    });

    return () => { unsubscribeFg(); unsubscribeBg(); unsubscribeNotifee(); appStateUnsub.remove(); };
  }, []);

  return (
    <SafeAreaProvider>
    <FeatureFlagsProvider>
    <FavouriteDriverProvider>
      <UnitsProvider>
        <SettingsProvider>
          <RadioProvider>
            <PodcastChecker />
            <StatusBar barStyle="light-content" backgroundColor="#020255" />
            <AppNavigator navigationRef={navigationRef} />
            <AppDialogs />
          </RadioProvider>
        </SettingsProvider>
      </UnitsProvider>
    </FavouriteDriverProvider>
    </FeatureFlagsProvider>
    </SafeAreaProvider>
  );
}
