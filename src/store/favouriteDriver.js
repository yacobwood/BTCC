import React, {createContext, useContext, useState, useCallback, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'favourite_drivers';
const LEGACY_KEY = 'favourite_driver';

const FavouriteDriverContext = createContext({
  favourites: [],
  toggle: () => {},
  isFavourite: () => false,
});

export function FavouriteDriverProvider({children}) {
  const [favourites, setFavourites] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        // Migrate legacy single-favourite key
        const legacy = await AsyncStorage.getItem(LEGACY_KEY);
        if (legacy) {
          await AsyncStorage.setItem(KEY, JSON.stringify([legacy]));
          await AsyncStorage.removeItem(LEGACY_KEY);
          setFavourites([legacy]);
          return;
        }
        const stored = await AsyncStorage.getItem(KEY);
        if (stored) setFavourites(JSON.parse(stored));
      } catch {}
    })();
  }, []);

  const toggle = useCallback((name) => {
    setFavourites(prev => {
      const exists = prev.some(f => f.toLowerCase() === name.toLowerCase());
      const next = exists
        ? prev.filter(f => f.toLowerCase() !== name.toLowerCase())
        : [...prev, name];
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const isFavourite = useCallback((name) => {
    if (!name) return false;
    return favourites.some(f => f.toLowerCase() === name.toLowerCase());
  }, [favourites]);

  return (
    <FavouriteDriverContext.Provider value={{favourites, toggle, isFavourite}}>
      {children}
    </FavouriteDriverContext.Provider>
  );
}

export function useFavouriteDriver() {
  return useContext(FavouriteDriverContext);
}
