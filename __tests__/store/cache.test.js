import AsyncStorage from '@react-native-async-storage/async-storage';
import {cacheWrite, cacheRead} from '../../src/store/cache';

describe('cacheWrite', () => {
  it('stores JSON with cache_ prefix', async () => {
    await cacheWrite('drivers', {foo: 1});
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('cache_drivers', '{"foo":1}');
  });

  it('silently swallows storage errors', async () => {
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('quota exceeded'));
    await expect(cacheWrite('drivers', {})).resolves.toBeUndefined();
  });
});

describe('cacheRead', () => {
  it('returns parsed JSON for existing key', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('{"drivers":[]}');
    const result = await cacheRead('drivers');
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('cache_drivers');
    expect(result).toEqual({drivers: []});
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
