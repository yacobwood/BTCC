import React, {useEffect, useRef} from 'react';
import {View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {NavigationContainer, useNavigation} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {CommonActions} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';

// Hook to reset stack to root when its parent tab is pressed
function useResetStackOnTabPress(navigation, tabName) {
  useEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;
    const unsubscribe = parent.addListener('tabPress', (e) => {
      const state = navigation.getState();
      if (state && state.routes && state.routes.length > 1) {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{name: state.routes[0].name}],
          })
        );
      }
    });
    return unsubscribe;
  }, [navigation, tabName]);
}

import NewsScreen from '../screens/NewsScreen';
import ArticleScreen from '../screens/ArticleScreen';
import CalendarScreen from '../screens/CalendarScreen';
import TrackDetailScreen from '../screens/TrackDetailScreen';
import LiveTimingScreen from '../screens/LiveTimingScreen';
import DriversScreen from '../screens/DriversScreen';
import DriverDetailScreen from '../screens/DriverDetailScreen';
import TeamDetailScreen from '../screens/TeamDetailScreen';
import ResultsScreen from '../screens/ResultsScreen';
import RoundResultsScreen from '../screens/RoundResultsScreen';
import MoreScreen from '../screens/MoreScreen';
import SettingsScreen from '../screens/SettingsScreen';
import InfoPageScreen from '../screens/InfoPageScreen';
import BugReportScreen from '../screens/BugReportScreen';
import RadioScreen from '../screens/RadioScreen';
import PodcastsScreen from '../screens/PodcastsScreen';
import AdBanner from '../components/AdBanner';
import {useFeatureFlags} from '../store/featureFlags';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const screenOptions = {
  headerShown: false,
  contentStyle: {backgroundColor: Colors.background},
};

function NewsStack() {
  const navigation = useNavigation();
  useResetStackOnTabPress(navigation, 'News');
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="NewsFeed" component={NewsScreen} />
      <Stack.Screen name="Article" component={ArticleScreen} />
    </Stack.Navigator>
  );
}

function CalendarStack() {
  const navigation = useNavigation();
  useResetStackOnTabPress(navigation, 'Calendar');
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="CalendarList" component={CalendarScreen} />
      <Stack.Screen name="TrackDetail" component={TrackDetailScreen} />
      <Stack.Screen name="LiveTiming" component={LiveTimingScreen} />
    </Stack.Navigator>
  );
}

function DriversStack() {
  const navigation = useNavigation();
  useResetStackOnTabPress(navigation, 'Grid');
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="DriversList" component={DriversScreen} />
      <Stack.Screen name="DriverDetail" component={DriverDetailScreen} />
      <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
    </Stack.Navigator>
  );
}

function ResultsStack() {
  const navigation = useNavigation();
  useResetStackOnTabPress(navigation, 'Results');
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ResultsList" component={ResultsScreen} />
      <Stack.Screen name="RoundResults" component={RoundResultsScreen} />
    </Stack.Navigator>
  );
}

function MoreStack() {
  const navigation = useNavigation();
  useResetStackOnTabPress(navigation, 'More');
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="MoreMenu" component={MoreScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="InfoPage" component={InfoPageScreen} />
      <Stack.Screen name="BugReport" component={BugReportScreen} />
      <Stack.Screen name="Radio" component={RadioScreen} />
      <Stack.Screen name="Podcasts" component={PodcastsScreen} />
    </Stack.Navigator>
  );
}

const tabIcons = {
  News: 'article',
  Calendar: 'date-range',
  Grid: 'groups',
  Results: 'emoji-events',
  More: 'more-horiz',
};

const linking = {
  prefixes: ['btccfanhub://', 'https://btcchub.vercel.app'],
  config: {
    screens: {
      News: {
        screens: {
          Article: 'news/:slug',
        },
      },
      Calendar: {
        screens: {
          TrackDetail: 'round/:round',
          LiveTiming: 'live-timing/:eventId',
        },
      },
    },
  },
};

function AppContent({adBannerRef}) {
  const {bottom} = useSafeAreaInsets();
  const {banner_ad} = useFeatureFlags();
  return (
    <View style={{flex: 1}}>
      <Tab.Navigator
          screenOptions={({route}) => ({
            headerShown: false,
            tabBarIcon: ({color, size}) => (
              <Icon name={tabIcons[route.name]} size={size} color={color} />
            ),
            tabBarActiveTintColor: Colors.yellow,
            tabBarInactiveTintColor: Colors.textSecondary,
            tabBarStyle: {
              backgroundColor: Colors.surface,
              borderTopColor: Colors.outline,
              borderTopWidth: 1,
              paddingBottom: 0,
              height: 56,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '700',
            },
            unmountOnBlur: true,
          })}>
          <Tab.Screen name="News" component={NewsStack} />
          <Tab.Screen name="Calendar" component={CalendarStack} />
          <Tab.Screen name="Grid" component={DriversStack} />
          <Tab.Screen name="Results" component={ResultsStack} options={{unmountOnBlur: false}} />
          <Tab.Screen name="More" component={MoreStack} />
        </Tab.Navigator>
        {banner_ad && (
          <View style={{paddingBottom: bottom}}>
            <AdBanner ref={adBannerRef} />
          </View>
        )}
      </View>
  );
}

export default function AppNavigator({navigationRef}) {
  const adBannerRef = useRef(null);
  const prevTabRef = useRef(0);

  const handleStateChange = (state) => {
    if (state?.index !== undefined && state.index !== prevTabRef.current) {
      prevTabRef.current = state.index;
      adBannerRef.current?.load();
    }
  };

  return (
    <NavigationContainer ref={navigationRef} linking={linking} onStateChange={handleStateChange}>
      <AppContent adBannerRef={adBannerRef} />
    </NavigationContainer>
  );
}
