import {CommonActions} from '@react-navigation/native';
import {getSeasonData} from '../assets/seasonData';
import {markRead} from './digestRead';
import {markRead as markExplainerRead} from './explainerRead';
import {Analytics} from './analytics';
import {requestOpenChat} from './chatBridge';
import {fetchExplainerArticleById} from '../api/client';

const pagesData = require('../assets/pages.json');
// getSeasonData() only ever covers archived past seasons (2004-2025 as of
// writing - see seasonData.js's own comment), so it's always null for the
// live current season. Same current-season source RoundResultsScreen.js
// itself already trusts (BUNDLED_RESULTS there) - see src/assets/data/
// README.md for why this is a different pipeline's file, not a smaller/
// stale copy of the season_*.json archive format.
const BUNDLED_CURRENT_RESULTS = require('../../data/results2026.json');

const HUB_NEWS_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/hub_news.json';

const ARTICLE_NOTIF_TYPES = new Set(['news', 'hub', 'digest', 'explainer']);

function fetchHubPost(id) {
  return fetch(HUB_NEWS_URL + '?t=' + Date.now())
    .then(r => r.json())
    .then(data => data.posts?.find(p => String(p.id) === String(id)) || null);
}

/**
 * Single entry point for "a notification was pressed" - tracks analytics, then
 * navigates. Shared by every press-handling path (App.tsx's notifee foreground
 * and cold-start listeners, the RNFirebase messaging listeners, and index.js's
 * notifee background handler) so a press while the app is merely backgrounded
 * gets identical tracking and routing to every other lifecycle state, rather
 * than a second, easily-drifted copy of this logic living in the native entry
 * point (which can't import from App.tsx without dragging in its full,
 * globally-mocked-in-tests provider tree).
 */
export function handleNotificationOpen(navigationRef, data) {
  if (data) {
    Analytics.notificationOpened(data.type);
    if (ARTICLE_NOTIF_TYPES.has(data.type)) {
      const articleId = data.slug || data.id || data.type;
      Analytics.articleClicked(articleId, 'notification', undefined, 'notification');
    }
  }
  navigateFromData(navigationRef, data);
}

/**
 * Navigate to the appropriate screen based on notification data.
 * Polls until navigationRef is ready (handles cold-start timing).
 *
 * Supports two formats:
 *   type-based:  { type: "roadmap" }
 *   deeplink:    { deeplink: "btccfanhub://roadmap" }
 *
 * Navigator structure (AppNavigator.js):
 *   Tab: News       → Stack: NewsFeed, Article
 *   Tab: Calendar   → Stack: CalendarList, TrackDetail, LiveTiming
 *   Tab: Grid       → Stack: DriversList, DriverDetail, TeamDetail
 *   Tab: Results    → Stack: ResultsList, RoundResults
 *   Tab: More       → Stack: MoreMenu, Settings, Radio, Podcasts, Records, Partners, Roadmap
 *
 * All nested deep links use CommonActions.reset() so they work on cold start.
 * navigate('Tab', {screen: 'Nested'}) only works when the nested stack is already
 * mounted; reset() sets the full state tree directly and works at any lifecycle stage.
 */
export function navigateFromData(navigationRef, data) {
  if (!data) return;

  const go = () => {
    // Resolve type from explicit `type` field or from `deeplink` URL path
    let {type, round, year, race, slug, deeplink, id, eventId} = data;

    if (!type && deeplink) {
      // e.g. "btccfanhub://roadmap" → type = "roadmap"
      try {
        const url = deeplink.replace(/^btccfanhub:\/\//, '');
        type = url.split('?')[0].split('/')[0];
      } catch {}
    }

    // ── News article ────────────────────────────────────────────────
    if (type === 'news' && slug) {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{
            name: 'News',
            state: {routes: [{name: 'NewsFeed'}, {name: 'Article', params: {slug, trafficSource: 'notification'}}], index: 1},
          }],
        }),
      );

    // ── Results / round ────────────────────────────────────────────
    } else if (type === 'results' && round) {
      const y = parseInt(year, 10) || new Date().getFullYear();
      const season = getSeasonData(y);
      let roundObj = season?.rounds?.find(r => r.round === parseInt(round, 10));
      // getSeasonData(y) is null for the live current season (it only covers
      // the finalized archive) - without this, every "results" deep link for
      // whatever season is actually happening right now silently no-op'd.
      // Confirmed live 2026-09-06 (round 8, Croft): a Race 3 results
      // notification landed on the default News tab instead of the Race 3
      // results screen, for exactly this reason.
      if (!roundObj && Number(BUNDLED_CURRENT_RESULTS.season) === y) {
        roundObj = BUNDLED_CURRENT_RESULTS.rounds?.find(r => r.round === parseInt(round, 10));
      }
      if (roundObj) {
        const initialRace = race ? parseInt(race, 10) - 1 : 0;
        navigationRef.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{
              name: 'Results',
              state: {
                routes: [
                  {name: 'ResultsList'},
                  {name: 'RoundResults', params: {round: roundObj, year: y, initialRace}},
                ],
                index: 1,
              },
            }],
          }),
        );
      }

    // ── Calendar / round ───────────────────────────────────────────
    } else if ((type === 'round' || (!type && round)) && round) {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{
            name: 'Calendar',
            state: {routes: [{name: 'CalendarList'}, {name: 'TrackDetail', params: {round}}], index: 1},
          }],
        }),
      );

    // ── Live timing ────────────────────────────────────────────────
    } else if (type === 'livetiming' && eventId) {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{
            name: 'Calendar',
            state: {routes: [{name: 'CalendarList'}, {name: 'LiveTiming', params: {eventId}}], index: 1},
          }],
        }),
      );

    // ── Hub article (non-digest) ───────────────────────────────────
    } else if (type === 'hub' && id) {
      fetchHubPost(id)
        .then(article => {
          if (article) {
            navigationRef.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{
                  name: 'News',
                  state: {routes: [{name: 'NewsFeed'}, {name: 'Article', params: {article, trafficSource: 'notification'}}], index: 1},
                }],
              }),
            );
          } else {
            navigationRef.navigate('News');
          }
        })
        .catch(() => navigationRef.navigate('News'));

    // ── The Flying Lap (digest) ────────────────────────────────────
    } else if (type === 'digest' && id) {
      fetchHubPost(id)
        .then(article => {
          if (article) {
            markRead(id);
            navigationRef.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{
                  name: 'News',
                  state: {
                    routes: [{name: 'NewsFeed'}, {name: 'Digests'}, {name: 'Article', params: {article, trafficSource: 'notification'}}],
                    index: 2,
                  },
                }],
              }),
            );
          } else {
            navigationRef.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{
                  name: 'News',
                  state: {routes: [{name: 'NewsFeed'}, {name: 'Digests'}], index: 1},
                }],
              }),
            );
          }
        })
        .catch(() => navigationRef.navigate('News'));

    // ── Explainer article ──────────────────────────────────────────
    // Same shape as the 'digest' branch above (article lives behind its own
    // list screen in the back stack, ExplainerList here instead of Digests) -
    // not the 'hub' branch, since these articles are never merged into the
    // real News feed and shouldn't land the user there on a back-press.
    } else if (type === 'explainer' && id) {
      fetchExplainerArticleById(id)
        .then(article => {
          if (article) {
            markExplainerRead(id);
            navigationRef.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{
                  name: 'News',
                  state: {
                    routes: [{name: 'NewsFeed'}, {name: 'ExplainerList'}, {name: 'Article', params: {article, trafficSource: 'notification'}}],
                    index: 2,
                  },
                }],
              }),
            );
          } else {
            // pendingArticleId (not just landing on the plain list) - added
            // 2026-09-04. fetchExplainerArticleById already retries a few
            // times over a few seconds (see api/client.js) to absorb small
            // CDN-edge inconsistency, but a live run the same day showed
            // raw.githubusercontent.com's actual propagation tail can run
            // well past 2 minutes on occasion - far more than any bounded
            // retry here should block navigation for. ExplainerListScreen
            // picks this param up and keeps quietly checking in the
            // background for up to 2 more minutes, auto-opening the article
            // the moment it's actually there instead of leaving the user to
            // discover it only via a manual pull-to-refresh.
            navigationRef.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{
                  name: 'News',
                  state: {routes: [{name: 'NewsFeed'}, {name: 'ExplainerList', params: {pendingArticleId: id}}], index: 1},
                }],
              }),
            );
          }
        })
        .catch(() => navigationRef.navigate('News'));

    // ── More → nested screens ──────────────────────────────────────
    } else if (type === 'podcast' || type === 'podcasts') {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{
            name: 'More',
            state: {routes: [{name: 'MoreMenu'}, {name: 'Podcasts'}], index: 1},
          }],
        }),
      );

    } else if (type === 'roadmap') {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{
            name: 'More',
            state: {routes: [{name: 'MoreMenu'}, {name: 'Roadmap'}], index: 1},
          }],
        }),
      );

    } else if (type === 'records') {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{
            name: 'More',
            state: {routes: [{name: 'MoreMenu'}, {name: 'Records'}], index: 1},
          }],
        }),
      );

    } else if (type === 'radio') {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{
            name: 'More',
            state: {routes: [{name: 'MoreMenu'}, {name: 'Radio'}], index: 1},
          }],
        }),
      );

    } else if (type === 'partners') {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{
            name: 'More',
            state: {routes: [{name: 'MoreMenu'}, {name: 'Partners'}], index: 1},
          }],
        }),
      );

    } else if (type === 'settings') {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{
            name: 'More',
            state: {routes: [{name: 'MoreMenu'}, {name: 'Settings'}], index: 1},
          }],
        }),
      );

    // ── Top-level tabs (no nested screen needed) ───────────────────
    } else if (type === 'calendar') {
      navigationRef.navigate('Calendar');

    } else if (type === 'drivers' || type === 'grid') {
      navigationRef.navigate('Grid');

    } else if (type === 'results' || type === 'history') {
      navigationRef.navigate('Results');

    } else if (type === 'chat') {
      // Live chat isn't a react-navigation route - it's a Modal owned by
      // ChatFab (mounted globally in AppContent), so it can't be reached
      // with navigate()/reset() like every other deep link here. This used
      // to call navigationRef.navigate('Chat'), which was always a no-op
      // since no 'Chat' route exists in AppNavigator.
      requestOpenChat();

    } else if (type === 'more') {
      navigationRef.navigate('More');

    } else if (type === 'hub' || type === 'news') {
      navigationRef.navigate('News');
    }
  };

  if (navigationRef.isReady()) {
    go();
  } else {
    const iv = setInterval(() => {
      if (navigationRef.isReady()) {
        clearInterval(iv);
        go();
      }
    }, 100);
    setTimeout(() => clearInterval(iv), 10000);
  }
}

/**
 * Onboarding's "New to BTCC?" link needs to navigate from outside the
 * navigator - same problem a notification tap has - before the user has
 * necessarily opened the More tab even once. Reuses the same cold-start-safe
 * reset pattern as the rest of this file rather than inventing a second one.
 */
export function navigateToNewToBtcc(navigationRef) {
  const page = (pagesData.pages || []).find(p => p.id === 'new-to-btcc');
  if (!page) return;

  const go = () => {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{
          name: 'More',
          state: {routes: [{name: 'MoreMenu'}, {name: 'InfoPage', params: {page}}], index: 1},
        }],
      }),
    );
  };

  if (navigationRef.isReady()) {
    go();
  } else {
    const iv = setInterval(() => {
      if (navigationRef.isReady()) {
        clearInterval(iv);
        go();
      }
    }, 100);
    setTimeout(() => clearInterval(iv), 10000);
  }
}
