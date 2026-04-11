import React from 'react';
import {act, create} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {UnitsProvider, useUnits} from '../../src/store/units';

function renderProvider(storedValue = null) {
  AsyncStorage.getItem.mockResolvedValue(storedValue);
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
    let getHook;
    await act(async () => {
      getHook = renderProvider(null);
    });
    expect(getHook().useKm).toBe(false);
  });

  it('loads km preference from storage on mount', async () => {
    let getHook;
    await act(async () => {
      getHook = renderProvider('true');
    });
    expect(getHook().useKm).toBe(true);
  });

  it('does not switch to km for value other than "true"', async () => {
    let getHook;
    await act(async () => {
      getHook = renderProvider('false');
    });
    expect(getHook().useKm).toBe(false);
  });

  it('toggleUnits(true) switches to km and persists', async () => {
    let getHook;
    await act(async () => {
      getHook = renderProvider(null);
    });

    await act(async () => {
      getHook().toggleUnits(true);
    });

    expect(getHook().useKm).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('use_km', 'true');
  });

  it('toggleUnits(false) switches to imperial and persists', async () => {
    let getHook;
    await act(async () => {
      getHook = renderProvider('true');
    });

    await act(async () => {
      getHook().toggleUnits(false);
    });

    expect(getHook().useKm).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('use_km', 'false');
  });
});
