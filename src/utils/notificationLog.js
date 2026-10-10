// On-device notification log (2026-10-10). A user with No Spoilers on reported
// a race-winner push, and nothing on the phone recorded what it had received,
// whether it was shown or why - only the OS notification history, which can't
// even say which sender it came from. This keeps the last MAX_ENTRIES events
// locally: pushes received (shown or suppressed, and why), spoiler mode
// changes and failed topic changes. It never leaves the device unless the user
// copies it (Settings) or attaches it to a bug report.
//
// Plain AsyncStorage on purpose: the Android background handler runs headless
// (no React tree), so this must work without any context or provider.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import {version} from '../../package.json';

const KEY = 'notification_log';
export const MAX_ENTRIES = 50;

// Never throws - logging must not break notification display.
export async function logNotificationEvent(entry) {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.push({t: new Date().toISOString(), ...entry});
    await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_ENTRIES)));
  } catch {}
}

export async function getNotificationLog() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function describe(e) {
  switch (e.kind) {
    case 'push':
      return `push ${e.outcome} [${e.channel || '-'}${e.type ? `/${e.type}` : ''}] ${e.title || ''}`.trim();
    case 'spoiler':
      return `spoiler mode ${e.action}${e.detail ? ` (${e.detail})` : ''}`;
    case 'topics':
      return `topic changes failed: ${(e.failed || []).join(', ')}`;
    default:
      return JSON.stringify(e);
  }
}

// One line per event, newest first - short enough to paste into chat.
export function formatNotificationLog(list, header = '') {
  const lines = [...list].reverse().map(e => `${e.t.replace('T', ' ').slice(0, 19)}Z ${describe(e)}`);
  return [header, ...lines].filter(Boolean).join('\n');
}

// Copy-to-clipboard / bug-report text: app version, platform and current
// spoiler mode state, then the log. Reads the spoiler key directly (same key
// settings.js writes) rather than importing notifications.js, which imports
// this module.
export async function buildDiagnosticsText() {
  const list = await getNotificationLog();
  let spoiler = 'unknown';
  try { spoiler = (await AsyncStorage.getItem('setting_spoiler_free')) === 'true' ? 'on' : 'off'; } catch {}
  const header = `BTCC Hub ${version} (${Platform.OS} ${Platform.Version}) - spoiler mode ${spoiler} - ${list.length} log entries`;
  return {text: formatNotificationLog(list, header), entries: list.length};
}
