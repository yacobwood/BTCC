/**
 * Real, unmocked test of useTabPressReset against the ACTUAL
 * @react-navigation packages - jest.setup.js globally fakes
 * @react-navigation/native's useNavigation() (addListener/getParent as
 * no-ops) and both navigator factories, so nothing else in this suite
 * exercises the real tabPress mechanism at all. Two prior fix attempts
 * (2026-08-30) each reasoned about React Navigation's internals instead of
 * testing them directly, and were each wrong in a way no test caught -
 * this file exists specifically to stop guessing a third time.
 *
 * Every screen AppNavigator.js imports needs stubbing (same as
 * AppNavigator.test.js) purely so the module loads without pulling in their
 * native dependencies - unlike that file, bottom-tabs/native-stack and
 * react-native-safe-area-context are left real here, since those are
 * exactly the packages under test.
 */
jest.unmock('@react-navigation/native');
jest.unmock('@react-navigation/bottom-tabs');
jest.unmock('@react-navigation/native-stack');
jest.unmock('react-native-safe-area-context');

import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context';
import {useTabPressReset} from '../../src/navigation/useTabPressReset';

const makeScreen = name => () => React.createElement(Text, null, `screen-${name}`);
jest.mock('../../src/screens/NewsScreen',         () => ({__esModule: true, default: makeScreen('News')}));
jest.mock('../../src/screens/ArticleScreen',      () => ({__esModule: true, default: makeScreen('Article')}));
jest.mock('../../src/screens/CalendarScreen',     () => ({__esModule: true, default: makeScreen('Calendar')}));
jest.mock('../../src/screens/TrackDetailScreen',  () => ({__esModule: true, default: makeScreen('TrackDetail')}));
jest.mock('../../src/screens/LiveTimingScreen',   () => ({__esModule: true, default: makeScreen('LiveTiming')}));
jest.mock('../../src/screens/DriverDetailScreen', () => {
  const React = require('react');
  const {Text, TouchableOpacity} = require('react-native');
  return {
    __esModule: true,
    default: ({navigation}) => React.createElement(TouchableOpacity, {accessibilityLabel: 'Go back', onPress: () => navigation.goBack()},
      React.createElement(Text, null, 'screen-DriverDetail'),
    ),
  };
});
jest.mock('../../src/screens/TeamDetailScreen',   () => ({__esModule: true, default: makeScreen('TeamDetail')}));
jest.mock('../../src/screens/ResultsScreen',      () => ({__esModule: true, default: makeScreen('Results')}));
jest.mock('../../src/screens/RoundResultsScreen', () => ({__esModule: true, default: makeScreen('RoundResults')}));
jest.mock('../../src/screens/GalleryAlbumScreen', () => ({__esModule: true, default: makeScreen('GalleryAlbum')}));
jest.mock('../../src/screens/MoreScreen',         () => ({__esModule: true, default: makeScreen('More')}));
jest.mock('../../src/screens/SettingsScreen',     () => ({__esModule: true, default: makeScreen('Settings')}));
jest.mock('../../src/screens/InfoPageScreen',     () => ({__esModule: true, default: makeScreen('InfoPage')}));
jest.mock('../../src/screens/BugReportScreen',    () => ({__esModule: true, default: makeScreen('BugReport')}));
jest.mock('../../src/screens/RadioScreen',        () => ({__esModule: true, default: makeScreen('Radio')}));
jest.mock('../../src/screens/TocaRadioScreen',    () => ({__esModule: true, default: makeScreen('TocaRadio')}));
jest.mock('../../src/screens/PodcastsScreen',     () => ({__esModule: true, default: makeScreen('Podcasts')}));
jest.mock('../../src/screens/ListenScreen',       () => ({__esModule: true, default: makeScreen('Listen')}));
jest.mock('../../src/screens/DigestsScreen',      () => ({__esModule: true, default: makeScreen('Digests')}));
jest.mock('../../src/screens/RecordsScreen',      () => ({__esModule: true, default: makeScreen('Records')}));
jest.mock('../../src/screens/PartnersScreen',     () => ({__esModule: true, default: makeScreen('Partners')}));
jest.mock('../../src/screens/MerchScreen',        () => ({__esModule: true, default: makeScreen('Merch')}));
jest.mock('../../src/screens/RoadmapScreen',      () => ({__esModule: true, default: makeScreen('Roadmap')}));
jest.mock('../../src/components/ChatFab',         () => ({__esModule: true, default: () => null}));

// Module-level spy, not component state: a CommonActions.reset that pops
// back from a pushed screen may legitimately remount DriversScreen with a
// fresh route key, which would reset any local useState back to its initial
// value regardless of whether onTabPress actually ran - that's a real
// React/navigation nuance, not a bug, so asserting on component state would
// test the wrong thing. A plain jest.fn() call count survives that.
const mockOnTabPress = jest.fn();

// The one screen we need real behavior from, using the REAL exported hook -
// this is what actually proves the fix (not a reimplementation of it).
jest.mock('../../src/screens/DriversScreen', () => {
  const React = require('react');
  const {View, Text, TouchableOpacity} = require('react-native');
  const {useTabPressReset} = require('../../src/navigation/useTabPressReset');
  return {
    __esModule: true,
    default: ({navigation}) => {
      useTabPressReset(navigation, mockOnTabPress);
      return React.createElement(View, null,
        React.createElement(Text, null, 'List screen'),
        React.createElement(TouchableOpacity, {accessibilityLabel: 'Go to detail', onPress: () => navigation.navigate('DriverDetail')},
          React.createElement(Text, null, 'Go to detail'),
        ),
      );
    },
  };
});

const AppNavigator = require('../../src/navigation/AppNavigator').default;

const TEST_INSET_METRICS = {
  frame: {x: 0, y: 0, width: 320, height: 640},
  insets: {top: 0, left: 0, right: 0, bottom: 0},
};

function renderNav() {
  return render(
    React.createElement(SafeAreaProvider, {initialMetrics: initialWindowMetrics ?? TEST_INSET_METRICS},
      React.createElement(AppNavigator, {navigationRef: React.createRef()}),
    ),
  );
}

describe('useTabPressReset (real navigators, no mocks)', () => {
  beforeEach(() => mockOnTabPress.mockClear());

  it('calls onTabPress when the Grid tab is pressed while already on the root screen', async () => {
    const {getByText} = renderNav();
    await waitFor(() => expect(getByText('Grid')).toBeTruthy());
    await act(async () => { fireEvent.press(getByText('Grid')); });
    await waitFor(() => expect(getByText('List screen')).toBeTruthy());
    expect(mockOnTabPress).not.toHaveBeenCalled();

    await act(async () => { fireEvent.press(getByText('Grid')); });

    await waitFor(() => expect(mockOnTabPress).toHaveBeenCalledTimes(1));
  });

  it('calls onTabPress again on a second press while still on the root screen', async () => {
    const {getByText} = renderNav();
    await waitFor(() => expect(getByText('Grid')).toBeTruthy());
    await act(async () => { fireEvent.press(getByText('Grid')); });
    await waitFor(() => expect(getByText('List screen')).toBeTruthy());

    await act(async () => { fireEvent.press(getByText('Grid')); });
    await waitFor(() => expect(mockOnTabPress).toHaveBeenCalledTimes(1));

    await act(async () => { fireEvent.press(getByText('Grid')); });
    await waitFor(() => expect(mockOnTabPress).toHaveBeenCalledTimes(2));
  });

  it('pops back to the root screen and calls onTabPress when the Grid tab is pressed from a pushed detail screen', async () => {
    const {getByText} = renderNav();
    await waitFor(() => expect(getByText('Grid')).toBeTruthy());
    await act(async () => { fireEvent.press(getByText('Grid')); });
    await waitFor(() => expect(getByText('List screen')).toBeTruthy());

    await act(async () => { fireEvent.press(getByText('Go to detail')); });
    await waitFor(() => expect(getByText('screen-DriverDetail')).toBeTruthy());

    await act(async () => { fireEvent.press(getByText('Grid')); });

    await waitFor(() => expect(getByText('List screen')).toBeTruthy());
    expect(mockOnTabPress).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onTabPress on a plain back navigation (goBack, not tab press)', async () => {
    const {getByText, getByLabelText} = renderNav();
    await waitFor(() => expect(getByText('Grid')).toBeTruthy());
    await act(async () => { fireEvent.press(getByText('Grid')); });
    await waitFor(() => expect(getByText('List screen')).toBeTruthy());
    expect(mockOnTabPress).not.toHaveBeenCalled();

    await act(async () => { fireEvent.press(getByText('Go to detail')); });
    await waitFor(() => expect(getByText('screen-DriverDetail')).toBeTruthy());

    await act(async () => { fireEvent.press(getByLabelText('Go back')); });

    await waitFor(() => expect(getByText('List screen')).toBeTruthy());
    expect(mockOnTabPress).not.toHaveBeenCalled();
  });
});
