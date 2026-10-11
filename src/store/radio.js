import React, {createContext, useContext, useState, useCallback, useEffect, useRef} from 'react';
import {NativeModules, Platform} from 'react-native';

const TrackPlayer = Platform.OS === 'ios' ? require('react-native-track-player').default : null;
const {State, usePlaybackState: _usePlaybackState, useProgress: _useProgress, Capability} = Platform.OS === 'ios' ? require('react-native-track-player') : {};
const useTrackState = Platform.OS === 'ios' ? _usePlaybackState : () => ({});
const useTrackProgress = Platform.OS === 'ios' ? _useProgress : () => null;

const {RadioService} = NativeModules;

// Android has no progress event, so RadioService.getStatus() is polled while
// something is loaded (playing OR paused - a paused podcast must keep its
// station so the UI can still show its progress bar and a resume button).
const ANDROID_POLL_MS = 1000;

const NO_PROGRESS = {position: 0, duration: 0};

const RadioContext = createContext({
  currentStation: null,
  isPlaying: false,
  isPaused: false,
  progress: NO_PROGRESS,
  play: () => {},
  stop: () => {},
  pause: () => {},
  resume: () => {},
  seekTo: () => {},
});

let trackPlayerReady = false;
async function ensurePlayer() {
  if (trackPlayerReady) return;
  await TrackPlayer.setupPlayer();
  await TrackPlayer.updateOptions({
    capabilities: [Capability.Play, Capability.Pause, Capability.Stop, Capability.SeekTo],
    compactCapabilities: [Capability.Play, Capability.Pause, Capability.Stop],
  });
  trackPlayerReady = true;
}

export function RadioProvider({children}) {
  const [currentStation, setCurrentStation] = useState(null);
  const [isPlayingAndroid, setIsPlayingAndroid] = useState(false);
  const [isPausedAndroid, setIsPausedAndroid] = useState(false);
  const [progressAndroid, setProgressAndroid] = useState(NO_PROGRESS);
  const pollRef = useRef(null);

  const applyAndroidStatus = useCallback((s) => {
    if (!s || (!s.isPlaying && !s.isPaused)) {
      setIsPlayingAndroid(false);
      setIsPausedAndroid(false);
      setProgressAndroid(NO_PROGRESS);
      setCurrentStation(null);
      return;
    }
    setIsPlayingAndroid(!!s.isPlaying);
    setIsPausedAndroid(!!s.isPaused);
    setProgressAndroid({position: (s.positionMs || 0) / 1000, duration: (s.durationMs || 0) / 1000});
  }, []);

  const androidActive = isPlayingAndroid || isPausedAndroid;
  useEffect(() => {
    if (Platform.OS !== 'android' || !RadioService) return;
    if (androidActive) {
      pollRef.current = setInterval(async () => {
        applyAndroidStatus(await RadioService.getStatus());
      }, ANDROID_POLL_MS);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [androidActive, applyAndroidStatus]);

  const playbackState = useTrackState();
  const iosProgress = useTrackProgress(1000);
  const iosPlaying = State
    ? (playbackState?.state === State.Playing || playbackState?.state === State.Buffering || playbackState?.state === State.Loading)
    : false;
  const iosPaused = State ? playbackState?.state === State.Paused : false;

  const isPlaying = Platform.OS === 'ios' ? iosPlaying : isPlayingAndroid;
  const isPaused = Platform.OS === 'ios' ? iosPaused : isPausedAndroid;
  const progress = Platform.OS === 'ios'
    ? (currentStation && iosProgress ? {position: iosProgress.position || 0, duration: iosProgress.duration || 0} : NO_PROGRESS)
    : progressAndroid;

  useEffect(() => {
    if (Platform.OS === 'android' && RadioService) {
      RadioService.getStatus().then(s => {
        if (s && (s.isPlaying || s.isPaused)) {
          applyAndroidStatus(s);
          setCurrentStation(s.stationName || null);
        }
      });
    }
  }, [applyAndroidStatus]);

  // station.isLive defaults to true (radio streams); podcasts pass false so the
  // player treats them as seekable on-demand audio.
  const play = useCallback(async (station) => {
    const isLive = station.isLive !== false;
    if (Platform.OS === 'ios') {
      await ensurePlayer();
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: station.name,
        url: station.streamUrl,
        title: station.name,
        artist: isLive ? 'BTCC Radio' : 'BTCC Podcast',
        isLiveStream: isLive,
      });
      await TrackPlayer.play();
    } else if (RadioService) {
      RadioService.play(station.streamUrl, station.name, isLive);
      setIsPlayingAndroid(true);
      setIsPausedAndroid(false);
      setProgressAndroid(NO_PROGRESS);
    }
    setCurrentStation(station.name);
  }, []);

  const stop = useCallback(async () => {
    if (Platform.OS === 'ios') {
      await TrackPlayer.stop();
      await TrackPlayer.reset();
    } else if (RadioService) {
      RadioService.stop();
      setIsPlayingAndroid(false);
      setIsPausedAndroid(false);
      setProgressAndroid(NO_PROGRESS);
    }
    setCurrentStation(null);
  }, []);

  const pause = useCallback(async () => {
    if (Platform.OS === 'ios') {
      await TrackPlayer.pause();
    } else if (RadioService) {
      RadioService.pause();
      setIsPlayingAndroid(false);
      setIsPausedAndroid(true);
    }
  }, []);

  const resume = useCallback(async () => {
    if (Platform.OS === 'ios') {
      await TrackPlayer.play();
    } else if (RadioService) {
      RadioService.resume();
      setIsPlayingAndroid(true);
      setIsPausedAndroid(false);
    }
  }, []);

  // seconds, matching `progress`
  const seekTo = useCallback(async (seconds) => {
    const target = Math.max(0, seconds);
    if (Platform.OS === 'ios') {
      await TrackPlayer.seekTo(target);
    } else if (RadioService) {
      RadioService.seekTo(target * 1000);
      // Optimistic so the bar doesn't snap back until the next poll lands.
      setProgressAndroid(p => ({...p, position: target}));
    }
  }, []);

  return (
    <RadioContext.Provider value={{currentStation, isPlaying, isPaused, progress, play, stop, pause, resume, seekTo}}>
      {children}
    </RadioContext.Provider>
  );
}

export function useRadio() {
  return useContext(RadioContext);
}
