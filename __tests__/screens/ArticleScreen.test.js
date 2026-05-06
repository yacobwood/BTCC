import React from 'react';
import {act, fireEvent, waitFor} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ArticleScreen from '../../src/screens/ArticleScreen';
import {renderWithProviders, makeNav, makeRoute} from './testUtils';

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('../../src/api/client', () => ({
  fetchArticleBySlug: jest.fn(),
}));

jest.mock('../../src/api/parsers', () => ({
  parseArticle: jest.fn(raw => ({
    title:   raw.title?.rendered || raw.title || 'Test Article',
    content: raw.content?.rendered || raw.content || '<p>Test content</p>',
    link:    raw.link || 'https://www.btcc.net/test-article-slug',
    pubDate: '1 Jan 2026',
    imageUrl: null,
  })),
}));

// WebView mock — supports firing onLoad and onMessage via test IDs.
// `webview-message-likes` fires a 'likes' reaction.
// `webview-message-dislikes` fires a 'dislikes' reaction.
jest.mock('react-native-webview', () => {
  const React = require('react');
  const {View, Text} = require('react-native');
  const WebView = React.forwardRef(({onLoad, onMessage}, ref) => {
    React.useImperativeHandle(ref, () => ({
      injectJavaScript: jest.fn(),
    }));
    const fire = (type, prev = null) =>
      onMessage && onMessage({nativeEvent: {data: JSON.stringify({type, prev})}});
    return (
      <View testID="webview">
        <Text testID="webview-load"             onPress={() => onLoad && onLoad()}>load</Text>
        <Text testID="webview-message-likes"    onPress={() => fire('likes')}>like</Text>
        <Text testID="webview-message-dislikes" onPress={() => fire('dislikes')}>dislike</Text>
        <Text testID="webview-open-comments"    onPress={() => fire('open_comments')}>comments</Text>
      </View>
    );
  });
  WebView.displayName = 'WebView';
  return {WebView};
});

jest.mock('../../src/utils/notifications', () => ({
  getFCMToken: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn(), articleShared: jest.fn()},
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const {fetchArticleBySlug} = require('../../src/api/client');
const {parseArticle} = require('../../src/api/parsers');

const nav = makeNav();

// ─── Comments test data ───────────────────────────────────────────────────────

/** A Firestore runQuery row for a single comment from another author */
function makeCommentRow(overrides = {}) {
  return {
    document: {
      name: 'projects/btcchub-af77a/databases/(default)/documents/article_comments/comment1',
      fields: {
        text:       {stringValue: overrides.text       ?? 'Great race!'},
        authorId:   {stringValue: overrides.authorId   ?? 'other_author_xyz'},
        authorName: {stringValue: overrides.authorName ?? 'BTCC Fan'},
        timestamp:  {stringValue: overrides.timestamp  ?? '2026-04-19T10:00:00Z'},
        flags:      {integerValue: String(overrides.flags ?? 0)},
        hidden:     {booleanValue: overrides.hidden    ?? false},
        parentId:   {nullValue: null},
      },
    },
  };
}

/**
 * Build a fetch mock that routes:
 *  - :runQuery   → commentRows (fetchComments)
 *  - /article_comments POST → postComment response
 *  - everything else → reactions GET response
 */
function makeCommentsFetch(commentRows = []) {
  return jest.fn().mockImplementation((url, options) => {
    const u = typeof url === 'string' ? url : '';
    if (u.includes(':runQuery')) {
      return Promise.resolve({ok: true, json: () => Promise.resolve(commentRows)});
    }
    if (u.includes('article_comments') && options?.method === 'POST') {
      return Promise.resolve({
        ok:   true,
        json: () => Promise.resolve({
          name: 'projects/btcchub-af77a/databases/(default)/documents/article_comments/newDocId',
        }),
      });
    }
    // Default: reactions GET
    return Promise.resolve({
      ok:   true,
      json: () => Promise.resolve({fields: {likes: {integerValue: '0'}, dislikes: {integerValue: '0'}}}),
    });
  });
}

/** Article with full content — simulates coming from NewsFeed list */
const FULL_ARTICLE = {
  title:   'Ingram wins at Donington',
  content: '<p>Tom Ingram took a comfortable win...</p>',
  link:    'https://www.btcc.net/news/ingram-wins-donington/',
  pubDate: '19 Apr 2026',
  imageUrl: null,
};

/** Article stub without content — simulates deep-link / notification tap */
const STUB_ARTICLE = {
  title:   'Ingram wins at Donington',
  link:    'https://www.btcc.net/news/ingram-wins-donington/',
  pubDate: '19 Apr 2026',
  imageUrl: null,
  // intentionally no `content` field
};

const RAW_WP_ARTICLE = {
  title:   {rendered: 'Fetched Title'},
  content: {rendered: '<p>fetched body</p>'},
  link:    'https://www.btcc.net/news/ingram-wins-donington/',
};

function renderArticle(params = {}) {
  AsyncStorage.getItem.mockResolvedValue(null);
  const route = makeRoute({article: FULL_ARTICLE, slug: undefined, ...params});
  return renderWithProviders(<ArticleScreen route={route} navigation={nav} />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ArticleScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default fetch: succeed for Firestore reactions GET, succeed for commit POST
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({fields: {likes: {integerValue: '0'}, dislikes: {integerValue: '0'}}}),
    });
  });

  // ── Loading state ───────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('shows ActivityIndicator while article is being fetched by slug', () => {
      fetchArticleBySlug.mockImplementation(() => new Promise(() => {}));

      const {UNSAFE_queryByType} = renderArticle({
        article: STUB_ARTICLE,
        slug:    undefined,
      });

      const {ActivityIndicator} = require('react-native');
      expect(UNSAFE_queryByType(ActivityIndicator)).toBeTruthy();
    });

    it('shows ActivityIndicator when only a slug param is provided', () => {
      fetchArticleBySlug.mockImplementation(() => new Promise(() => {}));

      const {UNSAFE_queryByType} = renderArticle({
        article: undefined,
        slug:    'ingram-wins-donington',
      });

      const {ActivityIndicator} = require('react-native');
      expect(UNSAFE_queryByType(ActivityIndicator)).toBeTruthy();
    });
  });

  // ── Slug-based fetch ────────────────────────────────────────────────────────

  describe('slug-based article fetch', () => {
    it('calls fetchArticleBySlug when article has no content', async () => {
      fetchArticleBySlug.mockResolvedValue(RAW_WP_ARTICLE);

      renderArticle({article: STUB_ARTICLE, slug: undefined});

      // Slug extracted from STUB_ARTICLE.link → 'ingram-wins-donington'
      await waitFor(() => {
        expect(fetchArticleBySlug).toHaveBeenCalledWith('ingram-wins-donington');
      });
    });

    it('calls fetchArticleBySlug with explicit slug param', async () => {
      fetchArticleBySlug.mockResolvedValue(RAW_WP_ARTICLE);

      renderArticle({article: undefined, slug: 'my-slug'});

      await waitFor(() => {
        expect(fetchArticleBySlug).toHaveBeenCalledWith('my-slug');
      });
    });

    it('does NOT call fetchArticleBySlug when article has content', async () => {
      renderArticle({article: FULL_ARTICLE});

      // Give async effects a chance to fire
      await waitFor(() => {
        expect(fetchArticleBySlug).not.toHaveBeenCalled();
      });
    });

    it('passes raw API response through parseArticle', async () => {
      fetchArticleBySlug.mockResolvedValue(RAW_WP_ARTICLE);

      renderArticle({article: STUB_ARTICLE, slug: undefined});

      await waitFor(() => {
        expect(parseArticle).toHaveBeenCalledWith(RAW_WP_ARTICLE);
      });
    });

    it('shows the WebView once the slug-fetched article resolves', async () => {
      fetchArticleBySlug.mockResolvedValue(RAW_WP_ARTICLE);

      const {getByTestId} = renderArticle({article: STUB_ARTICLE, slug: undefined});

      await waitFor(() => {
        expect(getByTestId('webview')).toBeTruthy();
      });
    });
  });

  // ── Reactions — Firestore URL regression ────────────────────────────────────
  // Regression: PROJECT_ID was undefined after the firebase.js refactor, so the
  // Firestore document path became 'projects/undefined/...' and silently failed.

  describe('submitReaction — Firestore URL', () => {
    it('uses the correct project ID (btcchub-af77a) in the commit URL', async () => {
      const {getByTestId} = renderArticle();

      await act(async () => {
        getByTestId('webview-message-likes').props.onPress();
      });

      await waitFor(() => {
        const commitCall = global.fetch.mock.calls.find(
          ([url]) => typeof url === 'string' && url.includes(':commit'),
        );
        expect(commitCall).toBeTruthy();
        const body = JSON.parse(commitCall[1].body);
        const docPath = body.writes[0].transform.document;
        expect(docPath).not.toContain('undefined');
        expect(docPath).toContain('btcchub-af77a');
        expect(docPath).toContain('article_reactions');
      });
    });

    it('sends a like increment (+1) for a likes reaction', async () => {
      const {getByTestId} = renderArticle();

      await act(async () => {
        getByTestId('webview-message-likes').props.onPress();
      });

      await waitFor(() => {
        const commitCall = global.fetch.mock.calls.find(
          ([url]) => typeof url === 'string' && url.includes(':commit'),
        );
        expect(commitCall).toBeTruthy();
        const body = JSON.parse(commitCall[1].body);
        const transform = body.writes[0].transform.fieldTransforms[0];
        expect(transform.fieldPath).toBe('likes');
        expect(transform.increment.integerValue).toBe('1');
      });
    });

    it('sends a dislike increment (+1) for a dislikes reaction', async () => {
      const {getByTestId} = renderArticle();

      await act(async () => {
        getByTestId('webview-message-dislikes').props.onPress();
      });

      await waitFor(() => {
        const commitCall = global.fetch.mock.calls.find(
          ([url]) => typeof url === 'string' && url.includes(':commit'),
        );
        expect(commitCall).toBeTruthy();
        const body = JSON.parse(commitCall[1].body);
        const transform = body.writes[0].transform.fieldTransforms[0];
        expect(transform.fieldPath).toBe('dislikes');
        expect(transform.increment.integerValue).toBe('1');
      });
    });

    it('uses the :commit endpoint with POST for reactions', async () => {
      const {getByTestId} = renderArticle();

      await act(async () => {
        getByTestId('webview-message-likes').props.onPress();
      });

      await waitFor(() => {
        const commitCall = global.fetch.mock.calls.find(
          ([url]) => typeof url === 'string' && url.includes(':commit?key='),
        );
        expect(commitCall).toBeTruthy();
        expect(commitCall[1].method).toBe('POST');
      });
    });
  });

  // ── Reactions persistence (AsyncStorage) ────────────────────────────────────

  describe('reaction persistence', () => {
    it('reads from AsyncStorage before submitting reaction', async () => {
      const {getByTestId} = renderArticle();

      await act(async () => {
        getByTestId('webview-message-likes').props.onPress();
      });

      await waitFor(() => {
        expect(AsyncStorage.getItem).toHaveBeenCalledWith('article_reactions_v1');
      });
    });

    it('writes updated reaction to AsyncStorage', async () => {
      const {getByTestId} = renderArticle();

      await act(async () => {
        getByTestId('webview-message-likes').props.onPress();
      });

      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          'article_reactions_v1',
          expect.stringContaining('likes'),
        );
      });
    });

    it('stores reaction keyed by article slug', async () => {
      const {getByTestId} = renderArticle({article: FULL_ARTICLE, slug: undefined});

      await act(async () => {
        getByTestId('webview-message-likes').props.onPress();
      });

      await waitFor(() => {
        const setItemCall = AsyncStorage.setItem.mock.calls.find(
          ([key]) => key === 'article_reactions_v1',
        );
        expect(setItemCall).toBeTruthy();
        const stored = JSON.parse(setItemCall[1]);
        // FULL_ARTICLE.link → slug 'ingram-wins-donington'
        expect(stored['ingram-wins-donington']).toBe('likes');
      });
    });
  });
});

// ─── CommentsSheet ────────────────────────────────────────────────────────────

describe('CommentsSheet', () => {
  /**
   * Trigger onWebViewLoad then open the CommentsSheet.
   * Configures AsyncStorage so commenterName is available (or null for name-prompt tests).
   */
  async function openComments(getByTestId, {commentRows = [], storedName = 'Test Fan'} = {}) {
    global.fetch = makeCommentsFetch(commentRows);

    AsyncStorage.getItem.mockImplementation(key => {
      if (key === 'commenter_name') return Promise.resolve(storedName);
      return Promise.resolve(null);
    });

    // Trigger onWebViewLoad — fetches reactions + comments
    await act(async () => {
      getByTestId('webview-load').props.onPress();
    });

    // Open the sheet
    await act(async () => {
      getByTestId('webview-open-comments').props.onPress();
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = makeCommentsFetch();
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  // ── Sheet visibility ────────────────────────────────────────────────────────

  it('opens when WebView sends open_comments message', async () => {
    const {getByTestId, getByPlaceholderText} = renderArticle();

    await openComments(getByTestId);

    await waitFor(() => {
      expect(getByPlaceholderText('Add a comment...')).toBeTruthy();
    });
  });

  // ── Loading / empty states ──────────────────────────────────────────────────

  it('shows loading indicator in sheet before onWebViewLoad fires', async () => {
    const {getByTestId, UNSAFE_queryAllByType} = renderArticle();

    // Open sheet WITHOUT triggering onWebViewLoad — comments stays null
    await act(async () => {
      getByTestId('webview-open-comments').props.onPress();
    });

    const {ActivityIndicator} = require('react-native');
    await waitFor(() => {
      // The sheet's own ActivityIndicator (comments === null state)
      expect(UNSAFE_queryAllByType(ActivityIndicator).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows empty state when no comments are returned', async () => {
    const {getByTestId, getByText} = renderArticle();

    await openComments(getByTestId, {commentRows: []});

    await waitFor(() => {
      expect(getByText('No comments yet. Be the first!')).toBeTruthy();
    });
  });

  it('renders fetched comment text', async () => {
    const {getByTestId, getByText} = renderArticle();

    await openComments(getByTestId, {commentRows: [makeCommentRow({text: 'Great race!'})]});

    await waitFor(() => {
      expect(getByText('Great race!')).toBeTruthy();
    });
  });

  it('renders comment author name', async () => {
    const {getByTestId, getByText} = renderArticle();

    await openComments(getByTestId, {commentRows: [makeCommentRow({authorName: 'BTCC Fan'})]});

    await waitFor(() => {
      expect(getByText('BTCC Fan')).toBeTruthy();
    });
  });

  // ── Input validation ────────────────────────────────────────────────────────

  it('shows error when comment exceeds 500 characters', async () => {
    const {getByTestId, getByPlaceholderText, getByLabelText, getByText} = renderArticle();
    await openComments(getByTestId);

    const input = await waitFor(() => getByPlaceholderText('Add a comment...'));
    fireEvent.changeText(input, 'a'.repeat(501));
    fireEvent.press(getByLabelText('Send comment'));

    await waitFor(() => {
      expect(getByText('Comment too long (max 500 characters)')).toBeTruthy();
    });
  });

  it('shows error when comment contains profanity', async () => {
    const {getByTestId, getByPlaceholderText, getByLabelText, getByText} = renderArticle();
    await openComments(getByTestId);

    const input = await waitFor(() => getByPlaceholderText('Add a comment...'));
    fireEvent.changeText(input, 'What a shit race');
    fireEvent.press(getByLabelText('Send comment'));

    await waitFor(() => {
      expect(getByText('Comment contains disallowed content')).toBeTruthy();
    });
  });

  // ── Posting comments ────────────────────────────────────────────────────────

  it('adds optimistic comment immediately on send (before Firestore responds)', async () => {
    // Delay the postComment response so we can assert the optimistic entry first
    global.fetch = jest.fn().mockImplementation((url, options) => {
      const u = typeof url === 'string' ? url : '';
      if (u.includes(':runQuery')) {
        return Promise.resolve({ok: true, json: () => Promise.resolve([])});
      }
      if (u.includes('article_comments') && options?.method === 'POST') {
        // Slow response — optimistic entry should appear before this resolves
        return new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({name: '.../newDocId'}),
          }), 200),
        );
      }
      return Promise.resolve({ok: true, json: () => Promise.resolve({fields: {likes: {integerValue: '0'}, dislikes: {integerValue: '0'}}})});
    });

    const {getByTestId, getByPlaceholderText, getByLabelText, getByText} = renderArticle();
    await openComments(getByTestId, {commentRows: []});

    const input = await waitFor(() => getByPlaceholderText('Add a comment...'));
    fireEvent.changeText(input, 'Looking good!');
    fireEvent.press(getByLabelText('Send comment'));

    await waitFor(() => {
      expect(getByText('Looking good!')).toBeTruthy();
    });
  });

  it('calls the Firestore article_comments endpoint on send', async () => {
    const {getByTestId, getByPlaceholderText, getByLabelText} = renderArticle();
    await openComments(getByTestId);

    const input = await waitFor(() => getByPlaceholderText('Add a comment...'));
    fireEvent.changeText(input, 'Nice one!');
    fireEvent.press(getByLabelText('Send comment'));

    await waitFor(() => {
      const postCall = global.fetch.mock.calls.find(
        ([url, opts]) =>
          typeof url === 'string' &&
          url.includes('article_comments') &&
          opts?.method === 'POST',
      );
      expect(postCall).toBeTruthy();
      const body = JSON.parse(postCall[1].body);
      expect(body.fields.text.stringValue).toBe('Nice one!');
    });
  });

  // ── Name prompt ─────────────────────────────────────────────────────────────

  it('shows name prompt on first comment when no name is stored', async () => {
    const {getByTestId, getByPlaceholderText, getByLabelText, getByText} = renderArticle();
    // storedName: null → commenterName stays null → name prompt fires
    await openComments(getByTestId, {storedName: null});

    const input = await waitFor(() => getByPlaceholderText('Add a comment...'));
    fireEvent.changeText(input, 'First comment!');
    fireEvent.press(getByLabelText('Send comment'));

    await waitFor(() => {
      expect(getByText('Choose a display name')).toBeTruthy();
    });
  });

  // ── Flagging comments ───────────────────────────────────────────────────────

  it('hides a comment from the list when flags reach 3', async () => {
    // Comment already at 2 flags — one more press hides it
    const row = makeCommentRow({text: 'Nearly flagged', flags: 2});
    const {getByTestId, getByText, getByLabelText, queryByText} = renderArticle();

    await openComments(getByTestId, {commentRows: [row]});

    await waitFor(() => {
      expect(getByText('Nearly flagged')).toBeTruthy();
    });

    // Press flag — handleFlag increments to 3, hides the comment
    await act(async () => {
      fireEvent.press(getByLabelText('Flag comment'));
    });

    await waitFor(() => {
      expect(queryByText('Nearly flagged')).toBeNull();
    });
  });
});
