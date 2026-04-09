import AsyncStorage from '@react-native-async-storage/async-storage';
import InAppReview from 'react-native-in-app-review';

const KEY_LAUNCHES = 'app_launch_count';
const KEY_REVIEWED = 'has_reviewed';
const LAUNCH_THRESHOLD = 5;

export async function maybeRequestReview() {
  try {
    const reviewed = await AsyncStorage.getItem(KEY_REVIEWED);
    if (reviewed === 'true') return;

    const count = parseInt(await AsyncStorage.getItem(KEY_LAUNCHES) || '0', 10) + 1;
    await AsyncStorage.setItem(KEY_LAUNCHES, String(count));

    if (count >= LAUNCH_THRESHOLD && InAppReview.isAvailable()) {
      const result = await InAppReview.RequestInAppReview();
      if (result) {
        await AsyncStorage.setItem(KEY_REVIEWED, 'true');
      }
    }
  } catch {}
}
