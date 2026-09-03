import React from 'react';
import {act, fireEvent, waitFor} from '@testing-library/react-native';
import ExplainerListScreen from '../../src/screens/ExplainerListScreen';
import {renderWithProviders, makeNav} from './testUtils';

jest.mock('../../src/api/client', () => ({
  fetchExplainerArticles: jest.fn(),
  fetchExplainerArticleById: jest.fn(),
}));

jest.mock('../../src/utils/explainerRead', () => ({
  getReadIds:  jest.fn(() => Promise.resolve(new Set())),
  markRead:    jest.fn(() => Promise.resolve()),
  markAllRead: jest.fn(() => Promise.resolve()),
}));

const {fetchExplainerArticles, fetchExplainerArticleById} = require('../../src/api/client');
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
  fetchExplainerArticleById.mockResolvedValue(null);
  getReadIds.mockResolvedValue(new Set());
  markRead.mockResolvedValue(undefined);
  markAllRead.mockResolvedValue(undefined);
});

function renderScreen(route) {
  return renderWithProviders(<ExplainerListScreen navigation={nav} route={route} />);
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

// Regression coverage: found live 2026-09-04 - a notification tapped before
// raw.githubusercontent.com finished propagating (fetchExplainerArticleById's
// own short built-in retry, see api/client.test.js, wasn't enough on a run
// that took over 4 minutes) landed the user here via notifNavigation.js's
// fallback with nothing further ever checking again - a manual pull-to-
// refresh always found the article, proving the data layer was fine and
// this screen just never rechecked on its own after the one initial miss.
describe('ExplainerListScreen pendingArticleId polling', () => {
  const PENDING = {id: 'explainer-engine-rules', title: 'The two-engine season'};

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('does nothing extra when there is no pendingArticleId', async () => {
    renderScreen({params: {}});
    await act(async () => {});
    fetchExplainerArticleById.mockClear();
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(fetchExplainerArticleById).not.toHaveBeenCalled();
  });

  it('polls in the background and auto-opens the article once it appears', async () => {
    fetchExplainerArticleById
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(PENDING);
    renderScreen({params: {pendingArticleId: PENDING.id}});
    await act(async () => {});

    await act(async () => { jest.advanceTimersByTime(15000); }); // attempt 1: null
    await act(async () => { jest.advanceTimersByTime(15000); }); // attempt 2: null
    expect(nav.navigate).not.toHaveBeenCalledWith('Article', expect.anything());

    await act(async () => { jest.advanceTimersByTime(15000); }); // attempt 3: found
    expect(fetchExplainerArticleById).toHaveBeenCalledWith(PENDING.id, true, {retries: 0});
    expect(nav.navigate).toHaveBeenCalledWith('Article', {article: PENDING, trafficSource: 'notification'});
    expect(markRead).toHaveBeenCalledWith(PENDING.id);
  });

  it('stops polling after the bounded window if the article never appears', async () => {
    renderScreen({params: {pendingArticleId: PENDING.id}}); // fetchExplainerArticleById resolves null every time (default mock)
    await act(async () => {});

    await act(async () => { jest.advanceTimersByTime(8 * 15000); }); // exhausts all 8 attempts
    expect(fetchExplainerArticleById).toHaveBeenCalledTimes(8);
    expect(nav.navigate).not.toHaveBeenCalledWith('Article', expect.anything());

    fetchExplainerArticleById.mockClear();
    await act(async () => { jest.advanceTimersByTime(60000); }); // well past the window
    expect(fetchExplainerArticleById).not.toHaveBeenCalled(); // genuinely stopped, not still ticking
  });

  it('does not start a second poll loop on a re-render with the same pendingArticleId', async () => {
    const {rerender} = renderScreen({params: {pendingArticleId: PENDING.id}});
    await act(async () => {});
    fetchExplainerArticleById.mockClear();
    rerender(<ExplainerListScreen navigation={nav} route={{params: {pendingArticleId: PENDING.id}}} />);
    await act(async () => { jest.advanceTimersByTime(15000); });
    expect(fetchExplainerArticleById).toHaveBeenCalledTimes(1); // one loop's tick, not two overlapping loops
  });
});
