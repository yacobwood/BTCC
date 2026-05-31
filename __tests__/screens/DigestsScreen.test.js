import React from 'react';
import {act, fireEvent} from '@testing-library/react-native';
import {InteractionManager} from 'react-native';
import DigestsScreen from '../../src/screens/DigestsScreen';
import {renderWithProviders, makeNav} from './testUtils';

jest.mock('../../src/api/client', () => ({
  fetchHubPosts: jest.fn(),
}));

jest.mock('../../src/utils/digestRead', () => ({
  getReadIds:    jest.fn(() => Promise.resolve(new Set())),
  markRead:      jest.fn(() => Promise.resolve()),
  markAllRead:   jest.fn(() => Promise.resolve()),
  markUnread:    jest.fn(() => Promise.resolve()),
}));

const {fetchHubPosts} = require('../../src/api/client');
const {getReadIds, markRead, markAllRead, markUnread} = require('../../src/utils/digestRead');

const MOCK_DIGESTS = [
  {id: 1, title: 'Donington Park Roundup',    pubDate: '20 Apr 2026', imageUrl: null, source: 'btcc.net', category: 'Weekly Digest', sortDate: '2026-04-20'},
  {id: 2, title: 'Brands Hatch Indy Roundup', pubDate: '18 May 2026', imageUrl: null, source: 'btcc.net', category: 'Weekly Digest', sortDate: '2026-05-18'},
];

const nav = makeNav();

async function renderDigests(digests = MOCK_DIGESTS) {
  fetchHubPosts.mockResolvedValueOnce(digests);
  jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation(cb => {
    cb();
    return {cancel: jest.fn()};
  });

  const utils = renderWithProviders(<DigestsScreen navigation={nav} />);
  await act(async () => {});
  return utils;
}

describe('DigestsScreen', () => {
  beforeEach(() => {
    getReadIds.mockResolvedValue(new Set());
    markRead.mockResolvedValue(undefined);
    markAllRead.mockResolvedValue(undefined);
    markUnread.mockResolvedValue(undefined);
  });

  it('renders the BTCC MONDAY ROUNDUP header', async () => {
    const {getByText} = await renderDigests();
    expect(getByText('BTCC MONDAY ROUNDUP')).toBeTruthy();
  });

  it('shows a loading indicator while fetching', async () => {
    fetchHubPosts.mockReturnValueOnce(new Promise(() => {}));
    jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation(cb => {
      cb();
      return {cancel: jest.fn()};
    });
    const {UNSAFE_getAllByType} = renderWithProviders(<DigestsScreen navigation={nav} />);
    const {ActivityIndicator} = require('react-native');
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it('renders digest article titles', async () => {
    const {getByText} = await renderDigests();
    expect(getByText('Donington Park Roundup')).toBeTruthy();
    expect(getByText('Brands Hatch Indy Roundup')).toBeTruthy();
  });

  it('filters out non-digest articles', async () => {
    const mixed = [
      ...MOCK_DIGESTS,
      {id: 3, title: 'Latest News Article', pubDate: '1 Apr 2026', imageUrl: null, source: 'btcc.net', category: 'LATEST NEWS', sortDate: '2026-04-01'},
    ];
    const {queryByText} = await renderDigests(mixed);
    expect(queryByText('Latest News Article')).toBeNull();
  });

  it('shows empty state when no digests are returned', async () => {
    const {getByText} = await renderDigests([]);
    expect(getByText('No digests found')).toBeTruthy();
  });

  it('shows error state and Retry button when fetch fails', async () => {
    fetchHubPosts.mockRejectedValueOnce(new Error('network'));
    jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation(cb => {
      cb();
      return {cancel: jest.fn()};
    });
    const utils = renderWithProviders(<DigestsScreen navigation={nav} />);
    await act(async () => {});
    expect(utils.getByText('Could not load digests')).toBeTruthy();
    expect(utils.getByLabelText('Retry')).toBeTruthy();
  });

  it('shows "Mark all read" button when digests are loaded', async () => {
    const {getByLabelText} = await renderDigests();
    expect(getByLabelText('Mark all read')).toBeTruthy();
  });

  it('shows "Mark all unread" button when all digests are read', async () => {
    getReadIds.mockResolvedValueOnce(new Set(['1', '2']));
    const {getByLabelText} = await renderDigests();
    expect(getByLabelText('Mark all unread')).toBeTruthy();
  });

  it('marks article as read and navigates to Article screen when pressed', async () => {
    const {getByText} = await renderDigests();
    await act(async () => {
      fireEvent.press(getByText('Donington Park Roundup'));
    });
    expect(markRead).toHaveBeenCalledWith(1);
    expect(nav.navigate).toHaveBeenCalledWith('Article', expect.objectContaining({
      article: expect.objectContaining({title: 'Donington Park Roundup'}),
    }));
  });

  it('calls markAllRead when "Mark all read" is pressed', async () => {
    const {getByLabelText} = await renderDigests();
    await act(async () => {
      fireEvent.press(getByLabelText('Mark all read'));
    });
    expect(markAllRead).toHaveBeenCalled();
  });

  it('shows back navigation button', async () => {
    const {getByLabelText} = await renderDigests();
    expect(getByLabelText('Go back')).toBeTruthy();
  });

  it('navigates back when back button is pressed', async () => {
    const {getByLabelText} = await renderDigests();
    fireEvent.press(getByLabelText('Go back'));
    expect(nav.goBack).toHaveBeenCalled();
  });
});
