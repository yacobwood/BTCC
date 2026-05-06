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
  });
});
