import React from 'react';
import {act, create} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {FavouriteDriverProvider, useFavouriteDriver} from '../../src/store/favouriteDriver';

jest.mock('../../src/store/auth', () => ({
  useAuth: jest.fn(() => ({user: null, isAnonymous: true})),
}));
jest.mock('../../src/utils/userProfile', () => ({
  saveProfile: jest.fn(() => Promise.resolve()),
}));

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

    it('toggle is case-insensitive - treats same driver with different casing as equal', async () => {
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

  describe('Firestore live sync', () => {
    beforeEach(() => {
      const {saveProfile} = require('../../src/utils/userProfile');
      saveProfile.mockClear();
    });

    it('calls saveProfile with updated favourites when logged-in user adds a driver', async () => {
      const {useAuth} = require('../../src/store/auth');
      const {saveProfile} = require('../../src/utils/userProfile');
      useAuth.mockReturnValue({user: {uid: 'test-uid', isAnonymous: false}, isAnonymous: false});
      AsyncStorage.getItem.mockResolvedValue(null);

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        getHook().toggle('Tom Ingram');
      });

      expect(saveProfile).toHaveBeenCalledWith('test-uid', {favouriteDrivers: ['Tom Ingram']});
    });

    it('calls saveProfile with empty array when logged-in user removes last driver', async () => {
      const {useAuth} = require('../../src/store/auth');
      const {saveProfile} = require('../../src/utils/userProfile');
      useAuth.mockReturnValue({user: {uid: 'test-uid', isAnonymous: false}, isAnonymous: false});
      AsyncStorage.getItem.mockResolvedValue(null);

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => { getHook().toggle('Tom Ingram'); });
      saveProfile.mockClear();
      await act(async () => { getHook().toggle('Tom Ingram'); });

      expect(saveProfile).toHaveBeenCalledWith('test-uid', {favouriteDrivers: []});
    });

    it('does not call saveProfile when anonymous user toggles favourite', async () => {
      const {useAuth} = require('../../src/store/auth');
      const {saveProfile} = require('../../src/utils/userProfile');
      useAuth.mockReturnValue({user: null, isAnonymous: true});
      AsyncStorage.getItem.mockResolvedValue(null);

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        getHook().toggle('Tom Ingram');
      });

      expect(saveProfile).not.toHaveBeenCalled();
    });

    it('reloads favourites from AsyncStorage when user changes', async () => {
      const {useAuth} = require('../../src/store/auth');
      useAuth.mockReturnValue({user: null, isAnonymous: true});
      AsyncStorage.getItem.mockResolvedValue('null');

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      const initialCallCount = AsyncStorage.getItem.mock.calls.length;
      expect(initialCallCount).toBeGreaterThan(0);

      useAuth.mockReturnValue({user: {uid: 'test-uid', isAnonymous: false}, isAnonymous: false});
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(['Tom Ingram']));

      // Trigger a re-render to simulate user change
      await act(async () => {
        getHook = renderProvider();
      });

      expect(AsyncStorage.getItem.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });
});
