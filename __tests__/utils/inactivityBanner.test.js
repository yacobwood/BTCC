import AsyncStorage from '@react-native-async-storage/async-storage';
import {checkAndStampLastOpen} from '../../src/utils/inactivityBanner';

const NOW = 1_700_000_000_000;
const ELEVEN_DAYS_AGO = NOW - 11 * 24 * 60 * 60 * 1000;

describe('checkAndStampLastOpen', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns false and stamps now on a first-ever launch (no prior stamp)', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    expect(await checkAndStampLastOpen()).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('last_open_ts', String(NOW));
  });

  it('returns false if fewer than 10 days have passed since the last open', async () => {
    const FIVE_DAYS_AGO = NOW - 5 * 24 * 60 * 60 * 1000;
    AsyncStorage.getItem.mockResolvedValue(String(FIVE_DAYS_AGO));

    expect(await checkAndStampLastOpen()).toBe(false);
  });

  it('returns true after 10+ days of inactivity, and re-stamps now', async () => {
    AsyncStorage.getItem.mockResolvedValue(String(ELEVEN_DAYS_AGO));

    expect(await checkAndStampLastOpen()).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('last_open_ts', String(NOW));
  });

  it('does not throw when AsyncStorage fails', async () => {
    AsyncStorage.getItem.mockRejectedValue(new Error('storage error'));
    await expect(checkAndStampLastOpen()).resolves.toBe(false);
  });
});
