import React from 'react';
import {act, fireEvent, waitFor} from '@testing-library/react-native';
import {InteractionManager} from 'react-native';
import PodcastsScreen, {parseDurationSeconds, formatClock} from '../../src/screens/PodcastsScreen';
import {renderWithProviders, makeNav} from './testUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn(), navItemClicked: jest.fn()},
}));

jest.mock('../../src/store/radio', () => ({
  useRadio: jest.fn(),
}));

const {useRadio} = require('../../src/store/radio');

function mockRadio({
  currentStation = null, isPlaying = false, isPaused = false, progress = {position: 0, duration: 0},
  play = jest.fn(), stop = jest.fn(), pause = jest.fn(), resume = jest.fn(), seekTo = jest.fn(),
} = {}) {
  useRadio.mockReturnValue({currentStation, isPlaying, isPaused, progress, play, stop, pause, resume, seekTo});
}

const nav = makeNav();

// Valid RSS — avoids the component falling into error state so FlatList renders episodes
const SAMPLE_RSS = [
  '<rss><channel>',
  '<item>',
  '<title>Brands Hatch Race Review</title>',
  '<enclosure url="https://example.com/ep1.mp3" type="audio/mpeg" length="1000" />',
  '<pubDate>Mon, 01 Jan 2024 12:00:00 +0000</pubDate>',
  '<itunes:duration>45:30</itunes:duration>',
  '</item>',
  '<item>',
  '<title>Qualifying Podcast Special</title>',
  '<enclosure url="https://example.com/ep2.mp3" type="audio/mpeg" length="500" />',
  '<pubDate>Sat, 13 Jan 2024 10:00:00 +0000</pubDate>',
  '<itunes:duration>20:00</itunes:duration>',
  '</item>',
  '</channel></rss>',
].join('\n');

describe('PodcastsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRadio();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(undefined);
    // Run InteractionManager callbacks synchronously so the async load completes
    jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation(cb => {
      cb(); return {cancel: jest.fn()};
    });
    // Default: fetch returns valid RSS so episodes are loaded and error state is NOT triggered
    global.fetch.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(SAMPLE_RSS),
    });
  });

  afterEach(() => jest.restoreAllMocks());

  // ── Header ────────────────────────────────────────────────────────────────────

  it('renders PODCASTS header', () => {
    const {getByText} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    expect(getByText('PODCASTS')).toBeTruthy();
  });

  it('renders back button and navigates back when pressed', () => {
    const {getByLabelText} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    fireEvent.press(getByLabelText('Go back'));
    expect(nav.goBack).toHaveBeenCalled();
  });

  // ── Filter chips ──────────────────────────────────────────────────────────────

  it('renders all filter chips', () => {
    const {getByLabelText} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    expect(getByLabelText('Filter by All')).toBeTruthy();
    expect(getByLabelText('Filter by Race')).toBeTruthy();
    expect(getByLabelText('Filter by Qualifying')).toBeTruthy();
    expect(getByLabelText('Filter by Podcast')).toBeTruthy();
  });

  it('pressing a filter chip does not crash', () => {
    const {getByLabelText} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    expect(() => fireEvent.press(getByLabelText('Filter by Race'))).not.toThrow();
  });

  // ── Episode rendering ─────────────────────────────────────────────────────────

  it('renders episode title from RSS feed', async () => {
    const {getByText} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    await waitFor(() => expect(getByText('Brands Hatch Race Review')).toBeTruthy());
  });

  it('episode has accessible play label', async () => {
    const {getByLabelText} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    await waitFor(() => expect(getByLabelText('Play Brands Hatch Race Review')).toBeTruthy());
  });

  it('decodes HTML entities in a plain (non-CDATA) RSS title, e.g. Buzzsprout\'s "&amp;"', async () => {
    const rssWithEntity = [
      '<rss><channel>',
      '<item>',
      '<title>Tom Ingram &amp; Mikey Doble Join the BTCC Podcast</title>',
      '<enclosure url="https://example.com/ep3.mp3" type="audio/mpeg" length="1000" />',
      '<pubDate>Mon, 01 Jan 2024 12:00:00 +0000</pubDate>',
      '<itunes:duration>30:00</itunes:duration>',
      '</item>',
      '</channel></rss>',
    ].join('\n');
    global.fetch.mockResolvedValue({ok: true, text: jest.fn().mockResolvedValue(rssWithEntity)});
    const {getByText, queryByText} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    await waitFor(() => expect(getByText('Tom Ingram & Mikey Doble Join the BTCC Podcast')).toBeTruthy());
    expect(queryByText(/&amp;/)).toBeNull();
  });

  // ── Error state ───────────────────────────────────────────────────────────────

  it('shows error state when all fetch attempts fail and no cache', async () => {
    global.fetch.mockResolvedValue({ok: false, text: jest.fn().mockResolvedValue('')});
    const {getByText} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    await waitFor(() => expect(getByText('Could not load episodes')).toBeTruthy());
  });

  it('shows Retry button text in error state', async () => {
    global.fetch.mockResolvedValue({ok: false, text: jest.fn().mockResolvedValue('')});
    const {getByText} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    await waitFor(() => expect(getByText('Retry')).toBeTruthy());
  });

  // ── Playing state ─────────────────────────────────────────────────────────────

  it('shows Stop playback button in header when a podcast is playing', async () => {
    mockRadio({currentStation: 'Brands Hatch Race Review', isPlaying: true});
    const {getByLabelText} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    await waitFor(() => expect(getByLabelText('Stop playback')).toBeTruthy());
  });

  it('shows Stop label on currently-playing episode', async () => {
    mockRadio({currentStation: 'Brands Hatch Race Review', isPlaying: true});
    const {getByLabelText} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    await waitFor(() => expect(getByLabelText('Stop Brands Hatch Race Review')).toBeTruthy());
  });

  it('plays an episode as on-demand (isLive false) when tapped', async () => {
    const play = jest.fn();
    mockRadio({play});
    const {getByLabelText} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Play Brands Hatch Race Review'));
    fireEvent.press(getByLabelText('Play Brands Hatch Race Review'));
    expect(play).toHaveBeenCalledWith({name: 'Brands Hatch Race Review', streamUrl: 'https://example.com/ep1.mp3', isLive: false});
  });

  it('tapping the playing episode pauses it rather than stopping', async () => {
    const pause = jest.fn();
    const stop = jest.fn();
    mockRadio({currentStation: 'Brands Hatch Race Review', isPlaying: true, pause, stop});
    const {getByLabelText} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Pause Brands Hatch Race Review'));
    fireEvent.press(getByLabelText('Pause Brands Hatch Race Review'));
    expect(pause).toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it('tapping a paused episode resumes it and shows Paused', async () => {
    const resume = jest.fn();
    const play = jest.fn();
    mockRadio({currentStation: 'Brands Hatch Race Review', isPaused: true, resume, play});
    const {getByLabelText, getByText} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Resume Brands Hatch Race Review'));
    expect(getByText('Paused')).toBeTruthy();
    fireEvent.press(getByLabelText('Resume Brands Hatch Race Review'));
    expect(resume).toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it('keeps the header Stop button while paused', async () => {
    mockRadio({currentStation: 'Brands Hatch Race Review', isPaused: true});
    const {getByLabelText} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    await waitFor(() => expect(getByLabelText('Stop playback')).toBeTruthy());
  });

  it('per-episode Stop button calls stop()', async () => {
    const stop = jest.fn();
    mockRadio({currentStation: 'Brands Hatch Race Review', isPlaying: true, stop});
    const {getByLabelText} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Stop Brands Hatch Race Review'));
    fireEvent.press(getByLabelText('Stop Brands Hatch Race Review'));
    expect(stop).toHaveBeenCalled();
  });

  it('shows a progress bar with elapsed and total time only on the active episode', async () => {
    mockRadio({currentStation: 'Brands Hatch Race Review', isPlaying: true, progress: {position: 75, duration: 2730}});
    const {getAllByTestId, getByText} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    await waitFor(() => expect(getAllByTestId('podcast-progress')).toHaveLength(1));
    expect(getByText('1:15')).toBeTruthy();
    expect(getByText('45:30')).toBeTruthy();
  });

  it('falls back to the RSS duration before the player knows it', async () => {
    mockRadio({currentStation: 'Qualifying Podcast Special', isPlaying: true, progress: {position: 0, duration: 0}});
    const {getByTestId} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    await waitFor(() => getByTestId('podcast-progress'));
    expect(getByTestId('podcast-progress').props.accessibilityValue.max).toBe(1200);
  });

  it('seeks when the progress bar is tapped', async () => {
    const seekTo = jest.fn();
    mockRadio({currentStation: 'Brands Hatch Race Review', isPlaying: true, progress: {position: 0, duration: 1000}, seekTo});
    const {getByTestId} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    await waitFor(() => getByTestId('podcast-progress'));
    const bar = getByTestId('podcast-progress');
    act(() => { fireEvent(bar, 'layout', {nativeEvent: {layout: {width: 200}}}); });
    const touch = {nativeEvent: {locationX: 50, touches: [], changedTouches: []}, touchHistory: {touchBank: [], numberActiveTouches: 0}};
    act(() => {
      bar.props.onResponderGrant(touch);
      bar.props.onResponderRelease(touch);
    });
    expect(seekTo).toHaveBeenCalledWith(250);
  });

  it('skip buttons jump back 10s and forward 30s, clamped to the episode', async () => {
    const seekTo = jest.fn();
    mockRadio({currentStation: 'Brands Hatch Race Review', isPlaying: true, progress: {position: 5, duration: 20}, seekTo});
    const {getByLabelText} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Back 10 seconds'));
    fireEvent.press(getByLabelText('Back 10 seconds'));
    expect(seekTo).toHaveBeenLastCalledWith(0);
    fireEvent.press(getByLabelText('Forward 30 seconds'));
    expect(seekTo).toHaveBeenLastCalledWith(20);
  });

  it('screen-reader increment/decrement skips 15 seconds', async () => {
    const seekTo = jest.fn();
    mockRadio({currentStation: 'Brands Hatch Race Review', isPlaying: true, progress: {position: 100, duration: 1000}, seekTo});
    const {getByTestId} = renderWithProviders(<PodcastsScreen navigation={nav} />);
    await waitFor(() => getByTestId('podcast-progress'));
    fireEvent(getByTestId('podcast-progress'), 'accessibilityAction', {nativeEvent: {actionName: 'increment'}});
    expect(seekTo).toHaveBeenLastCalledWith(115);
    fireEvent(getByTestId('podcast-progress'), 'accessibilityAction', {nativeEvent: {actionName: 'decrement'}});
    expect(seekTo).toHaveBeenLastCalledWith(85);
  });

  it('parseDurationSeconds handles seconds, MM:SS and HH:MM:SS', () => {
    expect(parseDurationSeconds('2730')).toBe(2730);
    expect(parseDurationSeconds('45:30')).toBe(2730);
    expect(parseDurationSeconds('1:02:03')).toBe(3723);
    expect(parseDurationSeconds('')).toBe(0);
    expect(parseDurationSeconds('abc')).toBe(0);
  });

  it('formatClock adds hours only when needed', () => {
    expect(formatClock(75)).toBe('1:15');
    expect(formatClock(3723)).toBe('1:02:03');
    expect(formatClock(-3)).toBe('0:00');
  });

  // ── Cache hit must not skip the network re-fetch ─────────────────────────────
  // Regression test: the data-loading effect used to list `loading`/`refreshing`
  // in its dependency array, but its own body called setLoading(false) on a
  // cache hit before awaiting InteractionManager. On a real device, React
  // commits that state update - and runs this effect's cleanup - well before
  // InteractionManager's callback fires (a render commits within a frame;
  // InteractionManager can take far longer). The new effect instance's
  // `!loading && !refreshing` guard then exited immediately (both now false),
  // and the in-flight run's cleanup had already cancelled it, so the network
  // re-fetch was silently skipped, leaving stale cached data on screen
  // indefinitely. This test forces that exact interleaving deliberately -
  // flushing the cache-hit state update to completion via `act()` BEFORE
  // InteractionManager's callback is allowed to fire - rather than relying on
  // incidental timing, which a synchronous-callback mock papers over.
  it('still performs the network re-fetch after a cache hit, even when React flushes the resulting setLoading(false) before InteractionManager resolves', async () => {
    let resolveGetItem;
    AsyncStorage.getItem.mockReturnValueOnce(new Promise(r => { resolveGetItem = r; }));

    let capturedInteractionCb = null;
    InteractionManager.runAfterInteractions.mockImplementation(cb => {
      capturedInteractionCb = cb;
      return {cancel: jest.fn()};
    });

    const {getByText, queryByText} = renderWithProviders(<PodcastsScreen navigation={nav} />);

    // Resolve the cache read, then give React several microtask turns to
    // fully commit setLoading(false) - and this effect's cleanup - before
    // InteractionManager ever resolves.
    await act(async () => {
      resolveGetItem(JSON.stringify([
        {title: 'Cached Episode From Storage', url: 'https://example.com/cached.mp3', pubDate: '', duration: ''},
      ]));
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    });
    expect(getByText('Cached Episode From Storage')).toBeTruthy();

    // Now let InteractionManager's callback fire, as it would once the
    // screen transition actually finishes.
    await act(async () => {
      capturedInteractionCb();
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    });

    // The network re-fetch must still have fired and replaced the stale
    // cached episode - not been silently skipped.
    await waitFor(() => expect(getByText('Brands Hatch Race Review')).toBeTruthy());
    expect(global.fetch).toHaveBeenCalled();
    expect(queryByText('Cached Episode From Storage')).toBeNull();
  });
});
