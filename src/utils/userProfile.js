import AsyncStorage from '@react-native-async-storage/async-storage';
import {FIREBASE_PROJECT_ID, FIREBASE_API_KEY, FIRESTORE_BASE} from '../config/firebase';
import auth from '@react-native-firebase/auth';

const COMMIT_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`;
const USERNAMES_BASE = `${FIRESTORE_BASE}/usernames`;

const COLLECTION = 'users';

// AsyncStorage keys that map to profile fields
const PROFILE_ASYNC_KEYS = {
  favouriteDrivers:   'favourite_drivers',
  unitKm:             'use_km',
  spoilerFree:        'setting_spoiler_free',
  commenterName:      'commenter_name',
  // notification settings
  preRace:            'setting_pre_race',
  preRaceRace:        'setting_pre_race_race',
  results:            'setting_results',
  resultsRace:        'setting_results_race',
  newsAlerts:         'setting_news_alerts',
  digestAlerts:       'setting_digest_alerts',
  weekendPreview:     'setting_weekend_preview',
  standingsUpdate:    'setting_standings_update',
  podcastAlerts:      'setting_podcast_alerts',
  preRace:            'setting_pre_race',
  preRaceFP:          'setting_pre_race_fp',
  preRaceQualifying:  'setting_pre_race_qualifying',
  preRaceQRace:       'setting_pre_race_qrace',
  preRaceRace:        'setting_pre_race_race',
  preRaceRace1:       'setting_pre_race_race1',
  preRaceRace2:       'setting_pre_race_race2',
  preRaceRace3:       'setting_pre_race_race3',
  results:            'setting_results',
  resultsFP:          'setting_results_fp',
  resultsQualifying:  'setting_results_qualifying',
  resultsQRace:       'setting_results_qrace',
  resultsRace:        'setting_results_race',
  resultsRace1:       'setting_results_race1',
  resultsRace2:       'setting_results_race2',
  resultsRace3:       'setting_results_race3',
};

function docUrl(uid) {
  return `${FIRESTORE_BASE}/${COLLECTION}/${uid}?key=${FIREBASE_API_KEY}`;
}

async function authHeaders() {
  try {
    const token = await auth().currentUser?.getIdToken();
    if (token) return {'Content-Type': 'application/json', Authorization: `Bearer ${token}`};
  } catch {}
  return {'Content-Type': 'application/json'};
}

function toFirestore(profile) {
  const fields = {};
  for (const [key, val] of Object.entries(profile)) {
    if (val === null || val === undefined) continue;
    if (typeof val === 'boolean') fields[key] = {booleanValue: val};
    else if (typeof val === 'string') fields[key] = {stringValue: val};
    else if (Array.isArray(val)) {
      fields[key] = {arrayValue: {values: val.map(v => ({stringValue: String(v)}))}};
    } else if (typeof val === 'object') {
      const mapFields = {};
      for (const [k, v] of Object.entries(val)) {
        if (v === null || v === undefined) continue;
        if (typeof v === 'string') mapFields[k] = {stringValue: v};
        else if (typeof v === 'boolean') mapFields[k] = {booleanValue: v};
      }
      fields[key] = {mapValue: {fields: mapFields}};
    }
  }
  return {fields};
}

function fromFirestore(doc) {
  if (!doc?.fields) return {};
  const profile = {};
  for (const [key, val] of Object.entries(doc.fields)) {
    if (val.booleanValue !== undefined) profile[key] = val.booleanValue;
    else if (val.stringValue !== undefined) profile[key] = val.stringValue;
    else if (val.arrayValue) {
      profile[key] = (val.arrayValue.values || []).map(v => v.stringValue);
    } else if (val.mapValue) {
      profile[key] = {};
      for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
        if (v.stringValue !== undefined) profile[key][k] = v.stringValue;
        else if (v.booleanValue !== undefined) profile[key][k] = v.booleanValue;
      }
    }
  }
  return profile;
}

export async function loadProfile(uid) {
  try {
    const headers = await authHeaders();
    const res = await fetch(docUrl(uid), {headers});
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const doc = await res.json();
    return fromFirestore(doc);
  } catch {
    return null;
  }
}

export async function saveProfile(uid, partial) {
  try {
    const doc = toFirestore(partial);
    const fieldPaths = Object.keys(doc.fields).map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
    const headers = await authHeaders();
    const url = `${docUrl(uid)}&${fieldPaths}`;
    const res = await fetch(url, {method: 'PATCH', headers, body: JSON.stringify(doc)});
    if (!res.ok) {
      const body = await res.text();
      console.warn('[userProfile] saveProfile failed', res.status, body);
    }
  } catch (e) {
    console.warn('[userProfile] saveProfile error', e);
  }
}

// ─── Username uniqueness ──────────────────────────────────────────────────────

export function validateUsername(name) {
  const trimmed = name.trim();
  if (trimmed.length < 3) return 'Must be at least 3 characters';
  if (trimmed.length > 20) return 'Must be 20 characters or fewer';
  if (!/^[a-zA-Z0-9_ ]+$/.test(trimmed)) return 'Letters, numbers, spaces and underscores only';
  return null;
}

// Returns 'available' | 'taken' | 'yours' | null (network error)
export async function checkUsernameAvailable(name, uid) {
  const normalized = name.toLowerCase().trim();
  try {
    const res = await fetch(
      `${USERNAMES_BASE}/${encodeURIComponent(normalized)}?key=${FIREBASE_API_KEY}`,
    );
    if (res.status === 404) return 'available';
    if (!res.ok) return null;
    const doc = await res.json();
    return doc?.fields?.uid?.stringValue === uid ? 'yours' : 'taken';
  } catch {
    return null;
  }
}

// Atomically releases the old username and claims the new one.
// Returns 'ok' | 'taken' | 'error'
export async function claimUsername(uid, newName, oldName) {
  const normalized = newName.toLowerCase().trim();
  const oldNormalized = oldName ? oldName.toLowerCase().trim() : null;

  if (normalized === oldNormalized) return 'ok';

  const headers = await authHeaders();

  // Release old username — best-effort, security rules prevent others deleting it
  if (oldNormalized) {
    try {
      await fetch(
        `${USERNAMES_BASE}/${encodeURIComponent(oldNormalized)}?key=${FIREBASE_API_KEY}`,
        {method: 'DELETE', headers},
      );
    } catch {}
  }

  // Claim new username with server-enforced precondition: doc must not exist
  const write = {
    update: {
      name: `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/usernames/${normalized}`,
      fields: {
        uid: {stringValue: uid},
        displayName: {stringValue: newName.trim()},
      },
    },
    currentDocument: {exists: false},
  };

  try {
    const res = await fetch(`${COMMIT_URL}?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({writes: [write]}),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body?.error?.status === 'FAILED_PRECONDITION') {
        // Doc exists — check if it belongs to this uid (e.g. re-claiming after reinstall)
        const owner = await checkUsernameAvailable(newName, uid);
        if (owner === 'yours') {
          await saveProfile(uid, {commenterName: newName.trim()});
          return 'ok';
        }
        return 'taken';
      }
      return 'error';
    }

    await saveProfile(uid, {commenterName: newName.trim()});
    return 'ok';
  } catch {
    return 'error';
  }
}

// On first sign-in, upload current AsyncStorage preferences to Firestore.
// Called once per account; safe to call multiple times (PATCH is idempotent).
export async function uploadLocalProfile(uid) {
  try {
    const pairs = await AsyncStorage.multiGet(Object.values(PROFILE_ASYNC_KEYS));
    const profile = {};
    for (const [storageKey, raw] of pairs) {
      const profileKey = Object.keys(PROFILE_ASYNC_KEYS).find(
        k => PROFILE_ASYNC_KEYS[k] === storageKey,
      );
      if (!profileKey || raw === null) continue;
      if (profileKey === 'favouriteDrivers') {
        try { profile[profileKey] = JSON.parse(raw); } catch {}
      } else if (profileKey === 'unitKm' || profileKey === 'spoilerFree' || profileKey.startsWith('pre') || profileKey.startsWith('results') || profileKey === 'newsAlerts' || profileKey === 'digestAlerts' || profileKey === 'weekendPreview' || profileKey === 'standingsUpdate' || profileKey === 'podcastAlerts') {
        profile[profileKey] = raw === 'true';
      } else {
        profile[profileKey] = raw;
      }
    }
    if (Object.keys(profile).length > 0) await saveProfile(uid, profile);
  } catch {}
}

// Apply a Firestore profile back to AsyncStorage so stores pick it up on next read.
export async function applyProfileToStorage(profile) {
  try {
    const pairs = [];
    for (const [profileKey, storageKey] of Object.entries(PROFILE_ASYNC_KEYS)) {
      const val = profile[profileKey];
      if (val === undefined) continue;
      if (profileKey === 'favouriteDrivers') {
        pairs.push([storageKey, JSON.stringify(val)]);
      } else {
        pairs.push([storageKey, String(val)]);
      }
    }
    if (pairs.length > 0) await AsyncStorage.multiSet(pairs);
  } catch {}
}
