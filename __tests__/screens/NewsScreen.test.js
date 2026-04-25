import React from 'react';
import {act, fireEvent, waitFor} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NewsScreen from '../../src/screens/NewsScreen';
import {renderWithProviders, makeNav, MOCK_ARTICLES} from './testUtils';

jest.mock('../../src/api/client', () => ({
  fetchArticles: jest.fn(),
  fetchHubPosts: jest.fn(),
}));
jest.mock('../../src/api/parsers', () => ({
  parseArticle: jest.fn(a => a),
}));

const {fetchArticles, fetchHubPosts} = require('../../src/api/client');
const nav = makeNav();

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
    it('shows a loading indicator before articles arrive', () => {
      fetchArticles.mockImplementation(() => new Promise(() => {}));
      fetchHubPosts.mockResolvedValue([]);
      const {UNSAFE_queryByType} = renderWithProviders(<NewsScreen navigation={nav} />);
      const {ActivityIndicator} = require('react-native');
      expect(UNSAFE_queryByType(ActivityIndicator)).toBeTruthy();
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
      // Use articles where hero doesn't mention the favourite
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
