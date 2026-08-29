import React from 'react';
import {AppState} from 'react-native';
import {renderHook, waitFor, act} from '@testing-library/react-native';
import {LiveUrlsProvider, useLiveUrls, ensureHttps} from '../../src/store/liveUrls';

const DEFAULTS = {
  saturday: {uk: null, international: null, us: null},
  sunday: {
    uk: {url: 'https://www.itv.com/hub/itv4', label: 'ITV4 / ITVX'},
    international: {url: 'https://www.youtube.com/@OfficialBTCC/streams', label: 'Official BTCC'},
    us: null,
  },
};

function wrapper({children}) {
  return <LiveUrlsProvider>{children}</LiveUrlsProvider>;
}

describe('ensureHttps', () => {
  it('passes through null/undefined unchanged', () => {
    expect(ensureHttps(null)).toBeNull();
    expect(ensureHttps(undefined)).toBeUndefined();
  });

  it('adds https:// to a bare domain', () => {
    expect(ensureHttps('www.itv.com/hub/itv4')).toBe('https://www.itv.com/hub/itv4');
  });

  it('leaves an already-https URL unchanged', () => {
    expect(ensureHttps('https://www.itv.com/hub/itv4')).toBe('https://www.itv.com/hub/itv4');
  });

  it('leaves an already-http URL unchanged (does not force https)', () => {
    expect(ensureHttps('http://example.com')).toBe('http://example.com');
  });
});

describe('LiveUrlsProvider / useLiveUrls', () => {
  let appStateListener;

  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn().mockResolvedValue({json: () => Promise.resolve({})});
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, cb) => {
      appStateListener = cb;
      return {remove: jest.fn()};
    });
  });

  it('returns the hardcoded defaults before any fetch resolves', () => {
    global.fetch = jest.fn(() => new Promise(() => {})); // never resolves
    const {result} = renderHook(() => useLiveUrls(), {wrapper});
    expect(result.current).toEqual(DEFAULTS);
  });

  it('merges a successful fetch result over the defaults (shallow merge)', async () => {
    const liveData = {saturday: {uk: {url: 'https://itv.com/live', label: 'ITV Live'}, international: null, us: null}};
    global.fetch = jest.fn().mockResolvedValue({json: () => Promise.resolve(liveData)});

    const {result} = renderHook(() => useLiveUrls(), {wrapper});

    await waitFor(() => expect(result.current.saturday.uk).toEqual({url: 'https://itv.com/live', label: 'ITV Live'}));
    // sunday wasn't in the fetched payload - shallow merge leaves it at its default
    expect(result.current.sunday).toEqual(DEFAULTS.sunday);
  });

  it('keeps the defaults when the fetch fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    const {result} = renderHook(() => useLiveUrls(), {wrapper});

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(result.current).toEqual(DEFAULTS);
  });

  it('refetches and re-merges when AppState becomes active', async () => {
    global.fetch = jest.fn().mockResolvedValue({json: () => Promise.resolve({})});
    const {result} = renderHook(() => useLiveUrls(), {wrapper});

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(appStateListener).toBeDefined();
    expect(result.current).toEqual(DEFAULTS);

    const liveData = {saturday: {uk: {url: 'https://itv.com/live', label: 'ITV Live'}, international: null, us: null}};
    global.fetch = jest.fn().mockResolvedValue({json: () => Promise.resolve(liveData)});

    await act(async () => { appStateListener('active'); });

    await waitFor(() => expect(result.current.saturday.uk).toEqual({url: 'https://itv.com/live', label: 'ITV Live'}));
  });

  it('does not refetch on a non-"active" AppState change', async () => {
    global.fetch = jest.fn().mockResolvedValue({json: () => Promise.resolve({})});
    renderHook(() => useLiveUrls(), {wrapper});
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    global.fetch.mockClear();
    await act(async () => { appStateListener('background'); });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
