import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'digest_read_ids';

export async function getReadIds() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export async function markRead(id) {
  try {
    const ids = await getReadIds();
    ids.add(String(id));
    await AsyncStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {}
}

export async function markAllRead(ids) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(ids.map(String)));
  } catch {}
}

export async function markUnread(id) {
  try {
    const ids = await getReadIds();
    ids.delete(String(id));
    await AsyncStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {}
}
