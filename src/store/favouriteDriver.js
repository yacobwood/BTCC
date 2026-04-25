import React, {createContext, useContext, useState, useCallback, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'favourite_driver';
const FavouriteDriverContext = createContext({
  favourite: null,
  toggle: () => {},
  isFavourite: () => false,
});

export function FavouriteDriverProvider({children}) {
  const [favourite, setFavourite] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => { if (v) setFavourite(v); }).catch(() => {});
  }, []);

  const toggle = useCallback((name) => {
    setFavourite(prev => {
      const next = prev === name ? null : name;
      if (next) {
        AsyncStorage.setItem(KEY, next).catch(() => {});
      } else {
        AsyncStorage.removeItem(KEY).catch(() => {});
      }
      return next;
    });
  }, []);

  const isFavourite = useCallback((name) => {
    if (!favourite || !name) return false;
    return favourite.toLowerCase() === name.toLowerCase();
  }, [favourite]);

  return (
    <FavouriteDriverContext.Provider value={{favourite, toggle, isFavourite}}>
      {children}
    </FavouriteDriverContext.Provider>
  );
}

export function useFavouriteDriver() {
  return useContext(FavouriteDriverContext);
}
