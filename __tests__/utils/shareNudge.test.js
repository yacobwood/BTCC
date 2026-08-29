import AsyncStorage from '@react-native-async-storage/async-storage';
import {maybeShowShareNudge, markShareNudgeShown} from '../../src/utils/shareNudge';

const NOW = 1_700_000_000_000;
const ELEVEN_DAYS_AGO = NOW - 11 * 24 * 60 * 60 * 1000;

describe('maybeShowShareNudge', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns false if already shown', async () => {
    AsyncStorage.getItem.mockImplementation(key => {
      if (key === 'share_nudge_shown') return Promise.resolve('true');
      return Promise.resolve(null);
    });

    expect(await maybeShowShareNudge()).toBe(false);
  });

  it('records first view timestamp and returns false on first call', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    expect(await maybeShowShareNudge()).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('share_nudge_first_view_ts', String(NOW));
  });

  it('returns false if fewer than 10 days have passed since the first view', async () => {
    const FIVE_DAYS_AGO = NOW - 5 * 24 * 60 * 60 * 1000;
    AsyncStorage.getItem.mockImplementation(key => {
      if (key === 'share_nudge_first_view_ts') return Promise.resolve(String(FIVE_DAYS_AGO));
      return Promise.resolve(null);
    });

    expect(await maybeShowShareNudge()).toBe(false);
  });

  it('returns true once 10+ days have passed since the first view', async () => {
    AsyncStorage.getItem.mockImplementation(key => {
      if (key === 'share_nudge_first_view_ts') return Promise.resolve(String(ELEVEN_DAYS_AGO));
      return Promise.resolve(null);
    });

    expect(await maybeShowShareNudge()).toBe(true);
  });

  it('does not throw when AsyncStorage fails', async () => {
    AsyncStorage.getItem.mockRejectedValue(new Error('storage error'));
    await expect(maybeShowShareNudge()).resolves.toBe(false);
  });
});

describe('markShareNudgeShown', () => {
  it('sets the shown key to true', async () => {
    await markShareNudgeShown();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('share_nudge_shown', 'true');
  });

  it('does not throw when AsyncStorage fails', async () => {
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('storage error'));
    await expect(markShareNudgeShown()).resolves.toBeUndefined();
  });
});
