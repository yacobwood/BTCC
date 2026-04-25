import React from 'react';
import {act, create} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {FavouriteDriverProvider, useFavouriteDriver} from '../../src/store/favouriteDriver';

const KEY = 'favourite_drivers';
const LEGACY_KEY = 'favourite_driver';

function renderProvider() {
  let hook;
  function Tester() {
    hook = useFavouriteDriver();
    return null;
  }
  create(
    <FavouriteDriverProvider>
      <Tester />
    </FavouriteDriverProvider>
  );
  return () => hook;
}

describe('FavouriteDriverProvider', () => {
  describe('initial state', () => {
    it('starts with empty favourites when nothing stored', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });
      expect(getHook().favourites).toEqual([]);
    });

    it('loads saved favourites from AsyncStorage on mount', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === KEY) return Promise.resolve(JSON.stringify(['Tom Ingram', 'Jason Plato']));
        return Promise.resolve(null);
      });
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });
      expect(getHook().favourites).toEqual(['Tom Ingram', 'Jason Plato']);
    });

    it('migrates legacy single-favourite key to array', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === LEGACY_KEY) return Promise.resolve('Colin Turkington');
        return Promise.resolve(null);
      });
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });
      expect(getHook().favourites).toEqual(['Colin Turkington']);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(KEY, JSON.stringify(['Colin Turkington']));
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(LEGACY_KEY);
    });
  });

  describe('toggle', () => {
    it('adds a driver to favourites when not already faved', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        getHook().toggle('Colin Turkington');
      });

      expect(getHook().favourites).toContain('Colin Turkington');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(KEY, JSON.stringify(['Colin Turkington']));
    });

    it('removes a driver when they are already faved', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => { getHook().toggle('Colin Turkington'); });
      await act(async () => { getHook().toggle('Colin Turkington'); });

      expect(getHook().favourites).not.toContain('Colin Turkington');
      expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(KEY, JSON.stringify([]));
    });

    it('supports multiple favourites simultaneously', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => { getHook().toggle('Tom Ingram'); });
      await act(async () => { getHook().toggle('Gordon Shedden'); });

      expect(getHook().favourites).toContain('Tom Ingram');
      expect(getHook().favourites).toContain('Gordon Shedden');
      expect(getHook().favourites).toHaveLength(2);
    });

    it('adding a second driver does not remove the first', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => { getHook().toggle('Tom Ingram'); });
      await act(async () => { getHook().toggle('Daniel Rowbottom'); });

      expect(getHook().favourites).toContain('Tom Ingram');
      expect(getHook().favourites).toContain('Daniel Rowbottom');
    });

    it('removes only the toggled driver, leaving others intact', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => { getHook().toggle('Tom Ingram'); });
      await act(async () => { getHook().toggle('Gordon Shedden'); });
      await act(async () => { getHook().toggle('Tom Ingram'); });

      expect(getHook().favourites).not.toContain('Tom Ingram');
      expect(getHook().favourites).toContain('Gordon Shedden');
    });

    it('toggle is case-insensitive — treats same driver with different casing as equal', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => { getHook().toggle('Tom Ingram'); });
      await act(async () => { getHook().toggle('Tom INGRAM'); });

      expect(getHook().favourites).toHaveLength(0);
    });
  });

  describe('isFavourite', () => {
    it('returns true for a faved driver', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });
      await act(async () => { getHook().toggle('Tom Ingram'); });

      expect(getHook().isFavourite('Tom Ingram')).toBe(true);
    });

    it('returns true for any faved driver in a multi-favourite list', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });
      await act(async () => { getHook().toggle('Tom Ingram'); });
      await act(async () => { getHook().toggle('Gordon Shedden'); });

      expect(getHook().isFavourite('Tom Ingram')).toBe(true);
      expect(getHook().isFavourite('Gordon Shedden')).toBe(true);
    });

    it('returns false for a non-faved driver', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });
      await act(async () => { getHook().toggle('Tom Ingram'); });

      expect(getHook().isFavourite('Jason Plato')).toBe(false);
    });

    it('is case-insensitive', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });
      await act(async () => { getHook().toggle('Tom Ingram'); });

      expect(getHook().isFavourite('Tom INGRAM')).toBe(true);
      expect(getHook().isFavourite('tom ingram')).toBe(true);
    });

    it('returns false when no favourites are set', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });
      expect(getHook().isFavourite('Anyone')).toBe(false);
    });
  });
});
