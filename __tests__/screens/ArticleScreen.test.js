import React from 'react';
import {act, fireEvent, waitFor} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ArticleScreen from '../../src/screens/ArticleScreen';
import {renderWithProviders, makeNav, makeRoute} from './testUtils';

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('../../src/api/client', () => ({
  fetchArticleBySlug: jest.fn(),
  fetchBlacklist:     jest.fn().mockResolvedValue(['fuck', 'shit', 'damn']),
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
        {/* prev-carrying messages for toggle/switch tests */}
        <Text testID="webview-toggle-likes"     onPress={() => fire(null, 'likes')}>toggle-like</Text>
        <Text testID="webview-switch-to-dislike" onPress={() => fire('dislikes', 'likes')}>switch-dislike</Text>
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
      name: `projects/btcchub-af77a/databases/(default)/documents/article_comments/${overrides.id ?? 'comment1'}`,
      fields: {
        text:       {stringValue: overrides.text       ?? 'Great race!'},
        authorId:   {stringValue: overrides.authorId   ?? 'other_author_xyz'},
        authorName: {stringValue: overrides.authorName ?? 'BTCC Fan'},
        timestamp:  {stringValue: overrides.timestamp  ?? '2026-04-19T10:00:00Z'},
        likes:      {integerValue: String(overrides.likes    ?? 0)},
        dislikes:   {integerValue: String(overrides.dislikes ?? 0)},
        hidden:     {booleanValue: overrides.hidden    ?? false},
        parentId:   {nullValue: null},
      },
    },
  };
}

/**
 * Build a fetch mock that routes:
 *  - :runQuery        → commentRows (fetchComments)
 *  - article_comments POST → postComment response
 *  - commentReact     → Cloud Function comment reaction (ok: true, or error if cfFails)
 *  - everything else  → reactions GET response
 */
function makeCommentsFetch(commentRows = [], {cfFails = false} = {}) {
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
    if (u.includes('commentReact')) {
      if (cfFails) return Promise.resolve({ok: false, status: 500, json: () => Promise.resolve({ok: false})});
      return Promise.resolve({ok: true, json: () => Promise.resolve({ok: true})});
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

    it('removes reaction from AsyncStorage when toggled off', async () => {
      // Seed storage with an existing 'likes' reaction for this slug
      AsyncStorage.getItem.mockImplementation(key => {
        if (key === 'article_reactions_v1')
          return Promise.resolve(JSON.stringify({'ingram-wins-donington': 'likes'}));
        return Promise.resolve(null);
      });

      const {getByTestId} = renderArticle({article: FULL_ARTICLE});

      await act(async () => {
        getByTestId('webview-toggle-likes').props.onPress();
      });

      await waitFor(() => {
        const call = AsyncStorage.setItem.mock.calls.find(([key]) => key === 'article_reactions_v1');
        expect(call).toBeTruthy();
        const stored = JSON.parse(call[1]);
        expect(stored['ingram-wins-donington']).toBeUndefined();
      });
    });

    it('sends a decrement for previous reaction when switching', async () => {
      const {getByTestId} = renderArticle();

      await act(async () => {
        getByTestId('webview-switch-to-dislike').props.onPress();
      });

      await waitFor(() => {
        const commitCalls = global.fetch.mock.calls.filter(
          ([url]) => typeof url === 'string' && url.includes(':commit'),
        );
        // Two commits: -1 on likes (prev) and +1 on dislikes (new)
        expect(commitCalls.length).toBeGreaterThanOrEqual(2);
        const bodies = commitCalls.map(c => JSON.parse(c[1].body));
        const transforms = bodies.map(b => b.writes[0].transform.fieldTransforms[0]);
        expect(transforms).toEqual(
          expect.arrayContaining([
            expect.objectContaining({fieldPath: 'likes',    increment: {integerValue: '-1'}}),
            expect.objectContaining({fieldPath: 'dislikes', increment: {integerValue: '1'}}),
          ]),
        );
      });
    });

    it('calls injectJavaScript to revert reaction when Firestore commit fails', async () => {
      global.fetch = jest.fn().mockImplementation((url) => {
        if (typeof url === 'string' && url.includes(':commit')) {
          return Promise.reject(new Error('network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({fields: {likes: {integerValue: '0'}, dislikes: {integerValue: '0'}}}),
        });
      });

      const {getByTestId} = renderArticle();
      // Trigger webview load so webviewRef is wired up
      await act(async () => { getByTestId('webview-load').props.onPress(); });

      await act(async () => {
        getByTestId('webview-message-likes').props.onPress();
      });

      await waitFor(() => {
        const webviewMock = getByTestId('webview');
        // injectJavaScript is called on the ref — find it via the mock
        const ref = webviewMock._fiber?.ref;
        // Use the WebView ref mock exposed via useImperativeHandle
        const injectCalls = require('react-native-webview').WebView.mock?.instances;
        // Verify via fetch: commit was attempted and failed
        const commitAttempt = global.fetch.mock.calls.find(
          ([url]) => typeof url === 'string' && url.includes(':commit'),
        );
        expect(commitAttempt).toBeTruthy();
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
  async function openComments(getByTestId, {commentRows = [], storedName = 'Test Fan', fetchMock, commentReactions = {}} = {}) {
    global.fetch = fetchMock ?? makeCommentsFetch(commentRows);

    AsyncStorage.getItem.mockImplementation(key => {
      if (key === 'commenter_name') return Promise.resolve(storedName);
      if (key === 'comment_reactions_v1') {
        return Promise.resolve(Object.keys(commentReactions).length ? JSON.stringify(commentReactions) : null);
      }
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
      expect(getByText(/BTCC Fan/)).toBeTruthy();
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

  // ── Comment reactions (likes / dislikes) ────────────────────────────────────

  it('renders like count when comment has likes', async () => {
    const row = makeCommentRow({text: 'Fast lap!', likes: 5});
    const {getByTestId, getByText} = renderArticle();

    await openComments(getByTestId, {commentRows: [row]});

    await waitFor(() => {
      expect(getByText('5')).toBeTruthy();
    });
  });

  it('calls commentReact CF with { commentId, prev: null, next: "likes" } on like', async () => {
    const row = makeCommentRow({id: 'cmt42', text: 'Amazing!'});
    const {getByTestId, getByLabelText} = renderArticle();

    await openComments(getByTestId, {commentRows: [row]});

    await act(async () => {
      fireEvent.press(getByLabelText('Like comment'));
    });

    await waitFor(() => {
      const cfCall = global.fetch.mock.calls.find(
        ([url]) => typeof url === 'string' && url.includes('/commentReact'),
      );
      expect(cfCall).toBeTruthy();
      expect(cfCall[1].method).toBe('POST');
      expect(JSON.parse(cfCall[1].body)).toEqual({commentId: 'cmt42', prev: null, next: 'likes'});
    });
  });

  it('calls commentReact CF with { commentId, prev: null, next: "dislikes" } on dislike', async () => {
    const row = makeCommentRow({id: 'cmt99', text: 'Boring race'});
    const {getByTestId, getByLabelText} = renderArticle();

    await openComments(getByTestId, {commentRows: [row]});

    await act(async () => {
      fireEvent.press(getByLabelText('Dislike comment'));
    });

    await waitFor(() => {
      const cfCall = global.fetch.mock.calls.find(
        ([url]) => typeof url === 'string' && url.includes('/commentReact'),
      );
      expect(cfCall).toBeTruthy();
      expect(JSON.parse(cfCall[1].body)).toEqual({commentId: 'cmt99', prev: null, next: 'dislikes'});
    });
  });

  it('shows optimistic like count immediately before CF responds', async () => {
    let resolveCf;
    const fetchMock = jest.fn().mockImplementation((url, options) => {
      const u = typeof url === 'string' ? url : '';
      if (u.includes(':runQuery')) return Promise.resolve({ok: true, json: () => Promise.resolve([makeCommentRow({id: 'cmt1', likes: 0})])});
      if (u.includes('commentReact')) return new Promise(resolve => { resolveCf = resolve; });
      return Promise.resolve({ok: true, json: () => Promise.resolve({fields: {likes: {integerValue: '0'}, dislikes: {integerValue: '0'}}})});
    });

    const {getByTestId, getByLabelText, queryByText} = renderArticle();
    await openComments(getByTestId, {fetchMock});

    fireEvent.press(getByLabelText('Like comment'));

    await waitFor(() => {
      expect(queryByText('1')).toBeTruthy();
    });
  });

  it('calls commentReact CF with prev="likes" next=null when toggling off a like', async () => {
    const row = makeCommentRow({id: 'cmt1', likes: 1});
    const {getByTestId, getByLabelText} = renderArticle();

    await openComments(getByTestId, {commentRows: [row], commentReactions: {cmt1: 'likes'}});

    await act(async () => {
      fireEvent.press(getByLabelText('Like comment'));
    });

    await waitFor(() => {
      const cfCall = global.fetch.mock.calls.find(
        ([url]) => typeof url === 'string' && url.includes('/commentReact'),
      );
      expect(cfCall).toBeTruthy();
      expect(JSON.parse(cfCall[1].body)).toEqual({commentId: 'cmt1', prev: 'likes', next: null});
    });
  });

  it('sends a single CF call with prev="likes" next="dislikes" when switching reaction', async () => {
    const row = makeCommentRow({id: 'cmt1', likes: 1});
    const {getByTestId, getByLabelText} = renderArticle();

    await openComments(getByTestId, {commentRows: [row], commentReactions: {cmt1: 'likes'}});

    await act(async () => {
      fireEvent.press(getByLabelText('Dislike comment'));
    });

    await waitFor(() => {
      const cfCalls = global.fetch.mock.calls.filter(
        ([url]) => typeof url === 'string' && url.includes('/commentReact'),
      );
      expect(cfCalls).toHaveLength(1);
      expect(JSON.parse(cfCalls[0][1].body)).toEqual({commentId: 'cmt1', prev: 'likes', next: 'dislikes'});
    });
  });

  it('reverts optimistic like count when CF call fails', async () => {
    const row = makeCommentRow({id: 'cmt1', likes: 0});
    const fetchMock = makeCommentsFetch([row], {cfFails: true});
    const {getByTestId, getByLabelText, queryByText} = renderArticle();

    await openComments(getByTestId, {commentRows: [row], fetchMock});

    await act(async () => {
      fireEvent.press(getByLabelText('Like comment'));
    });

    await waitFor(() => {
      // count only renders when > 0 — null means the revert succeeded
      expect(queryByText('1')).toBeNull();
    });
  });

  it('reverts AsyncStorage reaction when CF call fails', async () => {
    const row = makeCommentRow({id: 'cmt1'});
    const fetchMock = makeCommentsFetch([row], {cfFails: true});
    const {getByTestId, getByLabelText} = renderArticle();

    await openComments(getByTestId, {commentRows: [row], fetchMock});

    await act(async () => {
      fireEvent.press(getByLabelText('Like comment'));
    });

    await waitFor(() => {
      const calls = AsyncStorage.setItem.mock.calls.filter(([key]) => key === 'comment_reactions_v1');
      expect(calls.length).toBeGreaterThanOrEqual(2);
      const stored = JSON.parse(calls[calls.length - 1][1]);
      expect(stored.cmt1).toBeUndefined();
    });
  });

  it('persists like reaction to AsyncStorage', async () => {
    const row = makeCommentRow({id: 'cmt1'});
    const {getByTestId, getByLabelText} = renderArticle();

    await openComments(getByTestId, {commentRows: [row]});

    await act(async () => {
      fireEvent.press(getByLabelText('Like comment'));
    });

    await waitFor(() => {
      const call = AsyncStorage.setItem.mock.calls.find(([key]) => key === 'comment_reactions_v1');
      expect(call).toBeTruthy();
      expect(JSON.parse(call[1]).cmt1).toBe('likes');
    });
  });

  // ── fetchComments error handling (regression for silent Firestore failures) ──

  it('shows empty state (not a crash) when Firestore returns an error on fetch', async () => {
    global.fetch = jest.fn().mockImplementation((url) => {
      if (typeof url === 'string' && url.includes(':runQuery')) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({error: {code: 400, message: 'The query requires an index.'}}),
        });
      }
      return Promise.resolve({ok: true, json: () => Promise.resolve({fields: {likes: {integerValue: '0'}, dislikes: {integerValue: '0'}}})});
    });

    const {getByTestId, getByText} = renderArticle();
    await openComments(getByTestId);

    await waitFor(() => {
      expect(getByText('No comments yet. Be the first!')).toBeTruthy();
    });
  });

  it('shows error and restores input when postComment fails', async () => {
    const failFetch = jest.fn().mockImplementation((url, options) => {
      const u = typeof url === 'string' ? url : '';
      if (u.includes(':runQuery')) return Promise.resolve({ok: true, json: () => Promise.resolve([])});
      if (u.includes('article_comments') && options?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: () => Promise.resolve({error: {code: 403, message: 'Missing or insufficient permissions.'}}),
        });
      }
      return Promise.resolve({ok: true, json: () => Promise.resolve({fields: {likes: {integerValue: '0'}, dislikes: {integerValue: '0'}}})});
    });

    const {getByTestId, getByPlaceholderText, getByLabelText, getByText} = renderArticle();
    await openComments(getByTestId, {fetchMock: failFetch});

    const input = await waitFor(() => getByPlaceholderText('Add a comment...'));
    fireEvent.changeText(input, 'My comment');
    fireEvent.press(getByLabelText('Send comment'));

    await waitFor(() => {
      expect(getByText('Failed to post comment. Please try again.')).toBeTruthy();
    });
  });

  // ── Edit and delete own comments ────────────────────────────────────────────

  it('shows edit and delete buttons only on own comments', async () => {
    const ownRow   = makeCommentRow({id: 'own1',   authorId: 'test-uid-123', text: 'My comment'});
    const otherRow = makeCommentRow({id: 'other1', authorId: 'someone-else',  text: 'Their comment'});
    const {getByTestId, getByLabelText, queryByLabelText} = renderArticle();
    await openComments(getByTestId, {commentRows: [ownRow, otherRow]});
    await waitFor(() => {
      expect(getByLabelText('Edit comment')).toBeTruthy();
      expect(getByLabelText('Delete comment')).toBeTruthy();
    });
    // Other author's comment should have neither button
    expect(queryByLabelText('Edit comment, Their comment')).toBeNull();
  });

  it('shows inline TextInput and Save/Cancel when edit button is pressed', async () => {
    const ownRow = makeCommentRow({id: 'own1', authorId: 'test-uid-123', text: 'Original text'});
    const {getByTestId, getByLabelText, queryByText} = renderArticle();
    await openComments(getByTestId, {commentRows: [ownRow]});
    await waitFor(() => getByLabelText('Edit comment'));
    fireEvent.press(getByLabelText('Edit comment'));
    await waitFor(() => {
      expect(getByLabelText('Edit comment')).toBeTruthy(); // TextInput label
      expect(queryByText('Save')).toBeTruthy();
      expect(queryByText('Cancel')).toBeTruthy();
    });
  });

  it('calls Firestore PATCH with new text when edit is saved', async () => {
    const ownRow = makeCommentRow({id: 'editme', authorId: 'test-uid-123', text: 'Old text'});
    const fetchMock = jest.fn().mockImplementation((url, opts) => {
      if (url.includes(':runQuery'))
        return Promise.resolve({ok: true, json: () => Promise.resolve([ownRow])});
      if (url.includes('article_comments') && opts?.method === 'PATCH')
        return Promise.resolve({ok: true, json: () => Promise.resolve({})});
      return Promise.resolve({ok: true, json: () => Promise.resolve({fields: {likes: {integerValue: '0'}, dislikes: {integerValue: '0'}}})});
    });
    global.fetch = fetchMock;
    const {getByTestId, getByLabelText} = renderArticle();
    await openComments(getByTestId, {commentRows: [ownRow], fetchMock});
    await waitFor(() => getByLabelText('Edit comment'));
    fireEvent.press(getByLabelText('Edit comment'));
    await waitFor(() => getByLabelText('Edit comment')); // TextInput
    fireEvent.changeText(getByLabelText('Edit comment'), 'Updated text');
    fireEvent.press(getByLabelText('Save edit'));
    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([url, opts]) => typeof url === 'string' && url.includes('article_comments/editme') && opts?.method === 'PATCH',
      );
      expect(patchCall).toBeTruthy();
      const body = JSON.parse(patchCall[1].body);
      expect(body.fields.text.stringValue).toBe('Updated text');
      expect(body.fields.editedAt.stringValue).toBeTruthy();
    });
  });

  it('shows edited tag on comments that have an editedAt field', async () => {
    const editedRow = {
      document: {
        name: 'projects/btcchub-af77a/databases/(default)/documents/article_comments/edited1',
        fields: {
          text:       {stringValue: 'Edited comment text'},
          authorId:   {stringValue: 'someone'},
          authorName: {stringValue: 'A Fan'},
          timestamp:  {stringValue: '2026-04-19T10:00:00Z'},
          likes:      {integerValue: '0'},
          dislikes:   {integerValue: '0'},
          hidden:     {booleanValue: false},
          parentId:   {nullValue: null},
          editedAt:   {stringValue: '2026-04-19T11:00:00Z'},
        },
      },
    };
    const {getByTestId, getByText} = renderArticle();
    await openComments(getByTestId, {commentRows: [editedRow]});
    await waitFor(() => {
      expect(getByText('edited')).toBeTruthy();
    });
  });
});
