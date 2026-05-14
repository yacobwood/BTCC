/**
 * AppNavigator smoke tests.
 *
 * Verifies the navigation shell renders the correct tabs and can switch
 * between them. All screen components are stubbed to prevent API calls.
 *
 * The global jest.setup.js mocks Screen as () => null (needed for isolated
 * screen tests). This file overrides the tab and stack navigators with a
 * minimal stateful implementation that actually renders labels and content.
 */
import React, {useState} from 'react';
import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {View, TouchableOpacity, Text, Platform} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import {AllProviders} from '../screens/testUtils';

// ── Tab navigator — renders a fake tab bar and the active screen's content ────
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => {
    function Navigator({children, screenOptions}) {
      const React = require('react');
      const {useState} = require('react');
      const {View, TouchableOpacity, Text} = require('react-native');

      const screenList = React.Children.toArray(children).filter(Boolean);
      const [activeIdx, setActiveIdx] = useState(0);
      const active = screenList[activeIdx];

      const label = active
        ? (active.props.options?.tabBarLabel ?? active.props.name)
        : null;
      const Comp = active?.props?.component;
      const fakeNav = {
        navigate: jest.fn(), goBack: jest.fn(), dispatch: jest.fn(),
        addListener: jest.fn(() => jest.fn()),
        getParent: jest.fn(() => ({addListener: jest.fn(() => jest.fn())})),
        getState: jest.fn(() => ({routes: [{name: 'NewsFeed'}], index: 0})),
      };

      return (
        <View>
          <View testID="tab-bar">
            {screenList.map((s, i) => {
              const tabLabel = s.props.options?.tabBarLabel ?? s.props.name;
              return (
                <TouchableOpacity
                  key={s.props.name}
                  testID={`tab-${s.props.name}`}
                  accessibilityLabel={tabLabel}
                  onPress={() => setActiveIdx(i)}>
                  <Text>{tabLabel}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {Comp ? <Comp navigation={fakeNav} route={{params: {}}} /> : null}
        </View>
      );
    }

    function Screen() { return null; }
    return {Navigator, Screen};
  },
}));

// ── Stack navigator — renders the first screen immediately ────────────────────
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => {
    function Navigator({children}) {
      const React = require('react');
      const screenList = React.Children.toArray(children).filter(Boolean);
      const first = screenList[0];
      if (!first) return null;
      const Comp = first.props.component;
      const fakeNav = {
        navigate: jest.fn(), goBack: jest.fn(), dispatch: jest.fn(),
        addListener: jest.fn(() => jest.fn()),
        getParent: jest.fn(() => ({addListener: jest.fn(() => jest.fn())})),
        getState: jest.fn(() => ({routes: [{name: 'NewsFeed'}], index: 0})),
      };
      return Comp ? <Comp navigation={fakeNav} route={{params: {}}} /> : null;
    }
    function Screen() { return null; }
    return {Navigator, Screen};
  },
}));

// ── Stub every screen so no API calls happen ──────────────────────────────────
const makeScreen = name => () => <View testID={`screen-${name}`} />;

jest.mock('../../src/screens/NewsScreen',         () => ({__esModule: true, default: makeScreen('News')}));
jest.mock('../../src/screens/ArticleScreen',      () => ({__esModule: true, default: makeScreen('Article')}));
jest.mock('../../src/screens/CalendarScreen',     () => ({__esModule: true, default: makeScreen('Calendar')}));
jest.mock('../../src/screens/TrackDetailScreen',  () => ({__esModule: true, default: makeScreen('TrackDetail')}));
jest.mock('../../src/screens/LiveTimingScreen',   () => ({__esModule: true, default: makeScreen('LiveTiming')}));
jest.mock('../../src/screens/DriversScreen',      () => ({__esModule: true, default: makeScreen('Drivers')}));
jest.mock('../../src/screens/DriverDetailScreen', () => ({__esModule: true, default: makeScreen('DriverDetail')}));
jest.mock('../../src/screens/TeamDetailScreen',   () => ({__esModule: true, default: makeScreen('TeamDetail')}));
jest.mock('../../src/screens/ResultsScreen',      () => ({__esModule: true, default: makeScreen('Results')}));
jest.mock('../../src/screens/RoundResultsScreen', () => ({__esModule: true, default: makeScreen('RoundResults')}));
jest.mock('../../src/screens/MoreScreen',         () => ({__esModule: true, default: makeScreen('More')}));
jest.mock('../../src/screens/SettingsScreen',     () => ({__esModule: true, default: makeScreen('Settings')}));
jest.mock('../../src/screens/InfoPageScreen',     () => ({__esModule: true, default: makeScreen('InfoPage')}));
jest.mock('../../src/screens/BugReportScreen',    () => ({__esModule: true, default: makeScreen('BugReport')}));
jest.mock('../../src/screens/RadioScreen',        () => ({__esModule: true, default: makeScreen('Radio')}));
jest.mock('../../src/screens/TocaRadioScreen',    () => ({__esModule: true, default: makeScreen('TocaRadio')}));
jest.mock('../../src/screens/PodcastsScreen',     () => ({__esModule: true, default: makeScreen('Podcasts')}));
jest.mock('../../src/screens/RecordsScreen',      () => ({__esModule: true, default: makeScreen('Records')}));
jest.mock('../../src/screens/PartnersScreen',     () => ({__esModule: true, default: makeScreen('Partners')}));
jest.mock('../../src/screens/RoadmapScreen',      () => ({__esModule: true, default: makeScreen('Roadmap')}));
jest.mock('../../src/screens/ChatScreen',         () => ({__esModule: true, default: makeScreen('Chat')}));

jest.mock('../../src/components/ChatFab', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../src/components/AdBanner', () => {
  const {forwardRef} = require('react');
  return {
    __esModule: true,
    default: forwardRef((_props, _ref) => {
      const {View} = require('react-native');
      return <View testID="ad-banner" />;
    }),
  };
});

jest.mock('../../src/components/UpdateDialog', () => ({
  __esModule: true,
  default: ({visible, onDismiss}) => {
    const {View, TouchableOpacity, Text} = require('react-native');
    if (!visible) return null;
    return (
      <View testID="update-dialog">
        <TouchableOpacity testID="update-dialog-dismiss" onPress={onDismiss} />
      </View>
    );
  },
}));

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: () => Promise.resolve({}),
  });
});

function renderNav() {
  const AppNavigator = require('../../src/navigation/AppNavigator').default;
  return render(
    <AllProviders>
      <AppNavigator navigationRef={React.createRef()} />
    </AllProviders>,
  );
}

describe('AppNavigator', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders without crashing', async () => {
    const {toJSON} = renderNav();
    await waitFor(() => expect(toJSON()).toBeTruthy());
  });

  it('shows the News tab label', async () => {
    const {getByText} = renderNav();
    await waitFor(() => expect(getByText('News')).toBeTruthy());
  });

  it('shows the Calendar tab label', async () => {
    const {getByText} = renderNav();
    await waitFor(() => expect(getByText('Calendar')).toBeTruthy());
  });

  it('shows the Grid tab label', async () => {
    const {getByText} = renderNav();
    await waitFor(() => expect(getByText('Grid')).toBeTruthy());
  });

  it('shows the Season (Results) tab label', async () => {
    const {getByText} = renderNav();
    await waitFor(() => expect(getByText('Season')).toBeTruthy());
  });

  it('shows the More tab label', async () => {
    const {getByText} = renderNav();
    await waitFor(() => expect(getByText('More')).toBeTruthy());
  });

  it('does not show a Chat tab (chat is now a floating button)', async () => {
    const {queryByText} = renderNav();
    await waitFor(() => expect(queryByText('Chat')).toBeNull());
  });

  it('mounts the News screen initially', async () => {
    const {getByTestId} = renderNav();
    await waitFor(() => expect(getByTestId('screen-News')).toBeTruthy());
  });

  it('navigates to Calendar tab when pressed', async () => {
    const {getByText, getByTestId} = renderNav();
    await waitFor(() => getByText('Calendar'));
    fireEvent.press(getByText('Calendar'));
    await waitFor(() => expect(getByTestId('screen-Calendar')).toBeTruthy());
  });

  it('navigates to Grid tab when pressed', async () => {
    const {getByText, getByTestId} = renderNav();
    await waitFor(() => getByText('Grid'));
    fireEvent.press(getByText('Grid'));
    await waitFor(() => expect(getByTestId('screen-Drivers')).toBeTruthy());
  });

  it('navigates to More tab when pressed', async () => {
    const {getByText, getByTestId} = renderNav();
    await waitFor(() => getByText('More'));
    fireEvent.press(getByText('More'));
    await waitFor(() => expect(getByTestId('screen-More')).toBeTruthy());
  });
});

describe('AppNavigator — update dialog', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    // Default flags: update_available=true, update_min_version_android=63
    // Default DeviceInfo mock: getBuildNumber() = '999'
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('shows when Android build number is below update_min_version_android', async () => {
    DeviceInfo.getBuildNumber.mockReturnValue('62'); // 62 < default min 63
    const {getByTestId} = renderNav();
    await waitFor(() => expect(getByTestId('update-dialog')).toBeTruthy());
  });

  it('does not show when Android build number meets update_min_version_android', async () => {
    DeviceInfo.getBuildNumber.mockReturnValue('63'); // 63 is not < 63
    const {queryByTestId} = renderNav();
    await waitFor(() => expect(queryByTestId('update-dialog')).toBeNull());
  });

  it('does not show when Android build number is above update_min_version_android', async () => {
    DeviceInfo.getBuildNumber.mockReturnValue('999'); // default, well above min
    const {queryByTestId} = renderNav();
    await waitFor(() => expect(queryByTestId('update-dialog')).toBeNull());
  });

  it('hides after dismiss is called', async () => {
    DeviceInfo.getBuildNumber.mockReturnValue('62');
    const {getByTestId, queryByTestId} = renderNav();
    await waitFor(() => expect(getByTestId('update-dialog')).toBeTruthy());
    fireEvent.press(getByTestId('update-dialog-dismiss'));
    await waitFor(() => expect(queryByTestId('update-dialog')).toBeNull());
  });

  it('does not show on iOS when update_min_version_ios is 0', async () => {
    Platform.OS = 'ios';
    DeviceInfo.getBuildNumber.mockReturnValue('1'); // any build > 0
    const {queryByTestId} = renderNav();
    await waitFor(() => expect(queryByTestId('update-dialog')).toBeNull());
  });
});
