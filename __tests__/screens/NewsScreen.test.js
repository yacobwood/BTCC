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
  peekArticlesCache: jest.fn(),
}));
jest.mock('../../src/api/parsers', () => ({
  parseArticle: jest.fn(a => a),
}));
jest.mock('../../src/utils/digestRead', () => ({
  getReadIds: jest.fn().mockResolvedValue(new Set()),
}));

const {fetchArticles, fetchHubPosts, peekArticlesCache} = require('../../src/api/client');
const nav = makeNav();

beforeEach(() => {
  // Clear call history between tests so navigate assertions don't bleed across
  jest.clearAllMocks();
  fetchArticles.mockResolvedValue(MOCK_ARTICLES);
  fetchHubPosts.mockResolvedValue([]);
  peekArticlesCache.mockResolvedValue(null); // cold start by default
});

function renderNews({articles = MOCK_ARTICLES, favourites = []} = {}) {
  AsyncStorage.getItem.mockImplementation((key) => {
    if (key === 'favourite_drivers') return Promise.resolve(JSON.stringify(favourites));
    return Promise.resolve(null);
  });
  fetchArticles.mockResolvedValue(articles);
  fetchHubPosts.mockResolvedValue([]);
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
      await waitFor(() => getByLabelText('View BTCC Monday Roundup'));
      expect(getByLabelText('View BTCC Monday Roundup')).toBeTruthy();
    });

    it('no digest banner when no digests in feed', async () => {
      const {getByText, queryByLabelText} = renderNews({articles: MOCK_ARTICLES});
      await waitFor(() => getByText('Ingram wins Race 1 at Donington'));
      expect(queryByLabelText('View BTCC Monday Roundup')).toBeNull();
    });

    it('tapping digest banner navigates to Digests', async () => {
      const {getByLabelText} = renderNews({articles: MOCK_ARTICLES_WITH_DIGEST});
      await waitFor(() => getByLabelText('View BTCC Monday Roundup'));
      await act(async () => {
        fireEvent.press(getByLabelText('View BTCC Monday Roundup'));
      });
      expect(nav.navigate).toHaveBeenCalledWith('Digests');
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

    it('re-sorts hub posts against later pages instead of leaving them stuck at the page-1 boundary', async () => {
      // Page 1 (20 articles, newest first) merges with the hub post once, on initial load.
      const page1 = Array.from({length: 20}, (_, i) => {
        const day = String(20 - i).padStart(2, '0');
        return {
          id: `p1-${i}`, title: `Page1 Article ${i}`, imageUrl: null,
          source: 'btcc.net', category: 'LATEST NEWS',
          pubDate: `${20 - i} Jul 2026`, sortDate: `2026-07-${day}`,
        };
      });
      // Older than every page-1 article, so it correctly sorts to the tail on initial load.
      const hubPost = {
        id: 'hub-1', title: 'A Day in the Paddock', imageUrl: null,
        source: 'BTCC Hub', category: 'Paddock',
        pubDate: '13 Apr 2026', sortDate: '2026-04-13',
      };
      // Page 2 is older than page 1 but newer than the hub post - it must land
      // BEFORE the hub post once appended, not after.
      const page2 = [{
        id: 'p2-0', title: 'Newer Than The Hub Post', imageUrl: null,
        source: 'btcc.net', category: 'LATEST NEWS',
        pubDate: '30 Jun 2026', sortDate: '2026-06-30',
      }];

      fetchHubPosts.mockResolvedValue([hubPost]);
      fetchArticles
        .mockImplementationOnce(() => Promise.resolve(page1))
        .mockImplementationOnce(() => Promise.resolve(page2));

      const {getByTestId} = renderWithProviders(<NewsScreen navigation={nav} />);
      // FlatList virtualizes rendering, so item #21 (the hub post) won't be in the
      // visible text tree - assert against the underlying `data` prop instead.
      await waitFor(() => {
        expect(titlesInDisplayOrder(getByTestId('news-flatlist').props.data))
          .toContain('A Day in the Paddock');
      });

      await act(async () => {
        fireEvent(getByTestId('news-flatlist'), 'onEndReached');
      });
      await waitFor(() => {
        expect(titlesInDisplayOrder(getByTestId('news-flatlist').props.data))
          .toContain('Newer Than The Hub Post');
      });

      const titles = titlesInDisplayOrder(getByTestId('news-flatlist').props.data);
      const hubIndex = titles.indexOf('A Day in the Paddock');
      const page2Index = titles.indexOf('Newer Than The Hub Post');
      expect(page2Index).toBeLessThan(hubIndex);
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
