import AsyncStorage from '@react-native-async-storage/async-storage';
import InAppReview from 'react-native-in-app-review';
import {maybeRequestReviewAfterResults} from '../../src/utils/reviewPrompt';

const NOW = 1_700_000_000_000;
const EIGHT_DAYS_AGO = NOW - 8 * 24 * 60 * 60 * 1000;

describe('maybeRequestReviewAfterResults', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does nothing if review_shown is already true', async () => {
    AsyncStorage.getItem.mockImplementation(key => {
      if (key === 'review_shown') return Promise.resolve('true');
      return Promise.resolve(null);
    });

    await maybeRequestReviewAfterResults();

    expect(InAppReview.RequestInAppReview).not.toHaveBeenCalled();
  });

  it('does nothing if has_reviewed is already true', async () => {
    AsyncStorage.getItem.mockImplementation(key => {
      if (key === 'has_reviewed') return Promise.resolve('true');
      return Promise.resolve(null);
    });

    await maybeRequestReviewAfterResults();

    expect(InAppReview.RequestInAppReview).not.toHaveBeenCalled();
  });

  it('records first launch timestamp and returns early on first call', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    await maybeRequestReviewAfterResults();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('review_first_launch_ts', String(NOW));
    expect(InAppReview.RequestInAppReview).not.toHaveBeenCalled();
  });

  it('does not prompt if fewer than 7 days have passed', async () => {
    const FIVE_DAYS_AGO = NOW - 5 * 24 * 60 * 60 * 1000;
    AsyncStorage.getItem.mockImplementation(key => {
      if (key === 'review_first_launch_ts') return Promise.resolve(String(FIVE_DAYS_AGO));
      return Promise.resolve(null);
    });

    await maybeRequestReviewAfterResults();

    expect(InAppReview.RequestInAppReview).not.toHaveBeenCalled();
  });

  it('requests review after 7+ days and marks both keys as shown', async () => {
    AsyncStorage.getItem.mockImplementation(key => {
      if (key === 'review_first_launch_ts') return Promise.resolve(String(EIGHT_DAYS_AGO));
      return Promise.resolve(null);
    });

    await maybeRequestReviewAfterResults();

    expect(InAppReview.RequestInAppReview).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.multiSet).toHaveBeenCalledWith([
      ['review_shown', 'true'],
      ['has_reviewed', 'true'],
    ]);
  });

  it('does not request review when InAppReview is unavailable', async () => {
    InAppReview.isAvailable.mockReturnValueOnce(false);
    AsyncStorage.getItem.mockImplementation(key => {
      if (key === 'review_first_launch_ts') return Promise.resolve(String(EIGHT_DAYS_AGO));
      return Promise.resolve(null);
    });

    await maybeRequestReviewAfterResults();

    expect(InAppReview.RequestInAppReview).not.toHaveBeenCalled();
  });

  it('does not throw when AsyncStorage fails', async () => {
    AsyncStorage.getItem.mockRejectedValue(new Error('storage error'));
    await expect(maybeRequestReviewAfterResults()).resolves.toBeUndefined();
  });
});
