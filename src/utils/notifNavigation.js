import {CommonActions} from '@react-navigation/native';
import {getSeasonData} from '../assets/seasonData';

const HUB_NEWS_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/hub_news.json';

function fetchHubPost(id) {
  return fetch(HUB_NEWS_URL + '?t=' + Date.now())
    .then(r => r.json())
    .then(data => data.posts?.find(p => String(p.id) === String(id)) || null);
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
            state: {routes: [{name: 'NewsFeed'}, {name: 'Article', params: {slug}}], index: 1},
          }],
        }),
      );

    // ── Results / round ────────────────────────────────────────────
    } else if (type === 'results' && round) {
      const y = parseInt(year, 10) || new Date().getFullYear();
      const season = getSeasonData(y);
      const roundObj = season?.rounds?.find(r => r.round === parseInt(round, 10));
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
                  state: {routes: [{name: 'NewsFeed'}, {name: 'Article', params: {article}}], index: 1},
                }],
              }),
            );
          } else {
            navigationRef.navigate('News');
          }
        })
        .catch(() => navigationRef.navigate('News'));

    // ── Monday Roundup (digest) ────────────────────────────────────
    } else if (type === 'digest' && id) {
      fetchHubPost(id)
        .then(article => {
          if (article) {
            navigationRef.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{
                  name: 'News',
                  state: {
                    routes: [{name: 'NewsFeed'}, {name: 'Digests'}, {name: 'Article', params: {article}}],
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
      navigationRef.navigate('Chat');

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
