import AsyncStorage from '@react-native-async-storage/async-storage';
import InAppReview from 'react-native-in-app-review';
import {daysSince} from './daysSince';

const KEY_REVIEW_SHOWN = 'review_shown';
const KEY_REVIEWED = 'has_reviewed';
const KEY_FIRST_LAUNCH = 'review_first_launch_ts';
const DAYS_BEFORE_PROMPT = 7;

export async function maybeRequestReviewAfterResults() {
  try {
    const [shown, reviewed] = await Promise.all([
      AsyncStorage.getItem(KEY_REVIEW_SHOWN),
      AsyncStorage.getItem(KEY_REVIEWED),
    ]);
    if (shown === 'true' || reviewed === 'true') return;

    const now = Date.now();
    const firstLaunchStr = await AsyncStorage.getItem(KEY_FIRST_LAUNCH);
    if (!firstLaunchStr) {
      await AsyncStorage.setItem(KEY_FIRST_LAUNCH, String(now));
      return;
    }

    if (daysSince(parseInt(firstLaunchStr, 10), now) < DAYS_BEFORE_PROMPT) return;

    if (InAppReview.isAvailable()) {
      await InAppReview.RequestInAppReview();
      await AsyncStorage.multiSet([[KEY_REVIEW_SHOWN, 'true'], [KEY_REVIEWED, 'true']]);
    }
  } catch {}
}
