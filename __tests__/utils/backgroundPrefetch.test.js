// backgroundPrefetch.js only uses Image from react-native.
// jest.mock is hoisted before variable declarations, so define the fn inside
// and retrieve it via the mocked module import below.
jest.mock('react-native', () => ({
  Image: {prefetch: jest.fn(() => Promise.resolve(true)), getSize: jest.fn()},
}));

jest.mock('../../src/api/client', () => ({
  fetchDrivers:  jest.fn(),
  fetchArticles: jest.fn(),
}));

jest.mock('../../src/api/parsers', () => ({
  parseGrid:    jest.fn(),
  parseArticle: jest.fn(),
}));

import {Image} from 'react-native';
import {runBackgroundPrefetch} from '../../src/utils/backgroundPrefetch';
import {fetchDrivers, fetchArticles} from '../../src/api/client';
import {parseGrid, parseArticle} from '../../src/api/parsers';

const prefetch = Image.prefetch;

describe('runBackgroundPrefetch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('immediately prefetches calendar images', () => {
    runBackgroundPrefetch();
    expect(prefetch).toHaveBeenCalled();
  });

  it('does NOT immediately fetch drivers or articles', () => {
    runBackgroundPrefetch();
    expect(fetchDrivers).not.toHaveBeenCalled();
    expect(fetchArticles).not.toHaveBeenCalled();
  });

  it('fetches drivers and articles after 3 second delay', async () => {
    fetchDrivers.mockResolvedValue({drivers: [], teams: []});
    fetchArticles.mockResolvedValue([]);
    parseGrid.mockReturnValue({drivers: [], teams: []});

    runBackgroundPrefetch();
    expect(fetchDrivers).not.toHaveBeenCalled();

    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchDrivers).toHaveBeenCalled();
    expect(fetchArticles).toHaveBeenCalled();
  });

  it('prefetches driver image URLs returned from API', async () => {
    fetchDrivers.mockResolvedValue({});
    fetchArticles.mockResolvedValue([]);
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

    expect(prefetch).toHaveBeenCalledWith('https://cdn.example.com/ingram.jpg');
    expect(prefetch).toHaveBeenCalledWith('https://cdn.example.com/rowbottom.jpg');
  });

  it('prefetches article image URLs returned from API', async () => {
    fetchDrivers.mockResolvedValue({});
    parseGrid.mockReturnValue({drivers: [], teams: []});
    fetchArticles.mockResolvedValue([{id: 1}, {id: 2}]);
    parseArticle
      .mockReturnValueOnce({imageUrl: 'https://cdn.example.com/article1.jpg'})
      .mockReturnValueOnce({imageUrl: null}); // second article has no image — should be skipped

    runBackgroundPrefetch();
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    await Promise.resolve();

    expect(prefetch).toHaveBeenCalledWith('https://cdn.example.com/article1.jpg');
  });

  it('does not prefetch null image URLs', async () => {
    fetchDrivers.mockResolvedValue({});
    parseGrid.mockReturnValue({
      drivers: [{name: 'No Image Driver', imageUrl: null}],
      teams:   [],
    });
    fetchArticles.mockResolvedValue([]);

    const callsBefore = prefetch.mock.calls.length;
    runBackgroundPrefetch();
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    await Promise.resolve();

    // Only calendar images (not the null driver image) should have been prefetched
    const driverImageCalls = prefetch.mock.calls.filter(
      ([url]) => url === null || url === undefined,
    );
    expect(driverImageCalls).toHaveLength(0);
  });

  it('silently handles driver fetch errors', async () => {
    fetchDrivers.mockRejectedValue(new Error('network down'));
    fetchArticles.mockResolvedValue([]);
    parseArticle.mockReturnValue({imageUrl: null});

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

    runBackgroundPrefetch();
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    await Promise.resolve();
    // Should not throw
  });
});
