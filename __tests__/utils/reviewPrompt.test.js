import AsyncStorage from '@react-native-async-storage/async-storage';
import InAppReview from 'react-native-in-app-review';
import {maybeRequestReview} from '../../src/utils/reviewPrompt';

describe('maybeRequestReview', () => {
  it('does nothing if review has already been shown', async () => {
    AsyncStorage.getItem.mockImplementation((key) => {
      if (key === 'review_shown') return Promise.resolve('true');
      return Promise.resolve(null);
    });

    await maybeRequestReview();

    expect(InAppReview.RequestInAppReview).not.toHaveBeenCalled();
    // launch count should not be incremented
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('review_launch_count', expect.anything());
  });

  it('increments launch count on each call', async () => {
    AsyncStorage.getItem.mockImplementation((key) => {
      if (key === 'review_launch_count') return Promise.resolve('2');
      return Promise.resolve(null); // review_shown = null
    });

    await maybeRequestReview();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('review_launch_count', '3');
  });

  it('treats missing launch count as 0 and increments to 1', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    await maybeRequestReview();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('review_launch_count', '1');
  });

  it('requests review when count reaches the threshold (5)', async () => {
    AsyncStorage.getItem.mockImplementation((key) => {
      if (key === 'review_launch_count') return Promise.resolve('4'); // will become 5
      return Promise.resolve(null);
    });

    await maybeRequestReview();

    expect(InAppReview.RequestInAppReview).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('review_shown', 'true');
  });

  it('does not request review below threshold', async () => {
    AsyncStorage.getItem.mockImplementation((key) => {
      if (key === 'review_launch_count') return Promise.resolve('2');
      return Promise.resolve(null);
    });

    await maybeRequestReview();

    expect(InAppReview.RequestInAppReview).not.toHaveBeenCalled();
  });

  it('does not request review when InAppReview is unavailable', async () => {
    InAppReview.isAvailable.mockReturnValueOnce(false);
    AsyncStorage.getItem.mockImplementation((key) => {
      if (key === 'review_launch_count') return Promise.resolve('4');
      return Promise.resolve(null);
    });

    await maybeRequestReview();

    expect(InAppReview.RequestInAppReview).not.toHaveBeenCalled();
  });

  it('still requests review on count > 5 (already past threshold)', async () => {
    AsyncStorage.getItem.mockImplementation((key) => {
      if (key === 'review_launch_count') return Promise.resolve('9');
      return Promise.resolve(null);
    });

    await maybeRequestReview();

    expect(InAppReview.RequestInAppReview).toHaveBeenCalledTimes(1);
  });

  it('does not throw when AsyncStorage fails', async () => {
    AsyncStorage.getItem.mockRejectedValue(new Error('storage error'));
    await expect(maybeRequestReview()).resolves.toBeUndefined();
  });
});
