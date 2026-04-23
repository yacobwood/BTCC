import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'cache_';

export async function cacheWrite(key, data) {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({data, cachedAt: Date.now()}));
  } catch {}
}

/**
 * Read cached data. Returns null if missing, unreadable, or older than maxAgeMs.
 * @param {string} key
 * @param {number} [maxAgeMs] - if provided, entries older than this are treated as cache misses
 */
export async function cacheRead(key, maxAgeMs) {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Handle legacy entries that are plain data (no cachedAt wrapper)
    if (parsed === null || typeof parsed !== 'object' || !('cachedAt' in parsed)) {
      return parsed;
    }
    if (maxAgeMs !== undefined && Date.now() - parsed.cachedAt > maxAgeMs) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}
