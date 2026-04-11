import React from 'react';
import {act, create} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {FavouriteDriverProvider, useFavouriteDriver} from '../../src/store/favouriteDriver';

// Helper: renders the provider and captures the latest hook value via a test component
function renderProvider(asyncStorageValue = null) {
  AsyncStorage.getItem.mockResolvedValue(asyncStorageValue);
  let hook;
  function Tester() {
    hook = useFavouriteDriver();
    return null;
  }
  const renderer = create(
    <FavouriteDriverProvider>
      <Tester />
    </FavouriteDriverProvider>
  );
  return {
    getHook: () => hook,
    renderer,
  };
}

describe('FavouriteDriverProvider', () => {
  describe('initial state', () => {
    it('starts with null favourite when nothing stored', async () => {
      let hook;
      await act(async () => {
        const {getHook} = renderProvider(null);
        hook = getHook;
      });
      expect(hook().favourite).toBeNull();
    });

    it('loads saved favourite from AsyncStorage on mount', async () => {
      let hook;
      await act(async () => {
        const {getHook} = renderProvider('Tom Ingram');
        hook = getHook;
      });
      expect(hook().favourite).toBe('Tom Ingram');
    });
  });

  describe('toggle', () => {
    it('sets favourite when toggled for first time', async () => {
      let hook;
      await act(async () => {
        const {getHook} = renderProvider(null);
        hook = getHook;
      });

      await act(async () => {
        hook().toggle('Colin Turkington');
      });

      expect(hook().favourite).toBe('Colin Turkington');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('favourite_driver', 'Colin Turkington');
    });

    it('clears favourite when same name toggled again', async () => {
      let hook;
      await act(async () => {
        const {getHook} = renderProvider(null);
        hook = getHook;
      });

      await act(async () => {
        hook().toggle('Colin Turkington');
      });
      await act(async () => {
        hook().toggle('Colin Turkington');
      });

      expect(hook().favourite).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('favourite_driver');
    });

    it('switches favourite to a different driver', async () => {
      let hook;
      await act(async () => {
        const {getHook} = renderProvider(null);
        hook = getHook;
      });

      await act(async () => { hook().toggle('Tom Ingram'); });
      await act(async () => { hook().toggle('Jason Plato'); });

      expect(hook().favourite).toBe('Jason Plato');
      expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('favourite_driver', 'Jason Plato');
    });
  });

  describe('isFavourite', () => {
    it('returns true for the current favourite', async () => {
      let hook;
      await act(async () => {
        const {getHook} = renderProvider(null);
        hook = getHook;
      });
      await act(async () => { hook().toggle('Tom Ingram'); });

      expect(hook().isFavourite('Tom Ingram')).toBe(true);
    });

    it('returns false for non-favourite drivers', async () => {
      let hook;
      await act(async () => {
        const {getHook} = renderProvider(null);
        hook = getHook;
      });
      await act(async () => { hook().toggle('Tom Ingram'); });

      expect(hook().isFavourite('Jason Plato')).toBe(false);
    });

    it('returns false when no favourite is set', async () => {
      let hook;
      await act(async () => {
        const {getHook} = renderProvider(null);
        hook = getHook;
      });
      expect(hook().isFavourite('Anyone')).toBe(false);
    });
  });
});
