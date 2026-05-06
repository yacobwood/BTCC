import React from 'react';
import {fireEvent, waitFor} from '@testing-library/react-native';
import LiveTimingScreen from '../../src/screens/LiveTimingScreen';
import {renderWithProviders, makeNav, makeRoute} from './testUtils';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn()},
}));

// Preserve FeatureFlagsProvider (used by AllProviders in testUtils) while mocking the hook
jest.mock('../../src/store/featureFlags', () => ({
  ...jest.requireActual('../../src/store/featureFlags'),
  useFeatureFlags: jest.fn(),
}));

const {useFeatureFlags} = require('../../src/store/featureFlags');

const nav = makeNav();
const route = makeRoute({eventId: '12345'});

describe('LiveTimingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFeatureFlags.mockReturnValue({live_timing_in_app: true});
  });

  // ── When flag is on ───────────────────────────────────────────────────────────

  it('renders LIVE TIMING header when flag is enabled', async () => {
    const {getByText} = renderWithProviders(<LiveTimingScreen route={route} navigation={nav} />);
    await waitFor(() => expect(getByText('LIVE TIMING')).toBeTruthy());
  });

  it('renders back button when flag is enabled', async () => {
    const {getByLabelText} = renderWithProviders(<LiveTimingScreen route={route} navigation={nav} />);
    await waitFor(() => expect(getByLabelText('Go back')).toBeTruthy());
  });

  it('navigates back when back button pressed', async () => {
    const {getByLabelText} = renderWithProviders(<LiveTimingScreen route={route} navigation={nav} />);
    await waitFor(() => getByLabelText('Go back'));
    fireEvent.press(getByLabelText('Go back'));
    expect(nav.goBack).toHaveBeenCalled();
  });

  // ── When flag is off ──────────────────────────────────────────────────────────

  it('renders null when live_timing_in_app flag is disabled', () => {
    useFeatureFlags.mockReturnValue({live_timing_in_app: false});
    const {toJSON} = renderWithProviders(<LiveTimingScreen route={route} navigation={nav} />);
    expect(toJSON()).toBeNull();
  });
});
