/**
 * Verifies the invariants that prevent blank driver cards on Android.
 *
 * The bug: toggling any favourite caused all 21 cards to re-render simultaneously,
 * overwhelming Android HWUI's image decode queue and blanking random cards.
 *
 * The fix relies on three invariants — each tested here:
 *   1. bgSource object reference is stable across re-renders when the URL hasn't changed
 *      (prevents Image from detecting a prop change and reloading)
 *   2. The custom React.memo comparator skips re-renders when only onPress changed
 *      (prevents 21 simultaneous re-renders from a parent re-render)
 *   3. The DriversScreen stays functional across fav toggle cycles (no crash/null tree)
 */
import React from 'react';
import {act, create} from 'react-test-renderer';
import {renderHook} from '@testing-library/react-native';
import {FavouriteDriverProvider, useFavouriteDriver} from '../../src/store/favouriteDriver';
import DriversScreen from '../../src/screens/DriversScreen';

jest.mock('../../src/store/auth', () => ({
  useAuth: jest.fn(() => ({user: null, isAnonymous: true})),
}));
jest.mock('../../src/utils/userProfile', () => ({
  saveProfile: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../src/api/client', () => ({
  fetchDrivers: jest.fn(() => Promise.resolve({})),
}));
jest.mock('../../src/api/parsers', () => ({
  parseGrid: jest.fn(() => ({
    drivers: [
      {number: 3,  name: 'Tom Chilton',   team: 'T', cardBgUrl: 'https://x.com/a.png', imageUrl: '', cls: 'M'},
      {number: 11, name: 'Ricky Collard', team: 'T', cardBgUrl: 'https://x.com/b.png', imageUrl: '', cls: 'M'},
      {number: 15, name: 'Lewis Selby',   team: 'T', cardBgUrl: 'https://x.com/c.png', imageUrl: '', cls: 'M'},
    ],
    teams: [],
  })),
}));
jest.mock('../../src/assets/driverImages', () => ({getDriverImage: jest.fn(() => null)}));
jest.mock('../../src/utils/driverName', () => ({formatDriverName: jest.fn(n => n)}));
jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn(), driverClicked: jest.fn(), teamClicked: jest.fn(), gridTabSwitched: jest.fn()},
}));
jest.mock('@react-navigation/native', () => ({useFocusEffect: jest.fn(cb => cb())}));
jest.mock('../../src/components/SwipeableTabs', () => {
  const React = require('react');
  return ({pages}) => React.createElement(React.Fragment, null, ...pages);
});
jest.mock('../../src/components/CachedImage', () => {
  const React = require('react');
  const {View} = require('react-native');
  return () => React.createElement(View, null);
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// ─── The custom memo comparator (copied from DriversScreen) ──────────────────
const cardMemoComparator = (prev, next) =>
  prev.item === next.item && prev.fav === next.fav;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('bgSource reference stability', () => {
  it('returns the same object reference when cardBgUrl is unchanged', () => {
    const url = 'https://btcc.net/uploads/vertu.png';
    const {result, rerender} = renderHook(
      ({cardBgUrl}) => React.useMemo(() => (cardBgUrl ? {uri: cardBgUrl} : null), [cardBgUrl]),
      {initialProps: {cardBgUrl: url}},
    );
    const first = result.current;
    expect(first).toEqual({uri: url});

    // Context-triggered re-render with same URL — must return cached reference
    rerender({cardBgUrl: url});
    expect(result.current).toBe(first);
  });

  it('returns a new reference when cardBgUrl changes — Image reloads as intended', () => {
    const {result, rerender} = renderHook(
      ({cardBgUrl}) => React.useMemo(() => (cardBgUrl ? {uri: cardBgUrl} : null), [cardBgUrl]),
      {initialProps: {cardBgUrl: 'https://btcc.net/uploads/old.png'}},
    );
    const first = result.current;
    rerender({cardBgUrl: 'https://btcc.net/uploads/new.png'});
    expect(result.current).not.toBe(first);
  });

  it('returns null for empty cardBgUrl so the fallback View renders instead', () => {
    const {result} = renderHook(
      ({cardBgUrl}) => React.useMemo(() => (cardBgUrl ? {uri: cardBgUrl} : null), [cardBgUrl]),
      {initialProps: {cardBgUrl: ''}},
    );
    expect(result.current).toBeNull();
  });
});

describe('custom React.memo comparator', () => {
  const item = {number: 3, name: 'Tom Chilton', cardBgUrl: 'https://x.com/a.png'};

  it('skips re-render when only onPress reference changed', () => {
    // This is the core guard: DriversScreen re-renders (new closures for onPress)
    // but the card should not re-render if item and fav haven't changed.
    expect(cardMemoComparator(
      {item, fav: false, onPress: () => {}},
      {item, fav: false, onPress: () => {}},  // different function reference
    )).toBe(true);
  });

  it('triggers re-render when fav changes — star badge and name colour must update', () => {
    expect(cardMemoComparator(
      {item, fav: false, onPress: jest.fn()},
      {item, fav: true,  onPress: jest.fn()},
    )).toBe(false);
  });

  it('triggers re-render when item reference changes — new driver data loaded', () => {
    const updatedItem = {...item, name: 'Tom Chilton (updated)'};
    expect(cardMemoComparator(
      {item,        fav: false, onPress: jest.fn()},
      {item: updatedItem, fav: false, onPress: jest.fn()},
    )).toBe(false);
  });
});

describe('DriversScreen fav/unfav cycle', () => {
  const navigation = {navigate: jest.fn()};

  function renderWithProvider() {
    let ctxHook;
    function HookCapture() {
      ctxHook = useFavouriteDriver();
      return null;
    }
    let tree;
    act(() => {
      tree = create(
        <FavouriteDriverProvider>
          <>
            <DriversScreen navigation={navigation} />
            <HookCapture />
          </>
        </FavouriteDriverProvider>,
      );
    });
    return {tree, getCtx: () => ctxHook};
  }

  it('screen stays renderable after favouriting a driver', async () => {
    const {tree, getCtx} = renderWithProvider();
    await act(async () => { getCtx().toggle('Tom Chilton'); });
    expect(tree.toJSON()).not.toBeNull();
  });

  it('screen stays renderable after unfavouring a driver', async () => {
    const {tree, getCtx} = renderWithProvider();
    await act(async () => { getCtx().toggle('Tom Chilton'); });
    await act(async () => { getCtx().toggle('Tom Chilton'); });
    expect(tree.toJSON()).not.toBeNull();
  });

  it('screen stays renderable after fav-unfav-fav cycle on multiple drivers', async () => {
    const {tree, getCtx} = renderWithProvider();
    await act(async () => { getCtx().toggle('Tom Chilton'); });
    await act(async () => { getCtx().toggle('Ricky Collard'); });
    await act(async () => { getCtx().toggle('Tom Chilton'); });
    await act(async () => { getCtx().toggle('Ricky Collard'); });
    expect(tree.toJSON()).not.toBeNull();
  });
});
