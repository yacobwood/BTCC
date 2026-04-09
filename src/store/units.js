import React, {createContext, useContext, useState, useCallback, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'use_km';
const UnitsContext = createContext({useKm: false, toggleUnits: () => {}});

export function UnitsProvider({children}) {
  const [useKm, setUseKm] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => { if (v === 'true') setUseKm(true); }).catch(() => {});
  }, []);

  const toggleUnits = useCallback((km) => {
    setUseKm(km);
    AsyncStorage.setItem(KEY, String(km)).catch(() => {});
  }, []);

  return (
    <UnitsContext.Provider value={{useKm, toggleUnits}}>
      {children}
    </UnitsContext.Provider>
  );
}

export function useUnits() {
  return useContext(UnitsContext);
}
