import React from 'react';
import {act, fireEvent, waitFor} from '@testing-library/react-native';
import RadioScreen from '../../src/screens/RadioScreen';
import {renderWithProviders, makeNav} from './testUtils';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn(), navItemClicked: jest.fn()},
}));

// RadioProvider uses TrackPlayer/native audio — stub the whole store
jest.mock('../../src/store/radio', () => ({
  useRadio: jest.fn(),
}));

const {useRadio} = require('../../src/store/radio');

const STATIONS = [
  {name: 'BTCC Radio', tagline: 'Live commentary', streamUrl: 'https://stream.btcc.net/live', coverage: 'All weekends'},
  {name: 'Radio Le Mans', tagline: 'Motorsport coverage', streamUrl: 'https://rle.stream', coverage: ''},
];

function mockRadioState({currentStation = null, isPlaying = false, play = jest.fn(), stop = jest.fn()} = {}) {
  useRadio.mockReturnValue({currentStation, isPlaying, play, stop});
}

function setupFetch(stations = STATIONS) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({stations}),
  });
}

const nav = makeNav();

describe('RadioScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRadioState();
    setupFetch();
  });

  // ── Loading / rendering ─────────────────────────────────────────────────────

  it('shows ActivityIndicator while stations are loading', () => {
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));
    const {UNSAFE_queryByType} = renderWithProviders(<RadioScreen navigation={nav} />);
    const {ActivityIndicator} = require('react-native');
    expect(UNSAFE_queryByType(ActivityIndicator)).toBeTruthy();
  });

  it('renders station names after fetch', async () => {
    const {getByText} = renderWithProviders(<RadioScreen navigation={nav} />);
    await waitFor(() => {
      expect(getByText('BTCC Radio')).toBeTruthy();
      expect(getByText('Radio Le Mans')).toBeTruthy();
    });
  });

  it('renders station taglines', async () => {
    const {getByText} = renderWithProviders(<RadioScreen navigation={nav} />);
    await waitFor(() => {
      expect(getByText('Live commentary')).toBeTruthy();
    });
  });

  it('renders coverage text when present', async () => {
    const {getByText} = renderWithProviders(<RadioScreen navigation={nav} />);
    await waitFor(() => {
      expect(getByText('All weekends')).toBeTruthy();
    });
  });

  it('shows empty state when no stations returned', async () => {
    setupFetch([]);
    const {getByText} = renderWithProviders(<RadioScreen navigation={nav} />);
    await waitFor(() => {
      expect(getByText('No stations available')).toBeTruthy();
    });
  });

  // ── Playback ─────────────────────────────────────────────────────────────────

  it('calls play when an inactive station is pressed', async () => {
    const play = jest.fn();
    mockRadioState({play});
    const {getByLabelText} = renderWithProviders(<RadioScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Play BTCC Radio'));
    fireEvent.press(getByLabelText('Play BTCC Radio'));
    expect(play).toHaveBeenCalledWith(expect.objectContaining({name: 'BTCC Radio'}));
  });

  it('calls stop when the currently playing station is pressed', async () => {
    const stop = jest.fn();
    mockRadioState({currentStation: 'BTCC Radio', isPlaying: true, stop});
    const {getByLabelText} = renderWithProviders(<RadioScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Stop BTCC Radio'));
    fireEvent.press(getByLabelText('Stop BTCC Radio'));
    expect(stop).toHaveBeenCalled();
  });

  it('shows Stop Radio button in header when isPlaying', async () => {
    mockRadioState({currentStation: 'BTCC Radio', isPlaying: true, stop: jest.fn()});
    const {getByLabelText} = renderWithProviders(<RadioScreen navigation={nav} />);
    await waitFor(() => expect(getByLabelText('Stop radio')).toBeTruthy());
  });

  it('does not show Stop Radio button when not playing', async () => {
    mockRadioState({isPlaying: false});
    const {queryByLabelText} = renderWithProviders(<RadioScreen navigation={nav} />);
    await waitFor(() => expect(queryByLabelText('Stop radio')).toBeNull());
  });

  // ── Navigation ────────────────────────────────────────────────────────────────

  it('navigates back when back button is pressed', async () => {
    const {getByLabelText} = renderWithProviders(<RadioScreen navigation={nav} />);
    fireEvent.press(getByLabelText('Go back'));
    expect(nav.goBack).toHaveBeenCalled();
  });
});
