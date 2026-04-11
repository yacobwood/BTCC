import React, {useEffect, useState, useRef} from 'react';
import {StatusBar} from 'react-native';
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
import {getSeasonData} from './src/assets/seasonData';
import notifee, {EventType} from '@notifee/react-native';
import {setupNotificationChannels, requestNotificationPermission, onForegroundMessage, checkForNewPodcast} from './src/utils/notifications';
import {getCrashlytics, setCrashlyticsCollectionEnabled} from '@react-native-firebase/crashlytics';
import {getMessaging, onNotificationOpenedApp, getInitialNotification} from '@react-native-firebase/messaging';
import OnboardingDialog from './src/components/OnboardingDialog';
import WhatsNewDialog from './src/components/WhatsNewDialog';

export const navigationRef = createNavigationContainerRef();

const calendar = require('./src/data/calendar.json');

function navigateFromData(data: Record<string, string> | undefined) {
  if (!data) return;
  const go = () => {
    const {type, round, year, race, slug} = data;
    if ((type === 'round' || (!type && round)) && round) {
      console.log('[NOTIF] navigate → TrackDetail round:', round);
      navigationRef.navigate('TrackDetail' as never, {round} as never);
    } else if (type === 'news' && slug) {
      console.log('[NOTIF] navigate → Article slug:', slug);
      navigationRef.navigate('Article' as never, {slug} as never);
    } else if (type === 'results' && round) {
      const y = parseInt(year, 10) || new Date().getFullYear();
      const season = getSeasonData(y);
      const roundObj = season?.rounds?.find((r: any) => r.round === parseInt(round, 10));
      if (roundObj) {
        const initialRace = race ? parseInt(race, 10) - 1 : 0;
        console.log('[NOTIF] navigate → RoundResults round:', round, 'race:', initialRace);
        navigationRef.navigate('RoundResults' as never, {round: roundObj, year: y, initialRace} as never);
      }
    } else if (type === 'podcast') {
      console.log('[NOTIF] navigate → Podcasts');
      navigationRef.navigate('Podcasts' as never);
    }
  };
  if (navigationRef.isReady()) {
    go();
  } else {
    const iv = setInterval(() => {
      if (navigationRef.isReady()) { clearInterval(iv); go(); }
    }, 100);
    setTimeout(() => clearInterval(iv), 10000);
  }
}

// Keep old name for any legacy call sites
export function navigateToRound(round: string) {
  navigateFromData({round});
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

    // Notifee local notification tapped while app is in foreground
    const unsubscribeNotifee = notifee.onForegroundEvent(({type, detail}) => {
      if (type === EventType.PRESS) {
        console.log('[NOTIF] notifee press:', JSON.stringify(detail.notification?.data));
        navigateFromData(detail.notification?.data as Record<string, string>);
      }
    });

    // App opened from background by tapping an FCM notification
    const messaging = getMessaging();
    const unsubscribeBg = onNotificationOpenedApp(messaging, message => {
      console.log('[NOTIF] onNotificationOpenedApp:', JSON.stringify(message?.data));
      navigateFromData(message?.data as Record<string, string>);
    });

    // App launched cold by tapping an FCM notification
    getInitialNotification(messaging).then(message => {
      console.log('[NOTIF] getInitialNotification:', JSON.stringify(message?.data));
      navigateFromData(message?.data as Record<string, string>);
    });

    return () => { unsubscribeFg(); unsubscribeBg(); unsubscribeNotifee(); };
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
