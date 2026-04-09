import AsyncStorage from '@react-native-async-storage/async-storage';
import InAppReview from 'react-native-in-app-review';

const KEY_LAUNCH_COUNT = 'review_launch_count';
const KEY_REVIEW_SHOWN = 'review_shown';
const LAUNCHES_BEFORE_PROMPT = 5;

export async function maybeRequestReview() {
  try {
    const shown = await AsyncStorage.getItem(KEY_REVIEW_SHOWN);
    if (shown === 'true') return;

    const countStr = await AsyncStorage.getItem(KEY_LAUNCH_COUNT);
    const count = (parseInt(countStr, 10) || 0) + 1;
    await AsyncStorage.setItem(KEY_LAUNCH_COUNT, String(count));

    if (count >= LAUNCHES_BEFORE_PROMPT && InAppReview.isAvailable()) {
      await InAppReview.RequestInAppReview();
      await AsyncStorage.setItem(KEY_REVIEW_SHOWN, 'true');
    }
  } catch {}
}
