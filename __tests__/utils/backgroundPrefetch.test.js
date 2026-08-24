// backgroundPrefetch.js only uses Image from react-native.
// jest.mock is hoisted before variable declarations, so define the fn inside
// and retrieve it via the mocked module import below.
jest.mock('react-native', () => ({
  Image: {prefetch: jest.fn(() => Promise.resolve(true)), getSize: jest.fn()},
}));

jest.mock('../../src/api/client', () => ({
  fetchDrivers:  jest.fn(),
  fetchArticles: jest.fn(),
  fetchCalendar: jest.fn(),
}));

jest.mock('../../src/api/parsers', () => ({
  parseGrid:       jest.fn(),
  parseArticle:    jest.fn(),
  parseCalendar:   jest.fn(),
  // Mirrors the real thumbUrl's signature (including the '150x150' default)
  // rather than just echoing the url back, so tests can actually catch a
  // wrong/default size argument - the exact class of bug this file's own
  // history already had (prefetching -150x150 while the real render site
  // requested -300x300, a mismatch that meant the prefetch warmed a URL
  // nothing ever asked for).
  thumbUrl: jest.fn((url, size = '150x150') => (url ? url.replace(/(\.[a-z]+)$/i, `-${size}$1`) : url)),
  carThumbUrl:     jest.fn(url => (url ? url.replace(/(\.[a-z0-9]+)$/i, '-thumb$1') : url)),
  carThumbCropUrl: jest.fn(url => (url ? url.replace(/(\.[a-z0-9]+)$/i, '-thumb-crop$1') : url)),
}));

import {Image} from 'react-native';
import {runBackgroundPrefetch} from '../../src/utils/backgroundPrefetch';
import {fetchDrivers, fetchArticles, fetchCalendar} from '../../src/api/client';
import {parseGrid, parseArticle, parseCalendar} from '../../src/api/parsers';

const prefetch = Image.prefetch;

// Every test that doesn't care about calendar data still needs fetchCalendar/
// parseCalendar to resolve to something iterable, since runBackgroundPrefetch
// now always calls prefetchTracks() alongside prefetchDrivers()/prefetchNews().
function mockEmptyCalendar() {
  fetchCalendar.mockResolvedValue({});
  parseCalendar.mockReturnValue({rounds: []});
}

describe('runBackgroundPrefetch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does NOT immediately fetch or prefetch anything', () => {
    runBackgroundPrefetch();
    expect(fetchDrivers).not.toHaveBeenCalled();
    expect(fetchArticles).not.toHaveBeenCalled();
    expect(fetchCalendar).not.toHaveBeenCalled();
    expect(prefetch).not.toHaveBeenCalled();
  });

  it('fetches drivers, articles and the calendar after 3 second delay', async () => {
    fetchDrivers.mockResolvedValue({drivers: [], teams: []});
    fetchArticles.mockResolvedValue([]);
    parseGrid.mockReturnValue({drivers: [], teams: []});
    mockEmptyCalendar();

    runBackgroundPrefetch();
    expect(fetchDrivers).not.toHaveBeenCalled();

    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchDrivers).toHaveBeenCalled();
    expect(fetchArticles).toHaveBeenCalled();
    expect(fetchCalendar).toHaveBeenCalled();
  });

  it('prefetches driver image URLs at the same 300x300 size the tile/header actually request, not thumbUrl\'s own 150x150 default', async () => {
    fetchDrivers.mockResolvedValue({});
    fetchArticles.mockResolvedValue([]);
    mockEmptyCalendar();
    parseGrid.mockReturnValue({
      drivers: [
        {name: 'Tom Ingram',    imageUrl: 'https://cdn.example.com/ingram.jpg'},
        {name: 'Dan Rowbottom', imageUrl: 'https://cdn.example.com/rowbottom.jpg'},
      ],
      teams: [],
    });

    runBackgroundPrefetch();
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    await Promise.resolve();

    expect(prefetch).toHaveBeenCalledWith('https://cdn.example.com/ingram-300x300.jpg');
    expect(prefetch).toHaveBeenCalledWith('https://cdn.example.com/rowbottom-300x300.jpg');
    // The old mismatched size should never be requested.
    expect(prefetch).not.toHaveBeenCalledWith('https://cdn.example.com/ingram-150x150.jpg');
  });

  it('prefetches driver cardBgUrl and numberImageUrl unmodified (no render site applies a targetWidth rewrite to either)', async () => {
    fetchDrivers.mockResolvedValue({});
    fetchArticles.mockResolvedValue([]);
    mockEmptyCalendar();
    parseGrid.mockReturnValue({
      drivers: [
        {name: 'Nicolas Hamilton', imageUrl: null, cardBgUrl: 'https://cdn.example.com/hamilton-bg.png', numberImageUrl: 'https://cdn.example.com/28.png'},
      ],
      teams: [],
    });

    runBackgroundPrefetch();
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    await Promise.resolve();

    expect(prefetch).toHaveBeenCalledWith('https://cdn.example.com/hamilton-bg.png');
    expect(prefetch).toHaveBeenCalledWith('https://cdn.example.com/28.png');
  });

  it('prefetches both thumbnail variants of each driver\'s own carImageUrl (the plain -thumb TeamDetailScreen\'s hero requests, and the -thumb-crop DriverDetailScreen\'s banner requests)', async () => {
    fetchDrivers.mockResolvedValue({});
    fetchArticles.mockResolvedValue([]);
    mockEmptyCalendar();
    parseGrid.mockReturnValue({
      drivers: [
        {name: 'Dexter Patterson', imageUrl: null, carImageUrl: 'https://cdn.example.com/patterson-car.png'},
        {name: 'Nick Halstead',    imageUrl: null, carImageUrl: 'https://cdn.example.com/halstead-car.webp'},
      ],
      teams: [],
    });

    runBackgroundPrefetch();
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    await Promise.resolve();

    // Not the full-size original - these are the actual URLs the two
    // screens showing this driver's car request (see TeamDetailScreen.js
    // and DriverDetailScreen.js).
    expect(prefetch).toHaveBeenCalledWith('https://cdn.example.com/patterson-car-thumb.png');
    expect(prefetch).toHaveBeenCalledWith('https://cdn.example.com/halstead-car-thumb.webp');
    expect(prefetch).toHaveBeenCalledWith('https://cdn.example.com/patterson-car-thumb-crop.png');
    expect(prefetch).toHaveBeenCalledWith('https://cdn.example.com/halstead-car-thumb-crop.webp');
  });

  // Regression coverage 2026-08-24: team sponsor logos had never been
  // prefetched at all - a real gap for offline browsing, since
  // DriversScreen's Teams tab, MerchScreen and TeamDetailScreen's hero all
  // show this. cardBgThumbUrl isn't populated on any real team yet, but
  // both those same tiles prefer it over cardBgUrl when present, so it's
  // covered too rather than left a silent gap the day it is.
  it('prefetches team logoUrl and cardBgThumbUrl (when present)', async () => {
    fetchDrivers.mockResolvedValue({});
    fetchArticles.mockResolvedValue([]);
    mockEmptyCalendar();
    parseGrid.mockReturnValue({
      drivers: [],
      teams: [
        {name: 'NAPA Racing UK', cardBgUrl: 'https://cdn.example.com/napa-bg.png', logoUrl: 'https://cdn.example.com/napa-logo.png'},
        {name: 'Steel Seal with Power Maxed Racing', cardBgUrl: 'https://cdn.example.com/steelseal-bg.png', cardBgThumbUrl: 'https://cdn.example.com/steelseal-bg-thumb.png', logoUrl: null},
      ],
    });

    runBackgroundPrefetch();
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    await Promise.resolve();

    expect(prefetch).toHaveBeenCalledWith('https://cdn.example.com/napa-logo.png');
    expect(prefetch).toHaveBeenCalledWith('https://cdn.example.com/steelseal-bg-thumb.png');
  });

  it('prefetches article image URLs returned from API', async () => {
    fetchDrivers.mockResolvedValue({});
    parseGrid.mockReturnValue({drivers: [], teams: []});
    mockEmptyCalendar();
    fetchArticles.mockResolvedValue([{id: 1}, {id: 2}]);
    parseArticle
      .mockReturnValueOnce({imageUrl: 'https://cdn.example.com/article1.jpg'})
      .mockReturnValueOnce({imageUrl: null}); // second article has no image — should be skipped

    runBackgroundPrefetch();
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    await Promise.resolve();

    expect(prefetch).toHaveBeenCalledWith('https://cdn.example.com/article1-300x300.jpg');
  });

  // Regression coverage 2026-08-24: the circuit guide (hero photo, layout
  // map, race-photo carousel) had never been prefetched at all - the exact
  // screen a fan would want working with no signal at the track itself.
  // Covers every round in the calendar, not just the next one, since the
  // total is small enough that guessing which round matters isn't worth it.
  it('prefetches every round\'s track hero/layout image (sized to match TrackDetailScreen) and raceImages (unsized, matching its plain <Image> carousel)', async () => {
    fetchDrivers.mockResolvedValue({});
    parseGrid.mockReturnValue({drivers: [], teams: []});
    fetchArticles.mockResolvedValue([]);
    fetchCalendar.mockResolvedValue({});
    parseCalendar.mockReturnValue({
      rounds: [
        {
          venue: 'Donington Park',
          imageUrl: 'https://cdn.example.com/donington.jpg',
          layoutImageUrl: 'https://cdn.example.com/donington-layout.jpg',
          raceImages: ['https://cdn.example.com/donington-1.jpg', 'https://cdn.example.com/donington-2.jpg'],
        },
        {
          venue: 'No Images Track',
          imageUrl: null,
          layoutImageUrl: null,
          raceImages: [],
        },
      ],
    });

    runBackgroundPrefetch();
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    await Promise.resolve();

    expect(prefetch).toHaveBeenCalledWith('https://cdn.example.com/donington-768x768.jpg');
    expect(prefetch).toHaveBeenCalledWith('https://cdn.example.com/donington-layout-300x300.jpg');
    expect(prefetch).toHaveBeenCalledWith('https://cdn.example.com/donington-1.jpg');
    expect(prefetch).toHaveBeenCalledWith('https://cdn.example.com/donington-2.jpg');
  });

  it('does not prefetch null image URLs', async () => {
    fetchDrivers.mockResolvedValue({});
    parseGrid.mockReturnValue({
      drivers: [{name: 'No Image Driver', imageUrl: null}],
      teams:   [],
    });
    fetchArticles.mockResolvedValue([]);
    mockEmptyCalendar();

    runBackgroundPrefetch();
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    await Promise.resolve();

    const nullCalls = prefetch.mock.calls.filter(([url]) => url === null || url === undefined);
    expect(nullCalls).toHaveLength(0);
  });

  it('silently handles driver fetch errors', async () => {
    fetchDrivers.mockRejectedValue(new Error('network down'));
    fetchArticles.mockResolvedValue([]);
    parseArticle.mockReturnValue({imageUrl: null});
    mockEmptyCalendar();

    runBackgroundPrefetch();
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    await Promise.resolve();
    // Should not throw
  });

  it('silently handles article fetch errors', async () => {
    fetchDrivers.mockResolvedValue({});
    parseGrid.mockReturnValue({drivers: [], teams: []});
    fetchArticles.mockRejectedValue(new Error('timeout'));
    mockEmptyCalendar();

    runBackgroundPrefetch();
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    await Promise.resolve();
    // Should not throw
  });

  it('silently handles calendar fetch errors', async () => {
    fetchDrivers.mockResolvedValue({});
    parseGrid.mockReturnValue({drivers: [], teams: []});
    fetchArticles.mockResolvedValue([]);
    fetchCalendar.mockRejectedValue(new Error('offline'));

    runBackgroundPrefetch();
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    await Promise.resolve();
    // Should not throw
  });
});
