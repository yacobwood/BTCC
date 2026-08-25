import database from '@react-native-firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {claimUsername, validateUsername} from './userProfile';

const DB = database();
const COMMENTER_NAME_KEY = 'commenter_name';

// Whether this identity has ever set a chat display name. /chat/authorNames
// is, in practice, the one source of truth written for every identity -
// anonymous or signed-in - alike, unlike commenter_name in AsyncStorage,
// which is only written for the anonymous branch.
export async function hasChatDisplayName(authorId) {
  try {
    const snap = await DB.ref(`/chat/authorNames/${authorId}`).once('value');
    return !!snap.val();
  } catch {
    return false;
  }
}

// Validates, claims (for signed-in accounts) and persists a chat display
// name - factored out of ChatScreen's saveName verbatim so any other caller
// (the donor-badge name gate in MoreScreen) can reuse the exact same logic
// without duplicating the validation/claim/persist steps.
export async function saveChatDisplayName({authorId, user, name, previousName}) {
  const trimmed = name.trim() || `Fan #${authorId.slice(-4)}`;

  // Validate and enforce uniqueness for non-empty names on non-anonymous accounts
  if (name.trim() && user && !user.isAnonymous) {
    const validationError = validateUsername(trimmed);
    if (validationError) return {status: 'invalid', message: validationError};

    const result = await claimUsername(user.uid, trimmed, previousName || null);
    if (result === 'taken') return {status: 'taken', message: 'That name is already taken'};
    if (result === 'error') return {status: 'error', message: 'Could not save name. Please try again.'};
  } else {
    await AsyncStorage.setItem(COMMENTER_NAME_KEY, trimmed);
  }

  // Best-effort - if this write fails (offline, rules hiccup), the new name
  // still applies going forward via the caller's own local state; only the
  // retroactive relabelling of past messages is missed.
  DB.ref(`/chat/authorNames/${authorId}`).set(trimmed).catch(() => {});
  return {status: 'ok', name: trimmed};
}
