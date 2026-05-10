import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'cache_';

export async function cacheWrite(key, data) {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({data, cachedAt: Date.now()}));
  } catch {}
}

export async function cacheReadTimestamp(key) {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !('cachedAt' in parsed)) return null;
    return parsed.cachedAt;
  } catch {
    return null;
  }
}

// Remove all cache entries older than maxAgeMs (default 7 days). Call on app launch.
export async function cacheEvictStale(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(k => k.startsWith(PREFIX));
    if (!cacheKeys.length) return;
    const entries = await AsyncStorage.multiGet(cacheKeys);
    const toRemove = [];
    const now = Date.now();
    for (const [key, value] of entries) {
      if (!value) { toRemove.push(key); continue; }
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && 'cachedAt' in parsed) {
          if (now - parsed.cachedAt > maxAgeMs) toRemove.push(key);
        }
      } catch { toRemove.push(key); }
    }
    if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
  } catch {}
}

export async function cacheDelete(key) {
  try {
    await AsyncStorage.removeItem(PREFIX + key);
  } catch {}
}

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
