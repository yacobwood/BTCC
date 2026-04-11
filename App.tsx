import React, {useEffect, useState, useRef} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import RNBootSplash from 'react-native-bootsplash';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createNavigationContainerRef, CommonActions} from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import {FavouriteDriverProvider} from './src/store/favouriteDriver';
import {UnitsProvider} from './src/store/units';
import {SettingsProvider, useSettings} from './src/store/settings';
import {RadioProvider} from './src/store/radio';
import {FeatureFlagsProvider, useFeatureFlags} from './src/store/featureFlags';
import {maybeRequestReview} from './src/utils/reviewPrompt';
import {runBackgroundPrefetch} from './src/utils/backgroundPrefetch';
import {setupNotificationChannels, requestNotificationPermission, onForegroundMessage, checkForNewPodcast} from './src/utils/notifications';
import {getCrashlytics, setCrashlyticsCollectionEnabled} from '@react-native-firebase/crashlytics';
import {getMessaging, onNotificationOpenedApp, getInitialNotification} from '@react-native-firebase/messaging';
import OnboardingDialog from './src/components/OnboardingDialog';
import WhatsNewDialog from './src/components/WhatsNewDialog';

export const navigationRef = createNavigationContainerRef();

const calendar = require('./src/data/calendar.json');

// Holds a pending navigation action until the navigator is ready
let pendingRound: string | null = null;

export function navigateToRound(round: string) {
  const track = calendar.rounds.find((r: any) => r.round === parseInt(round, 10));
  if (!track) return;
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.navigate({
        name: 'Calendar',
        params: {
          screen: 'TrackDetail',
          params: {track},
        },
      })
    );
  } else {
    pendingRound = round;
  }
}

export function flushPendingNavigation() {
  if (pendingRound) {
    const r = pendingRound;
    pendingRound = null;
    navigateToRound(r);
  }
}

function PodcastChecker() {
  const {settings} = useSettings();
  useEffect(() => {
    checkForNewPodcast(settings.podcastAlerts);
  }, [settings.podcastAlerts]);
  return null;
}

const ONBOARDING_KEY = 'onboarding_shown';
const WHATS_NEW_KEY = 'whats_new_seen_version';
const CURRENT_VERSION = 39;

function AppDialogs() {
  const {whats_new} = useFeatureFlags();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  useEffect(() => {
    (async () => {
      const onboardingShown = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!onboardingShown) {
        await AsyncStorage.setItem(WHATS_NEW_KEY, String(CURRENT_VERSION));
        setShowOnboarding(true);
      } else {
        const seenVersion = parseInt(await AsyncStorage.getItem(WHATS_NEW_KEY) || '0', 10);
        if (seenVersion < CURRENT_VERSION) {
          setShowWhatsNew(true);
        }
      }
      RNBootSplash.hide({fade: true});
    })();
  }, []);

  const handleOnboardingAllow = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
    requestNotificationPermission();
    const seenVersion = parseInt(await AsyncStorage.getItem(WHATS_NEW_KEY) || '0', 10);
    if (seenVersion < CURRENT_VERSION) setShowWhatsNew(true);
  };

  const handleOnboardingSkip = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
  };

  const handleWhatsNewDismiss = async () => {
    await AsyncStorage.setItem(WHATS_NEW_KEY, String(CURRENT_VERSION));
    setShowWhatsNew(false);
  };

  return (
    <>
      <OnboardingDialog visible={showOnboarding} onAllow={handleOnboardingAllow} onSkip={handleOnboardingSkip} />
      <WhatsNewDialog visible={whats_new && showWhatsNew} onDismiss={handleWhatsNewDismiss} versionCode={CURRENT_VERSION} />
    </>
  );
}

export default function App() {
  useEffect(() => {
    const crashlytics = getCrashlytics();
    setCrashlyticsCollectionEnabled(crashlytics, true);
    setupNotificationChannels();
    maybeRequestReview();
    runBackgroundPrefetch();

    const unsubscribeFg = onForegroundMessage(() => {});

    // App opened from background by tapping a notification
    const messaging = getMessaging();
    const unsubscribeBg = onNotificationOpenedApp(messaging, message => {
      const round = message?.data?.round;
      if (round) navigateToRound(round);
    });

    // App launched cold by tapping a notification
    getInitialNotification(messaging).then(message => {
      const round = message?.data?.round;
      if (round) navigateToRound(round); // queued if navigator not ready yet
    });

    return () => { unsubscribeFg(); unsubscribeBg(); };
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
            <AppNavigator navigationRef={navigationRef} onReady={flushPendingNavigation} />
            <AppDialogs />
          </RadioProvider>
        </SettingsProvider>
      </UnitsProvider>
    </FavouriteDriverProvider>
    </FeatureFlagsProvider>
    </SafeAreaProvider>
  );
}
