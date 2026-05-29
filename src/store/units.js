import React, {createContext, useContext, useState, useCallback, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAuth} from './auth';
import {saveProfile} from '../utils/userProfile';

const KEY = 'use_km';
const UnitsContext = createContext({useKm: false, toggleUnits: () => {}});

export function UnitsProvider({children}) {
  const {user} = useAuth();
  const [useKm, setUseKm] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => { setUseKm(v === 'true'); }).catch(() => {});
  }, [user]);

  const toggleUnits = useCallback((km) => {
    setUseKm(km);
    AsyncStorage.setItem(KEY, String(km)).catch(() => {});
    if (user && !user.isAnonymous) {
      saveProfile(user.uid, {unitKm: km}).catch(() => {});
    }
  }, [user]);

  return (
    <UnitsContext.Provider value={{useKm, toggleUnits}}>
      {children}
    </UnitsContext.Provider>
  );
}

export function useUnits() {
  return useContext(UnitsContext);
}
