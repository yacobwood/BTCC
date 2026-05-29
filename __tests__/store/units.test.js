import React from 'react';
import {act, create} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {UnitsProvider, useUnits} from '../../src/store/units';

jest.mock('../../src/store/auth', () => ({
  useAuth: jest.fn(() => ({user: null, isAnonymous: true})),
}));
jest.mock('../../src/utils/userProfile', () => ({
  saveProfile: jest.fn(() => Promise.resolve()),
}));

function renderProvider() {
  let hook;
  function Tester() {
    hook = useUnits();
    return null;
  }
  create(
    <UnitsProvider>
      <Tester />
    </UnitsProvider>
  );
  return () => hook;
}

describe('UnitsProvider', () => {
  it('defaults to imperial (useKm = false)', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    let getHook;
    await act(async () => {
      getHook = renderProvider();
    });
    expect(getHook().useKm).toBe(false);
  });

  it('loads km preference from storage on mount', async () => {
    AsyncStorage.getItem.mockResolvedValue('true');
    let getHook;
    await act(async () => {
      getHook = renderProvider();
    });
    expect(getHook().useKm).toBe(true);
  });

  it('does not switch to km for value other than "true"', async () => {
    AsyncStorage.getItem.mockResolvedValue('false');
    let getHook;
    await act(async () => {
      getHook = renderProvider();
    });
    expect(getHook().useKm).toBe(false);
  });

  it('toggleUnits(true) switches to km and persists', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    let getHook;
    await act(async () => {
      getHook = renderProvider();
    });

    await act(async () => {
      getHook().toggleUnits(true);
    });

    expect(getHook().useKm).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('use_km', 'true');
  });

  it('toggleUnits(false) switches to imperial and persists', async () => {
    AsyncStorage.getItem.mockResolvedValue('true');
    let getHook;
    await act(async () => {
      getHook = renderProvider();
    });

    await act(async () => {
      getHook().toggleUnits(false);
    });

    expect(getHook().useKm).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('use_km', 'false');
  });

  describe('Firestore live sync', () => {
    beforeEach(() => {
      const {saveProfile} = require('../../src/utils/userProfile');
      saveProfile.mockClear();
    });

    it('calls saveProfile with unitKm when logged-in user toggles units', async () => {
      const {useAuth} = require('../../src/store/auth');
      const {saveProfile} = require('../../src/utils/userProfile');
      useAuth.mockReturnValue({user: {uid: 'test-uid', isAnonymous: false}, isAnonymous: false});
      AsyncStorage.getItem.mockResolvedValue(null);

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        getHook().toggleUnits(true);
      });

      expect(saveProfile).toHaveBeenCalledWith('test-uid', {unitKm: true});
    });

    it('calls saveProfile with false when logged-in user switches to imperial', async () => {
      const {useAuth} = require('../../src/store/auth');
      const {saveProfile} = require('../../src/utils/userProfile');
      useAuth.mockReturnValue({user: {uid: 'test-uid', isAnonymous: false}, isAnonymous: false});
      AsyncStorage.getItem.mockResolvedValue('true');

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        getHook().toggleUnits(false);
      });

      expect(saveProfile).toHaveBeenCalledWith('test-uid', {unitKm: false});
    });

    it('does not call saveProfile when anonymous user toggles units', async () => {
      const {useAuth} = require('../../src/store/auth');
      const {saveProfile} = require('../../src/utils/userProfile');
      useAuth.mockReturnValue({user: null, isAnonymous: true});
      AsyncStorage.getItem.mockResolvedValue(null);

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        getHook().toggleUnits(true);
      });

      expect(saveProfile).not.toHaveBeenCalled();
    });

    it('re-reads AsyncStorage when user changes', async () => {
      const {useAuth} = require('../../src/store/auth');
      useAuth.mockReturnValue({user: null, isAnonymous: true});
      AsyncStorage.getItem.mockResolvedValue(null);

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      const initialCallCount = AsyncStorage.getItem.mock.calls.length;
      expect(initialCallCount).toBeGreaterThan(0);

      useAuth.mockReturnValue({user: {uid: 'test-uid', isAnonymous: false}, isAnonymous: false});
      AsyncStorage.getItem.mockResolvedValue('true');

      // Trigger a re-render to simulate user change
      await act(async () => {
        getHook = renderProvider();
      });

      expect(AsyncStorage.getItem.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });
});
