import AsyncStorage from '@react-native-async-storage/async-storage';
import {FIREBASE_PROJECT_ID, FIREBASE_API_KEY, FIRESTORE_BASE} from '../config/firebase';

const COLLECTION = 'users';

// AsyncStorage keys that map to profile fields
const PROFILE_ASYNC_KEYS = {
  favouriteDrivers:   'favourite_drivers',
  unitKm:             'use_km',
  spoilerFree:        'setting_spoiler_free',
  commenterName:      'commenter_name',
  // notification settings
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

function toFirestore(profile) {
  const fields = {};
  for (const [key, val] of Object.entries(profile)) {
    if (val === null || val === undefined) continue;
    if (typeof val === 'boolean') fields[key] = {booleanValue: val};
    else if (typeof val === 'string') fields[key] = {stringValue: val};
    else if (Array.isArray(val)) {
      fields[key] = {arrayValue: {values: val.map(v => ({stringValue: String(v)}))}};
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
    }
  }
  return profile;
}

export async function loadProfile(uid) {
  try {
    const res = await fetch(docUrl(uid));
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
    const fields = toFirestore(partial);
    const fieldPaths = Object.keys(fields).join(',');
    await fetch(`${docUrl(uid)}&updateMask.fieldPaths=${fieldPaths}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({fields}),
    });
  } catch {}
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
