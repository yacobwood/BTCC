import database from '@react-native-firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
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

// Re-assert the authorId -> name mapping every time chat identity resolves
// (ChatScreen init), not just at the moment the name is first saved. Without
// this, the one-shot write above failing silently just once (offline, a
// rules hiccup - the exact case its own comment calls out) leaves that
// account permanently un-mentionable: their own messages keep showing the
// right name (set from local state, not read back from this map), so
// nothing looks broken to them, but functions/chatMentions.js's
// resolveMentionedAuthorIds only ever matches against this map - a missing
// entry means every @mention of that name silently resolves to zero
// recipients, with no error anywhere to find. Mirrors syncChatMentionToken's
// same "re-sync on every identity resolve" pattern (src/store/settings.js).
export function syncChatAuthorName(authorId, name) {
  if (!authorId || !name) return;
  DB.ref(`/chat/authorNames/${authorId}`).set(name).catch(() => {});
}

// Register this device against the chat identity so a ban survives a
// reinstall: reinstalling gets a fresh anonymous uid, but getUniqueId() is
// ANDROID_ID on Android (survives reinstall, scoped to this app's signing
// key) and identifierForVendor on iOS (only survives while another app from
// the same developer stays installed). Write-once per uid in
// database.rules.json, so repeat calls fail quietly - expected, not an error.
// The banChatUser/onChatDeviceRegistered Cloud Functions do the rest.
export async function syncChatDevice(authorId) {
  if (!authorId || authorId === 'anonymous') return;
  try {
    const deviceId = String(await DeviceInfo.getUniqueId()).replace(/[^A-Za-z0-9-]/g, '').slice(0, 100);
    if (!deviceId) return;
    const ref = DB.ref(`/chat/devices/${authorId}`);
    const snap = await ref.once('value');
    if (!snap.val()) await ref.set(deviceId);
  } catch {}
}
