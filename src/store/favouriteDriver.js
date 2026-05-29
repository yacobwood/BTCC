import React, {createContext, useContext, useState, useCallback, useEffect, useMemo} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAuth} from './auth';
import {saveProfile} from '../utils/userProfile';

const KEY = 'favourite_drivers';
const LEGACY_KEY = 'favourite_driver';

const FavouriteDriverContext = createContext({
  favourites: [],
  toggle: () => {},
  isFavourite: () => false,
});

export function FavouriteDriverProvider({children}) {
  const {user} = useAuth();
  const [favourites, setFavourites] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const legacy = await AsyncStorage.getItem(LEGACY_KEY);
        if (legacy) {
          await AsyncStorage.setItem(KEY, JSON.stringify([legacy]));
          await AsyncStorage.removeItem(LEGACY_KEY);
          setFavourites([legacy]);
          return;
        }
        const stored = await AsyncStorage.getItem(KEY);
        setFavourites(stored ? JSON.parse(stored) : []);
      } catch {}
    })();
  }, [user]);

  const toggle = useCallback((name) => {
    setFavourites(prev => {
      const exists = prev.some(f => f.toLowerCase() === name.toLowerCase());
      const next = exists
        ? prev.filter(f => f.toLowerCase() !== name.toLowerCase())
        : [...prev, name];
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      if (user && !user.isAnonymous) {
        saveProfile(user.uid, {favouriteDrivers: next}).catch(() => {});
      }
      return next;
    });
  }, [user]);

  const isFavourite = useCallback((name) => {
    if (!name) return false;
    return favourites.some(f => f.toLowerCase() === name.toLowerCase());
  }, [favourites]);

  const value = useMemo(
    () => ({favourites, toggle, isFavourite}),
    [favourites, toggle, isFavourite],
  );

  return (
    <FavouriteDriverContext.Provider value={value}>
      {children}
    </FavouriteDriverContext.Provider>
  );
}

export function useFavouriteDriver() {
  return useContext(FavouriteDriverContext);
}
