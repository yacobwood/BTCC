import React, {useEffect, useState} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import RNBootSplash from 'react-native-bootsplash';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from './src/navigation/AppNavigator';
import {FavouriteDriverProvider} from './src/store/favouriteDriver';
import {UnitsProvider} from './src/store/units';
import {SettingsProvider} from './src/store/settings';
import {RadioProvider} from './src/store/radio';
import {maybeRequestReview} from './src/utils/reviewPrompt';
import {runBackgroundPrefetch} from './src/utils/backgroundPrefetch';
import {setupNotificationChannels, requestNotificationPermission, onForegroundMessage} from './src/utils/notifications';
import {getCrashlytics, setCrashlyticsCollectionEnabled} from '@react-native-firebase/crashlytics';
import OnboardingDialog from './src/components/OnboardingDialog';
import WhatsNewDialog from './src/components/WhatsNewDialog';

const ONBOARDING_KEY = 'onboarding_shown';
const WHATS_NEW_KEY = 'whats_new_seen_version';
const CURRENT_VERSION = 39;

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  useEffect(() => {
    const crashlytics = getCrashlytics();
    setCrashlyticsCollectionEnabled(crashlytics, true);
    setupNotificationChannels();
    maybeRequestReview();
    runBackgroundPrefetch();

    const unsubscribe = onForegroundMessage(() => {});

    // Check onboarding and what's new
    (async () => {
      const onboardingShown = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!onboardingShown) {
        // Fresh install — mark current version as seen so What's New doesn't show
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

    return unsubscribe;
  }, []);

  const handleOnboardingAllow = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
    requestNotificationPermission();
    // Check what's new after onboarding
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
    <SafeAreaProvider>
    <FavouriteDriverProvider>
      <UnitsProvider>
        <SettingsProvider>
          <RadioProvider>
            <StatusBar barStyle="light-content" backgroundColor="#020255" />
            <AppNavigator />
            <OnboardingDialog visible={showOnboarding} onAllow={handleOnboardingAllow} onSkip={handleOnboardingSkip} />
            <WhatsNewDialog visible={showWhatsNew} onDismiss={handleWhatsNewDismiss} versionCode={CURRENT_VERSION} />
          </RadioProvider>
        </SettingsProvider>
      </UnitsProvider>
    </FavouriteDriverProvider>
    </SafeAreaProvider>
  );
}
