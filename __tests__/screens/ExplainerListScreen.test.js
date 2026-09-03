import React from 'react';
import {act, fireEvent, waitFor} from '@testing-library/react-native';
import ExplainerListScreen from '../../src/screens/ExplainerListScreen';
import {renderWithProviders, makeNav} from './testUtils';

jest.mock('../../src/api/client', () => ({
  fetchExplainerArticles: jest.fn(),
}));

jest.mock('../../src/utils/explainerRead', () => ({
  getReadIds:  jest.fn(() => Promise.resolve(new Set())),
  markRead:    jest.fn(() => Promise.resolve()),
  markAllRead: jest.fn(() => Promise.resolve()),
}));

const {fetchExplainerArticles} = require('../../src/api/client');
const {getReadIds, markRead, markAllRead} = require('../../src/utils/explainerRead');
const nav = makeNav();

const ARTICLE = {
  id: 'explainer-ttb-toca-turbo-boost',
  title: 'TOCA Turbo Boost: the "extra push" that keeps the BTCC pack together',
  content: '<p>TTB explained.</p>',
  category: 'Regs Explained',
  pubDate: '23 Oct 2026',
  sortDate: '2026-10-23T09:00:00',
  source: 'btcc hub',
  order: 5,
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchExplainerArticles.mockResolvedValue([ARTICLE]);
  getReadIds.mockResolvedValue(new Set());
  markRead.mockResolvedValue(undefined);
  markAllRead.mockResolvedValue(undefined);
});

function renderScreen() {
  return renderWithProviders(<ExplainerListScreen navigation={nav} />);
}

describe('ExplainerListScreen', () => {
  it('shows a loading indicator before articles arrive', () => {
    fetchExplainerArticles.mockImplementation(() => new Promise(() => {}));
    const {UNSAFE_queryByType} = renderScreen();
    const {ActivityIndicator} = require('react-native');
    expect(UNSAFE_queryByType(ActivityIndicator)).toBeTruthy();
  });

  it('renders a fetched article title', async () => {
    const {getByText} = renderScreen();
    await waitFor(() => expect(getByText(ARTICLE.title)).toBeTruthy());
  });

  it('renders the episode number from the order field', async () => {
    const {getByText} = renderScreen();
    await waitFor(() => expect(getByText('EPISODE 5 · REGS EXPLAINED')).toBeTruthy());
  });

  it('falls back to just the category when order is missing', async () => {
    fetchExplainerArticles.mockResolvedValue([{...ARTICLE, order: null}]);
    const {getByText} = renderScreen();
    await waitFor(() => expect(getByText('REGS EXPLAINED')).toBeTruthy());
  });

  it('shows an empty-state message when there are no articles', async () => {
    fetchExplainerArticles.mockResolvedValue([]);
    const {getByText} = renderScreen();
    await waitFor(() => expect(getByText(/No explainer articles yet/)).toBeTruthy());
  });

  // Regression coverage for where this explanation lives: it's the list's
  // own header, not baked into whichever article happens to sort first
  // (see the file's own module docstring for why) - so it must appear
  // regardless of which/how many articles are actually loaded.
  it('shows the "what is Academy" intro above the article list', async () => {
    const {getByText} = renderScreen();
    await waitFor(() => expect(getByText(/BTCC Hub's own guide to the rules/)).toBeTruthy());
  });

  it('still shows the intro even when there are no articles', async () => {
    fetchExplainerArticles.mockResolvedValue([]);
    const {getByText} = renderScreen();
    await waitFor(() => expect(getByText(/BTCC Hub's own guide to the rules/)).toBeTruthy());
  });

  it('tapping an article navigates to Article with the full article object', async () => {
    const {getByText} = renderScreen();
    await waitFor(() => getByText(ARTICLE.title));
    await act(async () => { fireEvent.press(getByText(ARTICLE.title)); });
    expect(nav.navigate).toHaveBeenCalledWith('Article', {article: ARTICLE, trafficSource: 'explainer_list'});
  });

  it('shows a retry button and reloads on a fetch error with nothing cached', async () => {
    fetchExplainerArticles.mockRejectedValueOnce(new Error('network error'));
    const {getByText} = renderScreen();
    await waitFor(() => expect(getByText('network error')).toBeTruthy());
    fetchExplainerArticles.mockResolvedValueOnce([ARTICLE]);
    await act(async () => { fireEvent.press(getByText('Retry')); });
    await waitFor(() => expect(getByText(ARTICLE.title)).toBeTruthy());
  });

  // Regression coverage: found live 2026-09-03 - an admin previewing a
  // second article found it didn't show up, because fetchExplainerArticles
  // has its own 5-minute on-device cache and this screen only ever fetched
  // once, on mount. Returning to this screen (a real tab press or back
  // navigation, both fire 'focus') must force a fresh look, bypassing that
  // cache, not just re-ask for whatever's already cached.
  it('force-refreshes the article list on focus, not just on mount', async () => {
    let focusCb;
    nav.addListener.mockImplementationOnce((event, cb) => {
      if (event === 'focus') focusCb = cb;
      return jest.fn();
    });
    renderScreen();
    await waitFor(() => expect(fetchExplainerArticles).toHaveBeenCalledTimes(1));
    expect(fetchExplainerArticles).toHaveBeenNthCalledWith(1, false);

    await act(async () => { focusCb(); });

    expect(fetchExplainerArticles).toHaveBeenCalledTimes(2);
    expect(fetchExplainerArticles).toHaveBeenNthCalledWith(2, true);
  });

  // ── Read/unread - mirrors DigestsScreen's own behaviour exactly, added
  // 2026-09-02 so Academy articles work the same way as The Flying Lap. ──

  it('shows "Mark all read" button when articles are loaded', async () => {
    const {getByText, getByLabelText} = renderScreen();
    await waitFor(() => getByText(ARTICLE.title));
    expect(getByLabelText('Mark all read')).toBeTruthy();
  });

  it('shows "Mark all unread" button when all articles are read', async () => {
    getReadIds.mockResolvedValueOnce(new Set([ARTICLE.id]));
    const {getByText, getByLabelText} = renderScreen();
    await waitFor(() => getByText(ARTICLE.title));
    expect(getByLabelText('Mark all unread')).toBeTruthy();
  });

  it('marks the article read and navigates when pressed', async () => {
    const {getByText} = renderScreen();
    await waitFor(() => getByText(ARTICLE.title));
    await act(async () => { fireEvent.press(getByText(ARTICLE.title)); });
    expect(markRead).toHaveBeenCalledWith(ARTICLE.id);
    expect(nav.navigate).toHaveBeenCalledWith('Article', {article: ARTICLE, trafficSource: 'explainer_list'});
  });

  it('calls markAllRead when "Mark all read" is pressed', async () => {
    const {getByText, getByLabelText} = renderScreen();
    await waitFor(() => getByText(ARTICLE.title));
    await act(async () => { fireEvent.press(getByLabelText('Mark all read')); });
    expect(markAllRead).toHaveBeenCalledWith([ARTICLE.id]);
  });

  it('calls markAllRead with an empty list when "Mark unread" is pressed', async () => {
    getReadIds.mockResolvedValueOnce(new Set([ARTICLE.id]));
    const {getByText, getByLabelText} = renderScreen();
    await waitFor(() => getByText(ARTICLE.title));
    await act(async () => { fireEvent.press(getByLabelText('Mark all unread')); });
    expect(markAllRead).toHaveBeenCalledWith([]);
  });

  it('shows a READ badge on an already-read article', async () => {
    getReadIds.mockResolvedValueOnce(new Set([ARTICLE.id]));
    const {getByText} = renderScreen();
    await waitFor(() => getByText(ARTICLE.title));
    expect(getByText('READ')).toBeTruthy();
  });

  it('does not show a READ badge on an unread article', async () => {
    const {getByText, queryByText} = renderScreen();
    await waitFor(() => getByText(ARTICLE.title));
    expect(queryByText('READ')).toBeNull();
  });

  it('re-fetches read state when the screen regains focus', async () => {
    renderScreen();
    await act(async () => {});
    const focusHandler = nav.addListener.mock.calls.find(c => c[0] === 'focus')?.[1];
    expect(focusHandler).toBeTruthy();
    getReadIds.mockClear();
    await act(async () => { focusHandler(); });
    expect(getReadIds).toHaveBeenCalled();
  });
});
