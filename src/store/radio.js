import React, {createContext, useContext, useState, useCallback, useEffect} from 'react';
import {NativeModules, Platform} from 'react-native';

const {RadioService} = NativeModules;

const RadioContext = createContext({
  currentStation: null,
  isPlaying: false,
  play: () => {},
  stop: () => {},
});

export function RadioProvider({children}) {
  const [currentStation, setCurrentStation] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Sync state on mount (e.g. if service was already playing)
  useEffect(() => {
    if (Platform.OS === 'android' && RadioService) {
      RadioService.isPlaying().then(p => {
        if (p) {
          setIsPlaying(true);
          RadioService.getStationName().then(n => setCurrentStation(n || null));
        }
      });
    }
  }, []);

  const play = useCallback((station) => {
    if (Platform.OS === 'android' && RadioService) {
      RadioService.play(station.streamUrl, station.name);
    }
    setCurrentStation(station.name);
    setIsPlaying(true);
  }, []);

  const stop = useCallback(() => {
    if (Platform.OS === 'android' && RadioService) {
      RadioService.stop();
    }
    setCurrentStation(null);
    setIsPlaying(false);
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
