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
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {View, TouchableOpacity, Text} from 'react-native';
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

jest.mock('../../src/components/AdBanner', () => ({__esModule: true, default: () => null}));

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

  it('does not show Chat tab when live_chat flag is off', async () => {
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
