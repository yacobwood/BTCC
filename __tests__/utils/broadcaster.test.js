import {detectBroadcaster, BROADCASTERS} from '../../src/utils/broadcaster';

// detectBroadcaster reads Intl.DateTimeFormat().resolvedOptions()
// Override it per-test via jest.spyOn.

describe('detectBroadcaster', () => {
  let spy;

  afterEach(() => {
    if (spy) spy.mockRestore();
  });

  function mockIntl({timeZone = '', locale = ''} = {}) {
    spy = jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({timeZone, locale});
  }

  it('returns "uk" for Europe/London timezone', () => {
    mockIntl({timeZone: 'Europe/London', locale: 'en'});
    expect(detectBroadcaster()).toBe('uk');
  });

  it('returns "uk" for en-GB locale', () => {
    mockIntl({timeZone: 'Europe/Paris', locale: 'en-GB'});
    expect(detectBroadcaster()).toBe('uk');
  });

  it('returns "us" for en-US locale', () => {
    mockIntl({timeZone: 'America/New_York', locale: 'en-US'});
    expect(detectBroadcaster()).toBe('us');
  });

  it('returns "international" for other locale and timezone', () => {
    mockIntl({timeZone: 'Asia/Tokyo', locale: 'ja-JP'});
    expect(detectBroadcaster()).toBe('international');
  });

  it('returns "international" when Intl throws', () => {
    spy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('unavailable');
    });
    expect(detectBroadcaster()).toBe('international');
  });
});

describe('BROADCASTERS', () => {
  it('has uk and international keys', () => {
    expect(BROADCASTERS.uk).toBeDefined();
    expect(BROADCASTERS.international).toBeDefined();
  });

  it('uk entry has label, sub and url', () => {
    expect(BROADCASTERS.uk.label).toBeTruthy();
    expect(BROADCASTERS.uk.url).toMatch(/^https/);
  });
});
