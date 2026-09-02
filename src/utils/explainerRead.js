import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import {saveProfile} from './userProfile';

// Mirrors digestRead.js exactly (same shape, same AsyncStorage + best-effort
// Firestore-sync pattern) - added 2026-09-02 so Academy articles get the
// same read/unread behaviour as The Flying Lap. Kept as its own module
// rather than a shared/parameterized one so each stays simple and callers
// don't need to pass a "which feature" argument through - see
// ExplainerListScreen.js (the Academy equivalent of DigestsScreen.js) for
// the read/unread UI this backs.
const KEY = 'explainer_read_ids';

function syncToProfile(ids) {
  const user = auth().currentUser;
  if (user && !user.isAnonymous) {
    saveProfile(user.uid, {explainerReadIds: ids}).catch(() => {});
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
