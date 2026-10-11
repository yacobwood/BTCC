import React from 'react';
import {render, act, waitFor, fireEvent} from '@testing-library/react-native';
import {Text, TouchableOpacity} from 'react-native';
import {RadioProvider, useRadio} from '../../src/store/radio';

// react-native-track-player is globally mocked in jest.setup.js
// Add updateOptions which the global mock omits but ensurePlayer() calls
const TrackPlayer = require('react-native-track-player').default;
TrackPlayer.updateOptions = jest.fn(() => Promise.resolve());

// A test harness that exposes radio context state as Text nodes and play/stop triggers
function RadioTestHarness() {
  const {currentStation, play, stop} = useRadio();
  return (
    <>
      <Text testID="station">{currentStation ?? 'none'}</Text>
      <TouchableOpacity
        testID="play-btn"
        onPress={() => play({name: 'Test FM', streamUrl: 'http://stream.test/live'})}
      />
      <TouchableOpacity testID="stop-btn" onPress={() => stop()} />
    </>
  );
}

function ControlsHarness() {
  const {isPlaying, isPaused, play, pause, resume, seekTo} = useRadio();
  return (
    <>
      <Text testID="playing">{isPlaying ? 'yes' : 'no'}</Text>
      <Text testID="paused">{isPaused ? 'yes' : 'no'}</Text>
      <TouchableOpacity
        testID="play-podcast"
        onPress={() => play({name: 'Ep 1', streamUrl: 'http://pod.test/ep1.mp3', isLive: false})}
      />
      <TouchableOpacity testID="pause" onPress={() => pause()} />
      <TouchableOpacity testID="resume" onPress={() => resume()} />
      <TouchableOpacity testID="seek-90" onPress={() => seekTo(90)} />
      <TouchableOpacity testID="seek-neg" onPress={() => seekTo(-5)} />
    </>
  );
}

function renderRadio() {
  return render(
    <RadioProvider>
      <RadioTestHarness />
    </RadioProvider>,
  );
}

describe('RadioProvider / useRadio', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Initial state ─────────────────────────────────────────────────────────────

  it('starts with no current station', () => {
    const {getByTestId} = renderRadio();
    expect(getByTestId('station').props.children).toBe('none');
  });

  // ── play() ────────────────────────────────────────────────────────────────────

  it('sets currentStation after play()', async () => {
    const {getByTestId} = renderRadio();
    await act(async () => { fireEvent.press(getByTestId('play-btn')); });
    await waitFor(() =>
      expect(getByTestId('station').props.children).toBe('Test FM'),
    );
  });

  it('calls TrackPlayer.add with correct track data', async () => {
    const {getByTestId} = renderRadio();
    await act(async () => { fireEvent.press(getByTestId('play-btn')); });
    expect(TrackPlayer.add).toHaveBeenCalledWith(
      expect.objectContaining({url: 'http://stream.test/live', title: 'Test FM'}),
    );
  });

  it('calls TrackPlayer.play after adding track', async () => {
    const {getByTestId} = renderRadio();
    await act(async () => { fireEvent.press(getByTestId('play-btn')); });
    expect(TrackPlayer.play).toHaveBeenCalled();
  });

  // ── stop() ────────────────────────────────────────────────────────────────────

  it('clears currentStation after stop()', async () => {
    const {getByTestId} = renderRadio();
    await act(async () => { fireEvent.press(getByTestId('play-btn')); });
    await waitFor(() => expect(getByTestId('station').props.children).toBe('Test FM'));
    await act(async () => { fireEvent.press(getByTestId('stop-btn')); });
    await waitFor(() => expect(getByTestId('station').props.children).toBe('none'));
  });

  it('calls TrackPlayer.stop on stop()', async () => {
    const {getByTestId} = renderRadio();
    await act(async () => { fireEvent.press(getByTestId('play-btn')); });
    await act(async () => { fireEvent.press(getByTestId('stop-btn')); });
    expect(TrackPlayer.stop).toHaveBeenCalled();
  });

  it('calls TrackPlayer.reset on stop()', async () => {
    const {getByTestId} = renderRadio();
    await act(async () => { fireEvent.press(getByTestId('play-btn')); });
    await act(async () => { fireEvent.press(getByTestId('stop-btn')); });
    expect(TrackPlayer.reset).toHaveBeenCalled();
  });

  // ── pause / resume / seek ───────────────────────────────────────────────────

  it('passes isLiveStream false and a podcast artist for on-demand episodes', async () => {
    const {getByTestId} = render(
      <RadioProvider><ControlsHarness /></RadioProvider>,
    );
    await act(async () => { fireEvent.press(getByTestId('play-podcast')); });
    expect(TrackPlayer.add).toHaveBeenCalledWith(
      expect.objectContaining({isLiveStream: false, artist: 'BTCC Podcast'}),
    );
  });

  it('keeps radio streams live by default', async () => {
    const {getByTestId} = renderRadio();
    await act(async () => { fireEvent.press(getByTestId('play-btn')); });
    expect(TrackPlayer.add).toHaveBeenCalledWith(
      expect.objectContaining({isLiveStream: true, artist: 'BTCC Radio'}),
    );
  });

  it('pause() calls TrackPlayer.pause and resume() calls TrackPlayer.play', async () => {
    const {getByTestId} = render(<RadioProvider><ControlsHarness /></RadioProvider>);
    await act(async () => { fireEvent.press(getByTestId('pause')); });
    expect(TrackPlayer.pause).toHaveBeenCalled();
    TrackPlayer.play.mockClear();
    await act(async () => { fireEvent.press(getByTestId('resume')); });
    expect(TrackPlayer.play).toHaveBeenCalled();
  });

  it('seekTo() seeks in seconds and clamps negatives to 0', async () => {
    const {getByTestId} = render(<RadioProvider><ControlsHarness /></RadioProvider>);
    await act(async () => { fireEvent.press(getByTestId('seek-90')); });
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(90);
    await act(async () => { fireEvent.press(getByTestId('seek-neg')); });
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(0);
  });

  it('reports isPaused from the TrackPlayer Paused state', () => {
    const {usePlaybackState} = require('react-native-track-player');
    usePlaybackState.mockReturnValueOnce({state: 'paused'});
    const {getByTestId} = render(<RadioProvider><ControlsHarness /></RadioProvider>);
    expect(getByTestId('paused').props.children).toBe('yes');
    expect(getByTestId('playing').props.children).toBe('no');
  });

  // ── useRadio outside provider ─────────────────────────────────────────────────

  it('useRadio() returns default context values outside a provider', () => {
    let result;
    function Consumer() {
      result = useRadio();
      return null;
    }
    expect(() => render(<Consumer />)).not.toThrow();
    expect(result.currentStation).toBeNull();
    expect(result.isPlaying).toBe(false);
    expect(result.isPaused).toBe(false);
    expect(result.progress).toEqual({position: 0, duration: 0});
  });
});
