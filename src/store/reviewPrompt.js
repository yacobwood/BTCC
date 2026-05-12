import AsyncStorage from '@react-native-async-storage/async-storage';
import InAppReview from 'react-native-in-app-review';

const KEY_LAUNCHES = 'app_launch_count';
const KEY_REVIEWED = 'has_reviewed';
const KEY_REVIEW_SHOWN = 'review_shown'; // shared guard with utils/reviewPrompt.js
const LAUNCH_THRESHOLD = 5;

export async function maybeRequestReview() {
  try {
    const [reviewed, shown] = await Promise.all([
      AsyncStorage.getItem(KEY_REVIEWED),
      AsyncStorage.getItem(KEY_REVIEW_SHOWN),
    ]);
    if (reviewed === 'true' || shown === 'true') return;

    const count = parseInt(await AsyncStorage.getItem(KEY_LAUNCHES) || '0', 10) + 1;
    await AsyncStorage.setItem(KEY_LAUNCHES, String(count));

    if (count >= LAUNCH_THRESHOLD && InAppReview.isAvailable()) {
      const result = await InAppReview.RequestInAppReview();
      if (result) {
        await AsyncStorage.multiSet([[KEY_REVIEWED, 'true'], [KEY_REVIEW_SHOWN, 'true']]);
      }
    }
  } catch {}
}
