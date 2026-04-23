import AsyncStorage from '@react-native-async-storage/async-storage';
import {cacheWrite, cacheRead} from '../../src/store/cache';

describe('cacheWrite', () => {
  it('stores JSON wrapped with data and cachedAt', async () => {
    const before = Date.now();
    await cacheWrite('drivers', {foo: 1});
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    const [key, value] = AsyncStorage.setItem.mock.calls[0];
    expect(key).toBe('cache_drivers');
    const parsed = JSON.parse(value);
    expect(parsed.data).toEqual({foo: 1});
    expect(parsed.cachedAt).toBeGreaterThanOrEqual(before);
  });

  it('silently swallows storage errors', async () => {
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('quota exceeded'));
    await expect(cacheWrite('drivers', {})).resolves.toBeUndefined();
  });
});

describe('cacheRead', () => {
  it('returns data from wrapped entry', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(
      JSON.stringify({data: {drivers: []}, cachedAt: Date.now()}),
    );
    const result = await cacheRead('drivers');
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('cache_drivers');
    expect(result).toEqual({drivers: []});
  });

  it('returns legacy plain JSON entries as-is', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('{"drivers":[]}');
    const result = await cacheRead('drivers');
    expect(result).toEqual({drivers: []});
  });

  it('returns null when entry exceeds maxAgeMs', async () => {
    const old = Date.now() - 10_000;
    AsyncStorage.getItem.mockResolvedValueOnce(
      JSON.stringify({data: {x: 1}, cachedAt: old}),
    );
    expect(await cacheRead('key', 5_000)).toBeNull();
  });

  it('returns data when entry is within maxAgeMs', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(
      JSON.stringify({data: {x: 1}, cachedAt: Date.now()}),
    );
    expect(await cacheRead('key', 60_000)).toEqual({x: 1});
  });

  it('returns null for missing key', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(null);
    expect(await cacheRead('missing')).toBeNull();
  });

  it('returns null on invalid JSON', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('not-json{{');
    expect(await cacheRead('bad')).toBeNull();
  });

  it('returns null when AsyncStorage throws', async () => {
    AsyncStorage.getItem.mockRejectedValueOnce(new Error('storage error'));
    expect(await cacheRead('any')).toBeNull();
  });
});
