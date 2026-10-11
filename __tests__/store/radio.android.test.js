import React from 'react';
import {render, act, fireEvent} from '@testing-library/react-native';
import {Text, TouchableOpacity} from 'react-native';

// radio.js picks its platform path at module load, so Platform.OS and the
// native RadioService must be in place before it's required.
const mockRadioService = {
  play: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  seekTo: jest.fn(),
  getStatus: jest.fn(() => Promise.resolve({isPlaying: false, isPaused: false, stationName: '', positionMs: 0, durationMs: 0})),
};

let RadioProvider;
let useRadio;

beforeAll(() => {
  const RN = require('react-native');
  RN.Platform.OS = 'android';
  RN.NativeModules.RadioService = mockRadioService;
  ({RadioProvider, useRadio} = require('../../src/store/radio'));
});

afterAll(() => {
  require('react-native').Platform.OS = 'ios';
});

function Harness() {
  const {currentStation, isPlaying, isPaused, progress, play, pause, resume, seekTo, stop} = useRadio();
  return (
    <>
      <Text testID="station">{currentStation ?? 'none'}</Text>
      <Text testID="state">{isPlaying ? 'playing' : isPaused ? 'paused' : 'idle'}</Text>
      <Text testID="position">{String(progress.position)}</Text>
      <Text testID="duration">{String(progress.duration)}</Text>
      <TouchableOpacity testID="play-podcast" onPress={() => play({name: 'Ep 1', streamUrl: 'http://pod.test/ep1.mp3', isLive: false})} />
      <TouchableOpacity testID="play-radio" onPress={() => play({name: 'FM', streamUrl: 'http://radio.test/live'})} />
      <TouchableOpacity testID="pause" onPress={() => pause()} />
      <TouchableOpacity testID="resume" onPress={() => resume()} />
      <TouchableOpacity testID="seek" onPress={() => seekTo(125.5)} />
      <TouchableOpacity testID="stop" onPress={() => stop()} />
    </>
  );
}

const renderRadio = () => render(<RadioProvider><Harness /></RadioProvider>);

describe('RadioProvider on Android', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('passes isLive through to the native service', async () => {
    const {getByTestId} = renderRadio();
    await act(async () => { fireEvent.press(getByTestId('play-podcast')); });
    expect(mockRadioService.play).toHaveBeenCalledWith('http://pod.test/ep1.mp3', 'Ep 1', false);
    await act(async () => { fireEvent.press(getByTestId('play-radio')); });
    expect(mockRadioService.play).toHaveBeenCalledWith('http://radio.test/live', 'FM', true);
  });

  it('pause keeps the station loaded and resume returns to playing', async () => {
    const {getByTestId} = renderRadio();
    await act(async () => { fireEvent.press(getByTestId('play-podcast')); });
    await act(async () => { fireEvent.press(getByTestId('pause')); });
    expect(mockRadioService.pause).toHaveBeenCalled();
    expect(getByTestId('state').props.children).toBe('paused');
    expect(getByTestId('station').props.children).toBe('Ep 1');
    await act(async () => { fireEvent.press(getByTestId('resume')); });
    expect(mockRadioService.resume).toHaveBeenCalled();
    expect(getByTestId('state').props.children).toBe('playing');
  });

  it('seekTo converts seconds to ms and updates position optimistically', async () => {
    const {getByTestId} = renderRadio();
    await act(async () => { fireEvent.press(getByTestId('play-podcast')); });
    await act(async () => { fireEvent.press(getByTestId('seek')); });
    expect(mockRadioService.seekTo).toHaveBeenCalledWith(125500);
    expect(getByTestId('position').props.children).toBe('125.5');
  });

  it('polls getStatus while paused and maps ms to seconds', async () => {
    const {getByTestId} = renderRadio();
    await act(async () => { fireEvent.press(getByTestId('play-podcast')); });
    await act(async () => { fireEvent.press(getByTestId('pause')); });
    mockRadioService.getStatus.mockResolvedValue({isPlaying: false, isPaused: true, stationName: 'Ep 1', positionMs: 30000, durationMs: 1800000});
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(getByTestId('position').props.children).toBe('30');
    expect(getByTestId('duration').props.children).toBe('1800');
    expect(getByTestId('state').props.children).toBe('paused');
  });

  it('clears the station when the service reports it finished', async () => {
    const {getByTestId} = renderRadio();
    await act(async () => { fireEvent.press(getByTestId('play-podcast')); });
    mockRadioService.getStatus.mockResolvedValue({isPlaying: false, isPaused: false, stationName: '', positionMs: 0, durationMs: 0});
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(getByTestId('station').props.children).toBe('none');
    expect(getByTestId('state').props.children).toBe('idle');
  });

  it('restores a paused podcast on mount', async () => {
    mockRadioService.getStatus.mockResolvedValueOnce({isPlaying: false, isPaused: true, stationName: 'Ep 9', positionMs: 5000, durationMs: 60000});
    const {getByTestId} = renderRadio();
    await act(async () => {});
    expect(getByTestId('station').props.children).toBe('Ep 9');
    expect(getByTestId('state').props.children).toBe('paused');
  });
});
