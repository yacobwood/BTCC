import React from 'react';
import {act, fireEvent, waitFor} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NewsScreen from '../../src/screens/NewsScreen';
import {renderWithProviders, makeNav, MOCK_ARTICLES, MOCK_ARTICLES_WITH_DIGEST} from './testUtils';

// useFocusEffect needs a NavigationContainer — mock it as a no-op in unit tests
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('../../src/api/client', () => ({
  fetchArticles: jest.fn(),
  fetchHubPosts: jest.fn(),
  fetchExplainerArticles: jest.fn(),
  peekArticlesCache: jest.fn(),
}));
jest.mock('../../src/api/parsers', () => ({
  parseArticle: jest.fn(a => a),
}));
jest.mock('../../src/utils/digestRead', () => ({
  getReadIds: jest.fn().mockResolvedValue(new Set()),
}));
jest.mock('../../src/utils/explainerRead', () => ({
  getReadIds: jest.fn().mockResolvedValue(new Set()),
}));

const {fetchArticles, fetchHubPosts, fetchExplainerArticles, peekArticlesCache} = require('../../src/api/client');
const {getReadIds: getExplainerReadIds} = require('../../src/utils/explainerRead');
const {useFocusEffect} = require('@react-navigation/native');
const nav = makeNav();

beforeEach(() => {
  // Clear call history between tests so navigate assertions don't bleed across
  jest.clearAllMocks();
  fetchArticles.mockResolvedValue(MOCK_ARTICLES);
  fetchHubPosts.mockResolvedValue([]);
  fetchExplainerArticles.mockResolvedValue([]);
  peekArticlesCache.mockResolvedValue(null); // cold start by default
});

function renderNews({articles = MOCK_ARTICLES, favourites = [], explainerArticles = []} = {}) {
  AsyncStorage.getItem.mockImplementation((key) => {
    if (key === 'favourite_drivers') return Promise.resolve(JSON.stringify(favourites));
    return Promise.resolve(null);
  });
  fetchArticles.mockResolvedValue(articles);
  fetchHubPosts.mockResolvedValue([]);
  fetchExplainerArticles.mockResolvedValue(explainerArticles);
  return renderWithProviders(<NewsScreen navigation={nav} />);
}

describe('NewsScreen', () => {
  describe('loading', () => {
    it('shows a loading indicator on cold start (no cache) before articles arrive', () => {
      peekArticlesCache.mockResolvedValue(null); // no stale cache
      fetchArticles.mockImplementation(() => new Promise(() => {}));
      fetchHubPosts.mockResolvedValue([]);
      const {UNSAFE_queryByType} = renderWithProviders(<NewsScreen navigation={nav} />);
      const {ActivityIndicator} = require('react-native');
      expect(UNSAFE_queryByType(ActivityIndicator)).toBeTruthy();
    });

    it('shows stale articles immediately without a spinner when cache exists', async () => {
      const staleArticles = [MOCK_ARTICLES[0]];
      peekArticlesCache.mockResolvedValue(staleArticles);
      // Phase 2 network fetch is slow — hangs indefinitely
      fetchArticles.mockImplementation(() => new Promise(() => {}));
      fetchHubPosts.mockResolvedValue([]);

      const {getByText, UNSAFE_queryByType} = renderWithProviders(<NewsScreen navigation={nav} />);

      // Stale article title appears without waiting for network
      await waitFor(() => expect(getByText(staleArticles[0].title)).toBeTruthy());
      // Spinner should be gone since stale data is showing
      const {ActivityIndicator} = require('react-native');
      expect(UNSAFE_queryByType(ActivityIndicator)).toBeNull();
    });

    it('replaces stale articles with fresh ones when network responds', async () => {
      const staleArticles = [{...MOCK_ARTICLES[0], title: 'Old headline'}];
      const freshArticles = [{...MOCK_ARTICLES[0], title: 'Fresh headline'}];
      peekArticlesCache.mockResolvedValue(staleArticles);
      fetchArticles.mockResolvedValue(freshArticles);
      fetchHubPosts.mockResolvedValue([]);

      const {findByText, queryByText} = renderWithProviders(<NewsScreen navigation={nav} />);

      // Stale appears first, then fresh replaces it
      await findByText('Fresh headline');
      expect(queryByText('Old headline')).toBeNull();
    });

    it('keeps stale articles visible when the network request fails', async () => {
      const staleArticles = [MOCK_ARTICLES[0]];
      peekArticlesCache.mockResolvedValue(staleArticles);
      fetchArticles.mockRejectedValue(new Error('Network error'));
      fetchHubPosts.mockResolvedValue([]);

      const {getByText, queryByText} = renderWithProviders(<NewsScreen navigation={nav} />);

      await waitFor(() => expect(getByText(staleArticles[0].title)).toBeTruthy());
      // Error screen must not replace stale content
      expect(queryByText('Retry')).toBeNull();
    });

    it('pull-to-refresh skips stale cache and shows the refresh indicator', async () => {
      const staleArticles = [MOCK_ARTICLES[0]];
      peekArticlesCache.mockResolvedValue(staleArticles);
      fetchArticles.mockResolvedValue(MOCK_ARTICLES);
      fetchHubPosts.mockResolvedValue([]);

      const {getByLabelText, getByText} = renderWithProviders(<NewsScreen navigation={nav} />);

      // Wait for stale phase to complete
      await waitFor(() => expect(getByText(staleArticles[0].title)).toBeTruthy());

      await act(async () => {
        fireEvent.press(getByLabelText('Refresh news'));
      });

      // peekArticlesCache should only have been called once (initial load), not during refresh
      expect(peekArticlesCache).toHaveBeenCalledTimes(1);
    });
  });

  describe('article rendering', () => {
    it('renders the hero article title', async () => {
      const {getByText} = renderNews();
      await waitFor(() => {
        expect(getByText('Ingram wins Race 1 at Donington')).toBeTruthy();
      });
    });

    it('renders MORE STORIES header when there are more than 3 articles', async () => {
      const {getByText} = renderNews();
      await waitFor(() => {
        expect(getByText('MORE STORIES')).toBeTruthy();
      });
    });

    it('renders BTCC.NET source badge', async () => {
      const {getAllByText} = renderNews();
      await waitFor(() => {
        expect(getAllByText('BTCC.NET').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('renders publication dates', async () => {
      const {getByText} = renderNews();
      await waitFor(() => {
        expect(getByText('19 Apr 2026')).toBeTruthy();
      });
    });

    it('pressing an article calls navigate to Article screen', async () => {
      const {getByText} = renderNews();
      await waitFor(() => getByText('Shedden claims pole position'));
      await act(async () => {
        fireEvent.press(getByText('Shedden claims pole position'));
      });
      expect(nav.navigate).toHaveBeenCalledWith('Article', expect.objectContaining({
        article: expect.objectContaining({title: 'Shedden claims pole position'}),
      }));
    });
  });

  describe('error state', () => {
    it('shows Retry button when fetch fails', async () => {
      fetchArticles.mockRejectedValue(new Error('Network error'));
      fetchHubPosts.mockResolvedValue([]);
      const {getByText} = renderWithProviders(<NewsScreen navigation={nav} />);
      await waitFor(() => {
        expect(getByText('Retry')).toBeTruthy();
      });
    });

    // Regression coverage: found live 2026-09-03 debugging a user report of
    // a broken-looking News tab on slow wifi. fetchArticlesPage used to
    // silently swallow a genuine network failure into an empty array
    // (client.test.js covers that half of the fix) - the consequence here
    // was that a real articles failure, while fetchHubPosts (a separate,
    // independently-cached call) succeeded, left the screen rendering only
    // the Flying Lap banner above a permanently blank feed: no error, no
    // Retry button, nothing to explain it. Confirms the fix's other half -
    // NewsScreen must still show the error screen even when hub posts (and
    // therefore the digest banner) loaded fine.
    it('shows Retry button, not a bannerRow-only broken screen, when articles fail but hub posts succeed', async () => {
      fetchArticles.mockRejectedValue(new Error('Network request failed'));
      fetchHubPosts.mockResolvedValue([
        {id: 'digest-1', title: 'Donington Park Race Weekend Digest', category: 'Weekly Digest', pubDate: '20 Apr 2026', sortDate: '2026-04-20', orderDate: '2026-04-20'},
      ]);
      const {getByText, queryByLabelText} = renderWithProviders(<NewsScreen navigation={nav} />);
      await waitFor(() => {
        expect(getByText('Retry')).toBeTruthy();
      });
      // The digest banner must not stand in for the missing feed
      expect(queryByLabelText('View The Flying Lap')).toBeNull();
    });
  });

  describe('favourite driver highlighting', () => {
    it('hero article mentioning favourite gets yellow left border', async () => {
      const {getByLabelText} = renderNews({favourites: ['Tom Ingram']});
      await waitFor(() => getByLabelText('Featured article: Ingram wins Race 1 at Donington'));
      expect(getByLabelText('Featured article: Ingram wins Race 1 at Donington'))
        .toHaveStyle({borderLeftColor: '#FEBD02'});
    });

    it('hero article not mentioning favourite has no yellow border', async () => {
      const noFavArticles = [
        {id: 1, title: 'Turkington battles through the field', pubDate: '19 Apr 2026', imageUrl: null, source: 'btcc.net', category: 'LATEST NEWS', sortDate: '2026-04-19'},
        {id: 2, title: 'Other story',  pubDate: '18 Apr 2026', imageUrl: null, source: 'btcc.net', category: 'LATEST NEWS', sortDate: '2026-04-18'},
        {id: 3, title: 'Another one',  pubDate: '17 Apr 2026', imageUrl: null, source: 'btcc.net', category: 'LATEST NEWS', sortDate: '2026-04-17'},
      ];
      const {getByLabelText} = renderNews({articles: noFavArticles, favourites: ['Tom Ingram']});
      await waitFor(() => getByLabelText('Featured article: Turkington battles through the field'));
      expect(getByLabelText('Featured article: Turkington battles through the field'))
        .not.toHaveStyle({borderLeftColor: '#febd02'});
    });

    it('no articles highlighted when no favourite set', async () => {
      const {getByLabelText} = renderNews({favourites: []});
      await waitFor(() => getByLabelText('Featured article: Ingram wins Race 1 at Donington'));
      expect(getByLabelText('Featured article: Ingram wins Race 1 at Donington'))
        .not.toHaveStyle({borderLeftColor: '#febd02'});
    });
  });

  describe('digest banner', () => {
    it('digest articles do not appear in the main feed', async () => {
      const {getByText, queryByText} = renderNews({articles: MOCK_ARTICLES_WITH_DIGEST});
      await waitFor(() => getByText('Ingram wins Race 1 at Donington'));
      expect(queryByText('Donington Park Race Weekend Digest')).toBeNull();
    });

    it('shows digest banner when digests are present', async () => {
      const {getByLabelText} = renderNews({articles: MOCK_ARTICLES_WITH_DIGEST});
      await waitFor(() => getByLabelText('View The Flying Lap'));
      expect(getByLabelText('View The Flying Lap')).toBeTruthy();
    });

    it('no digest banner when no digests in feed', async () => {
      const {getByText, queryByLabelText} = renderNews({articles: MOCK_ARTICLES});
      await waitFor(() => getByText('Ingram wins Race 1 at Donington'));
      expect(queryByLabelText('View The Flying Lap')).toBeNull();
    });

    it('tapping digest banner navigates to Digests', async () => {
      const {getByLabelText} = renderNews({articles: MOCK_ARTICLES_WITH_DIGEST});
      await waitFor(() => getByLabelText('View The Flying Lap'));
      await act(async () => {
        fireEvent.press(getByLabelText('View The Flying Lap'));
      });
      expect(nav.navigate).toHaveBeenCalledWith('Digests');
    });
  });

  describe('explainer teaser', () => {
    // Gated on fetchExplainerArticles() actually returning something - the
    // teaser (and the section it links to) must stay invisible until an
    // admin has published at least one explainer article, per the
    // "half the width of the Flying Lap, but only once the first one exists"
    // requirement this was built to.
    it('no explainer teaser when there are no published explainer articles yet', async () => {
      const {getByText, queryByLabelText} = renderNews({articles: MOCK_ARTICLES, explainerArticles: []});
      await waitFor(() => getByText('Ingram wins Race 1 at Donington'));
      expect(queryByLabelText('View Academy articles')).toBeNull();
    });

    it('shows the explainer teaser once at least one explainer article exists', async () => {
      const {getByLabelText} = renderNews({
        articles: MOCK_ARTICLES,
        explainerArticles: [{id: 'explainer-ttb-toca-turbo-boost', title: 'TTB explained'}],
      });
      await waitFor(() => getByLabelText('View Academy articles'));
      expect(getByLabelText('View Academy articles')).toBeTruthy();
    });

    it('tapping the explainer teaser navigates to ExplainerList, not the real News feed', async () => {
      const {getByLabelText} = renderNews({
        articles: MOCK_ARTICLES,
        explainerArticles: [{id: 'explainer-ttb-toca-turbo-boost', title: 'TTB explained'}],
      });
      await waitFor(() => getByLabelText('View Academy articles'));
      await act(async () => {
        fireEvent.press(getByLabelText('View Academy articles'));
      });
      expect(nav.navigate).toHaveBeenCalledWith('ExplainerList');
    });

    it('shows both Flying Lap and Academy teasers together when both have content', async () => {
      const {getByLabelText} = renderNews({
        articles: MOCK_ARTICLES_WITH_DIGEST,
        explainerArticles: [{id: 'explainer-ttb-toca-turbo-boost', title: 'TTB explained'}],
      });
      await waitFor(() => getByLabelText('View The Flying Lap'));
      expect(getByLabelText('View The Flying Lap')).toBeTruthy();
      expect(getByLabelText('View Academy articles')).toBeTruthy();
    });

    // Regression coverage: found 2026-09-03 - the teaser had its own
    // read/unread infrastructure available (explainerRead.js, ported from
    // digestRead.js the same day ExplainerListScreen got its read/unread
    // UI) but the tile itself was never wired up to it, so it always
    // rendered in the plain "read" grey style regardless of unread count -
    // unlike DigestBanner, which turns yellow. useFocusEffect is a bare
    // no-op mock at the top of this file, so these two tests locally
    // override it to actually invoke its callback (the only way to
    // exercise explainerReadIds/digestReadIds at all in this file).
    it('turns yellow and shows an unread count when explainer articles are unread', async () => {
      useFocusEffect.mockImplementationOnce(cb => cb());
      getExplainerReadIds.mockResolvedValueOnce(new Set());
      const {getByLabelText, getByText} = renderNews({
        articles: MOCK_ARTICLES,
        explainerArticles: [{id: 'explainer-ttb-toca-turbo-boost', title: 'TTB explained'}],
      });
      await waitFor(() => getByText('1 unread'));
      expect(getByLabelText('View Academy articles')).toHaveStyle({backgroundColor: '#FEBD02'});
    });

    it('stays grey and shows the article count once all explainer articles are read', async () => {
      useFocusEffect.mockImplementationOnce(cb => cb());
      getExplainerReadIds.mockResolvedValueOnce(new Set(['explainer-ttb-toca-turbo-boost']));
      const {getByLabelText, getByText} = renderNews({
        articles: MOCK_ARTICLES,
        explainerArticles: [{id: 'explainer-ttb-toca-turbo-boost', title: 'TTB explained'}],
      });
      await waitFor(() => getByText('1 article'));
      expect(getByLabelText('View Academy articles')).not.toHaveStyle({backgroundColor: '#FEBD02'});
    });
  });

  describe('inactivity banner', () => {
    const NOW = 1_700_000_000_000;
    const ELEVEN_DAYS_AGO = NOW - 11 * 24 * 60 * 60 * 1000;

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(NOW);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    function renderNewsWithLastOpen(lastOpenTs) {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'favourite_drivers') return Promise.resolve(JSON.stringify([]));
        if (key === 'last_open_ts') return Promise.resolve(lastOpenTs == null ? null : String(lastOpenTs));
        return Promise.resolve(null);
      });
      fetchArticles.mockResolvedValue(MOCK_ARTICLES);
      fetchHubPosts.mockResolvedValue([]);
      return renderWithProviders(<NewsScreen navigation={nav} />);
    }

    it('does not show the banner on a first-ever launch (no prior stamp)', async () => {
      const {logEvent} = require('@react-native-firebase/analytics');
      const {getByText, queryByText} = renderNewsWithLastOpen(null);
      await waitFor(() => getByText('Ingram wins Race 1 at Donington'));
      expect(queryByText(/Welcome back/)).toBeNull();
      expect(logEvent).not.toHaveBeenCalledWith(expect.anything(), 'inactivity_banner_shown');
    });

    it('shows a "welcome back" banner after 10+ days of inactivity', async () => {
      const {logEvent} = require('@react-native-firebase/analytics');
      const {getByText} = renderNewsWithLastOpen(ELEVEN_DAYS_AGO);
      await waitFor(() => expect(getByText(/Welcome back/)).toBeTruthy());
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'inactivity_banner_shown');
    });

    it('dismissing the banner action navigates to Results and hides the banner', async () => {
      const {logEvent} = require('@react-native-firebase/analytics');
      const {getByText, getByLabelText, queryByText} = renderNewsWithLastOpen(ELEVEN_DAYS_AGO);
      await waitFor(() => getByText(/Welcome back/));
      fireEvent.press(getByLabelText('Season'));
      expect(nav.navigate).toHaveBeenCalledWith('Results');
      expect(queryByText(/Welcome back/)).toBeNull();
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'nav_item_clicked', {label: 'inactivity_banner_action'});
    });

    it('dismissing the banner without acting on it tracks the dismiss action', async () => {
      const {logEvent} = require('@react-native-firebase/analytics');
      const {getByText, getByLabelText, queryByText} = renderNewsWithLastOpen(ELEVEN_DAYS_AGO);
      await waitFor(() => getByText(/Welcome back/));
      fireEvent.press(getByLabelText('Dismiss'));
      expect(queryByText(/Welcome back/)).toBeNull();
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'nav_item_clicked', {label: 'inactivity_banner_dismiss'});
    });
  });

  describe('pagination', () => {
    // Flattens the FlatList's transformed `data` prop (hero/grid/compact groups)
    // back into a plain, display-order list of article titles.
    function titlesInDisplayOrder(data) {
      const titles = [];
      data.forEach(item => {
        if (item.type === 'hero') titles.push(item.article.title);
        else if (item.type === 'grid') item.articles.forEach(a => titles.push(a.title));
        else if (item.type === 'compact') titles.push(item.article.title);
      });
      return titles;
    }

    it('hides a hub post older than every loaded article instead of letting it jump the queue', async () => {
      // Page 1 (20 articles, newest first) - a full page, so hasMore stays true.
      const page1 = Array.from({length: 20}, (_, i) => {
        const day = String(20 - i).padStart(2, '0');
        return {
          id: `p1-${i}`, title: `Page1 Article ${i}`, imageUrl: null,
          source: 'btcc.net', category: 'LATEST NEWS',
          pubDate: `${20 - i} Jul 2026`, sortDate: `2026-07-${day}`,
        };
      });
      // Older than every page-1 article, and articles are still loading (hasMore
      // true) - must NOT appear yet, since nothing has actually reached this date.
      const hubPost = {
        id: 'hub-1', title: 'A Day in the Paddock', imageUrl: null,
        source: 'BTCC Hub', category: 'Paddock',
        pubDate: '13 Apr 2026', sortDate: '2026-04-13',
      };
      fetchHubPosts.mockResolvedValue([hubPost]);
      fetchArticles.mockResolvedValue(page1);

      const {getByTestId} = renderWithProviders(<NewsScreen navigation={nav} />);
      await waitFor(() => {
        expect(titlesInDisplayOrder(getByTestId('news-flatlist').props.data))
          .toContain('Page1 Article 0');
      });
      // FlatList virtualizes rendering, so absence in the text tree alone
      // wouldn't prove anything - assert against the underlying `data` prop.
      expect(titlesInDisplayOrder(getByTestId('news-flatlist').props.data))
        .not.toContain('A Day in the Paddock');
    });

    it('reveals a hub post once a loaded article actually reaches its date', async () => {
      const page1 = Array.from({length: 20}, (_, i) => {
        const day = String(20 - i).padStart(2, '0');
        return {
          id: `p1-${i}`, title: `Page1 Article ${i}`, imageUrl: null,
          source: 'btcc.net', category: 'LATEST NEWS',
          pubDate: `${20 - i} Jul 2026`, sortDate: `2026-07-${day}`,
        };
      });
      const hubPost = {
        id: 'hub-1', title: 'A Day in the Paddock', imageUrl: null,
        source: 'BTCC Hub', category: 'Paddock',
        pubDate: '13 Apr 2026', sortDate: '2026-04-13',
      };
      // A full 20-article page older than the hub post - hasMore stays true
      // throughout, so this must be the hub post's date being reached that
      // reveals it, not the archive running out.
      const page2 = Array.from({length: 20}, (_, i) => ({
        id: `p2-${i}`, title: `Page2 Article ${i}`, imageUrl: null,
        source: 'btcc.net', category: 'LATEST NEWS',
        pubDate: `${20 - i} Mar 2026`, sortDate: `2026-03-${String(20 - i).padStart(2, '0')}`,
      }));

      fetchHubPosts.mockResolvedValue([hubPost]);
      fetchArticles
        .mockImplementationOnce(() => Promise.resolve(page1))
        .mockImplementationOnce(() => Promise.resolve(page2));

      const {getByTestId} = renderWithProviders(<NewsScreen navigation={nav} />);
      await waitFor(() => {
        expect(titlesInDisplayOrder(getByTestId('news-flatlist').props.data))
          .toContain('Page1 Article 0');
      });
      expect(titlesInDisplayOrder(getByTestId('news-flatlist').props.data))
        .not.toContain('A Day in the Paddock');

      await act(async () => {
        fireEvent(getByTestId('news-flatlist'), 'onEndReached');
      });

      await waitFor(() => {
        expect(titlesInDisplayOrder(getByTestId('news-flatlist').props.data))
          .toContain('A Day in the Paddock');
      });
      // The hub post (13 Apr) is newer than every page-2 article (all March),
      // so it must land before them once revealed, not appended after.
      const titles = titlesInDisplayOrder(getByTestId('news-flatlist').props.data);
      const hubIndex = titles.indexOf('A Day in the Paddock');
      const page2Index = titles.indexOf('Page2 Article 0');
      expect(hubIndex).toBeLessThan(page2Index);
    });

    it('keeps a hub post hidden even once article pagination is exhausted - the mirror running dry is not proof there\'s nothing older on the real site', async () => {
      const page1 = Array.from({length: 20}, (_, i) => {
        const day = String(20 - i).padStart(2, '0');
        return {
          id: `p1-${i}`, title: `Page1 Article ${i}`, imageUrl: null,
          source: 'btcc.net', category: 'LATEST NEWS',
          pubDate: `${20 - i} Jul 2026`, sortDate: `2026-07-${day}`,
        };
      });
      // Older than every loaded article. Page 2 returns fewer than 20, so
      // hasMore becomes false - but that only means our mirror stopped
      // backfilling here, not that btcc.net has nothing between this date
      // and 30 Jun, so it must stay hidden rather than flood in at the tail.
      const hubPost = {
        id: 'hub-1', title: 'A Day in the Paddock', imageUrl: null,
        source: 'BTCC Hub', category: 'Paddock',
        pubDate: '13 Apr 2026', sortDate: '2026-04-13',
      };
      const page2 = [{
        id: 'p2-0', title: 'Last Article', imageUrl: null,
        source: 'btcc.net', category: 'LATEST NEWS',
        pubDate: '30 Jun 2026', sortDate: '2026-06-30',
      }];

      fetchHubPosts.mockResolvedValue([hubPost]);
      fetchArticles
        .mockImplementationOnce(() => Promise.resolve(page1))
        .mockImplementationOnce(() => Promise.resolve(page2));

      const {getByTestId} = renderWithProviders(<NewsScreen navigation={nav} />);
      await waitFor(() => {
        expect(titlesInDisplayOrder(getByTestId('news-flatlist').props.data))
          .toContain('Page1 Article 0');
      });

      await act(async () => {
        fireEvent(getByTestId('news-flatlist'), 'onEndReached');
      });

      await waitFor(() => {
        expect(titlesInDisplayOrder(getByTestId('news-flatlist').props.data))
          .toContain('Last Article');
      });
      expect(titlesInDisplayOrder(getByTestId('news-flatlist').props.data))
        .not.toContain('A Day in the Paddock');
    });

    it('does not let a same-day hub post outrank a mirror article seen later that day', async () => {
      // Regression test for 2026-08-24: btcc.net's `date` field has no
      // time-of-day, so two mirror articles published the same calendar day
      // used to tie on sortDate. A hub post's pubDate DOES carry real
      // time-of-day, so any hub post published that same day - no matter how
      // early - always won the tie and jumped the hero slot ahead of mirror
      // articles actually seen (orderDate/firstSeenAt) hours later.
      const earlierMirror = {
        id: 'p1-0', title: 'Morgan converts pole to emphatic win', imageUrl: null,
        source: 'btcc.net', category: 'LATEST NEWS',
        pubDate: '23 Aug 2026', sortDate: '2026-08-23', orderDate: '2026-08-23T13:33:07Z',
      };
      const laterMirror = {
        id: 'p1-1', title: 'Cammish heads the chasing pack', imageUrl: null,
        source: 'btcc.net', category: 'LATEST NEWS',
        pubDate: '23 Aug 2026', sortDate: '2026-08-23', orderDate: '2026-08-23T20:16:22Z',
      };
      const hubPost = {
        id: 'hub-1', title: 'Jason Plato issues first statement', imageUrl: null,
        source: 'btcc hub', category: 'News',
        pubDate: '23 Aug 2026', sortDate: '2026-08-23T16:47', orderDate: '2026-08-23T16:47',
      };

      fetchHubPosts.mockResolvedValue([hubPost]);
      fetchArticles.mockResolvedValue([laterMirror, earlierMirror]);

      const {getByTestId} = renderWithProviders(<NewsScreen navigation={nav} />);
      await waitFor(() => {
        expect(titlesInDisplayOrder(getByTestId('news-flatlist').props.data)).toHaveLength(3);
      });
      const titles = titlesInDisplayOrder(getByTestId('news-flatlist').props.data);
      // Seen at 20:16 - genuinely the most recent of the three - must be hero.
      expect(titles[0]).toBe('Cammish heads the chasing pack');
      // Published 16:47, between the other two - must land second, not first.
      expect(titles[1]).toBe('Jason Plato issues first statement');
      expect(titles[2]).toBe('Morgan converts pole to emphatic win');
    });
  });

  describe('search', () => {
    it('search input appears when search icon is pressed', async () => {
      const {getByLabelText, queryByPlaceholderText} = renderNews();
      await waitFor(() => getByLabelText('Search news'));
      expect(queryByPlaceholderText('Search news…')).toBeNull();
      await act(async () => {
        fireEvent.press(getByLabelText('Search news'));
      });
      expect(queryByPlaceholderText('Search news…')).toBeTruthy();
    });

    it('search input closes when close icon is pressed', async () => {
      const {getByLabelText, queryByPlaceholderText} = renderNews();
      await waitFor(() => getByLabelText('Search news'));
      await act(async () => {
        fireEvent.press(getByLabelText('Search news'));
      });
      await act(async () => {
        fireEvent.press(getByLabelText('Close search'));
      });
      expect(queryByPlaceholderText('Search news…')).toBeNull();
    });
  });
});
