import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'cache_';

export async function cacheWrite(key, data) {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {}
}

export async function cacheRead(key) {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
