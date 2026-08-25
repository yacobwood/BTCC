import {Share} from 'react-native';
import {shareApp} from '../../src/utils/appShare';
import {Analytics} from '../../src/utils/analytics';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {contentShared: jest.fn()},
}));

describe('shareApp', () => {
  beforeEach(() => {
    jest.spyOn(Share, 'share').mockResolvedValue({action: 'sharedAction'});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs a contentShared analytics event tagged "app" with the given origin', async () => {
    await shareApp('more_menu');
    expect(Analytics.contentShared).toHaveBeenCalledWith('app', 'more_menu');
  });

  it('shares a message linking to the app with the origin as a ?src= tag', async () => {
    await shareApp('share_nudge');
    expect(Share.share).toHaveBeenCalledWith({
      message: expect.stringContaining('https://btcchub.vercel.app?src=share_nudge'),
    });
  });

  it('does not throw if Share.share rejects (e.g. the user dismissed the sheet)', async () => {
    Share.share.mockRejectedValueOnce(new Error('dismissed'));
    await expect(shareApp('more_menu')).resolves.toBeUndefined();
  });
});
