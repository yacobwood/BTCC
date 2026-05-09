import AsyncStorage from '@react-native-async-storage/async-storage';
import {cacheWrite, cacheRead, cacheReadTimestamp, cacheEvictStale} from '../../src/store/cache';

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

describe('cacheEvictStale', () => {
  it('removes entries older than maxAgeMs', async () => {
    const staleTs = Date.now() - 10_000;
    AsyncStorage.getAllKeys.mockResolvedValueOnce(['cache_old']);
    AsyncStorage.multiGet.mockResolvedValueOnce([
      ['cache_old', JSON.stringify({data: {x: 1}, cachedAt: staleTs})],
    ]);
    await cacheEvictStale(5_000);
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(['cache_old']);
  });

  it('keeps entries newer than maxAgeMs', async () => {
    AsyncStorage.getAllKeys.mockResolvedValueOnce(['cache_fresh']);
    AsyncStorage.multiGet.mockResolvedValueOnce([
      ['cache_fresh', JSON.stringify({data: {x: 1}, cachedAt: Date.now()})],
    ]);
    await cacheEvictStale(60_000);
    expect(AsyncStorage.multiRemove).not.toHaveBeenCalled();
  });

  it('removes entries with null value', async () => {
    AsyncStorage.getAllKeys.mockResolvedValueOnce(['cache_null']);
    AsyncStorage.multiGet.mockResolvedValueOnce([['cache_null', null]]);
    await cacheEvictStale(60_000);
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(['cache_null']);
  });

  it('removes entries with invalid JSON', async () => {
    AsyncStorage.getAllKeys.mockResolvedValueOnce(['cache_bad']);
    AsyncStorage.multiGet.mockResolvedValueOnce([['cache_bad', 'not-json{{']]);
    await cacheEvictStale(60_000);
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(['cache_bad']);
  });

  it('does nothing when no cache keys exist', async () => {
    AsyncStorage.getAllKeys.mockResolvedValueOnce(['other_key']); // no cache_ prefix
    await cacheEvictStale(60_000);
    expect(AsyncStorage.multiGet).not.toHaveBeenCalled();
    expect(AsyncStorage.multiRemove).not.toHaveBeenCalled();
  });

  it('keeps entries without cachedAt (legacy plain data)', async () => {
    AsyncStorage.getAllKeys.mockResolvedValueOnce(['cache_legacy']);
    AsyncStorage.multiGet.mockResolvedValueOnce([
      ['cache_legacy', JSON.stringify({drivers: []})], // no cachedAt
    ]);
    await cacheEvictStale(60_000);
    expect(AsyncStorage.multiRemove).not.toHaveBeenCalled();
  });

  it('silently swallows getAllKeys errors', async () => {
    AsyncStorage.getAllKeys.mockRejectedValueOnce(new Error('storage error'));
    await expect(cacheEvictStale()).resolves.toBeUndefined();
  });
});

describe('cacheReadTimestamp', () => {
  it('returns cachedAt ms from a wrapped entry', async () => {
    const ts = Date.now() - 5_000;
    AsyncStorage.getItem.mockResolvedValueOnce(
      JSON.stringify({data: {x: 1}, cachedAt: ts}),
    );
    expect(await cacheReadTimestamp('key')).toBe(ts);
  });

  it('returns null for legacy plain entries without cachedAt', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('{"x":1}');
    expect(await cacheReadTimestamp('key')).toBeNull();
  });

  it('returns null for missing key', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(null);
    expect(await cacheReadTimestamp('missing')).toBeNull();
  });

  it('returns null on invalid JSON', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('not-json{{');
    expect(await cacheReadTimestamp('bad')).toBeNull();
  });

  it('returns null when AsyncStorage throws', async () => {
    AsyncStorage.getItem.mockRejectedValueOnce(new Error('storage error'));
    expect(await cacheReadTimestamp('any')).toBeNull();
  });
});
