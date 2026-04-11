import React, {createContext, useContext, useState, useCallback, useEffect, useRef} from 'react';
import {NativeModules, Platform} from 'react-native';

const TrackPlayer = Platform.OS === 'ios' ? require('react-native-track-player').default : null;
const {State, usePlaybackState: _usePlaybackState, Capability} = Platform.OS === 'ios' ? require('react-native-track-player') : {};
const useTrackState = Platform.OS === 'ios' ? _usePlaybackState : () => ({});

const {RadioService} = NativeModules;

const RadioContext = createContext({
  currentStation: null,
  isPlaying: false,
  play: () => {},
  stop: () => {},
});

let trackPlayerReady = false;
async function ensurePlayer() {
  if (trackPlayerReady) return;
  await TrackPlayer.setupPlayer();
  await TrackPlayer.updateOptions({
    capabilities: [Capability.Play, Capability.Stop],
    compactCapabilities: [Capability.Play, Capability.Stop],
  });
  trackPlayerReady = true;
}

export function RadioProvider({children}) {
  const [currentStation, setCurrentStation] = useState(null);
  const [isPlayingAndroid, setIsPlayingAndroid] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'android' || !RadioService) return;
    if (isPlayingAndroid) {
      pollRef.current = setInterval(async () => {
        const p = await RadioService.isPlaying();
        if (!p) { setIsPlayingAndroid(false); setCurrentStation(null); }
      }, 1500);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [isPlayingAndroid]);
  const playbackState = useTrackState();
  const iosPlaying = State
    ? (playbackState?.state === State.Playing || playbackState?.state === State.Buffering || playbackState?.state === State.Loading)
    : false;

  const isPlaying = Platform.OS === 'ios' ? iosPlaying : isPlayingAndroid;

  useEffect(() => {
    if (Platform.OS === 'android' && RadioService) {
      RadioService.isPlaying().then(p => {
        if (p) {
          setIsPlayingAndroid(true);
          RadioService.getStationName().then(n => setCurrentStation(n || null));
        }
      });
    }
  }, []);

  const play = useCallback(async (station) => {
    if (Platform.OS === 'ios') {
      await ensurePlayer();
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: station.name,
        url: station.streamUrl,
        title: station.name,
        artist: 'BTCC Radio',
        isLiveStream: true,
      });
      await TrackPlayer.play();
    } else if (RadioService) {
      RadioService.play(station.streamUrl, station.name);
      setIsPlayingAndroid(true);
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
    }
    setCurrentStation(null);
  }, []);

  return (
    <RadioContext.Provider value={{currentStation, isPlaying, play, stop}}>
      {children}
    </RadioContext.Provider>
  );
}

export function useRadio() {
  return useContext(RadioContext);
}
