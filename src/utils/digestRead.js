import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import {saveProfile} from './userProfile';

const KEY = 'digest_read_ids';

function syncToProfile(ids) {
  const user = auth().currentUser;
  if (user && !user.isAnonymous) {
    saveProfile(user.uid, {digestReadIds: ids}).catch(() => {});
  }
}

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
    const list = [...ids];
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
    syncToProfile(list);
  } catch {}
}

export async function markAllRead(ids) {
  try {
    const list = ids.map(String);
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
    syncToProfile(list);
  } catch {}
}

export async function markUnread(id) {
  try {
    const ids = await getReadIds();
    ids.delete(String(id));
    const list = [...ids];
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
    syncToProfile(list);
  } catch {}
}
