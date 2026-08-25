import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_SHOWN = 'share_nudge_shown';
const KEY_FIRST_VIEW = 'share_nudge_first_view_ts';
// Offset past reviewPrompt.js's own 7-day gate so the two don't compete on
// the same visit - same day-count-since-first-qualifying-view shape as that
// file, kept as a separate/independent gate rather than reusing its keys.
const DAYS_BEFORE_PROMPT = 10;

// Returns true exactly once, the first RoundResultsScreen view that's at
// least DAYS_BEFORE_PROMPT days after the first-ever qualifying view. Caller
// is responsible for calling markShareNudgeShown() once it actually shows
// something, same division of responsibility as reviewPrompt.js.
export async function maybeShowShareNudge() {
  try {
    const shown = await AsyncStorage.getItem(KEY_SHOWN);
    if (shown === 'true') return false;

    const now = Date.now();
    const firstViewStr = await AsyncStorage.getItem(KEY_FIRST_VIEW);
    if (!firstViewStr) {
      await AsyncStorage.setItem(KEY_FIRST_VIEW, String(now));
      return false;
    }

    const daysSince = (now - parseInt(firstViewStr, 10)) / (1000 * 60 * 60 * 24);
    return daysSince >= DAYS_BEFORE_PROMPT;
  } catch {
    return false;
  }
}

export async function markShareNudgeShown() {
  try {
    await AsyncStorage.setItem(KEY_SHOWN, 'true');
  } catch {}
}
