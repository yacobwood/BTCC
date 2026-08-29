import AsyncStorage from '@react-native-async-storage/async-storage';
import {daysSince} from './daysSince';

const KEY_LAST_OPEN = 'last_open_ts';
const DAYS_INACTIVE_THRESHOLD = 10;

// Call once per News tab mount (the app's default/home tab, so this is a
// reasonable proxy for "app opened" without threading a launch event through
// the whole provider tree). Always re-stamps "now" as the latest open time;
// returns true only when at least DAYS_INACTIVE_THRESHOLD days passed since
// the previous stamp, so the caller can show a "we miss you" banner. Returns
// false on someone's very first-ever launch - there's nothing to miss yet.
export async function checkAndStampLastOpen() {
  try {
    const now = Date.now();
    const lastStr = await AsyncStorage.getItem(KEY_LAST_OPEN);
    await AsyncStorage.setItem(KEY_LAST_OPEN, String(now));
    if (!lastStr) return false;
    return daysSince(parseInt(lastStr, 10), now) >= DAYS_INACTIVE_THRESHOLD;
  } catch {
    return false;
  }
}
