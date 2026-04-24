import {getSeasonData} from '../assets/seasonData';

/**
 * Navigate to the appropriate screen based on notification data.
 * Polls until navigationRef is ready (handles cold-start timing).
 *
 * Supports two formats:
 *   type-based:  { type: "roadmap" }
 *   deeplink:    { deeplink: "btccfanhub://roadmap" }
 */
export function navigateFromData(navigationRef, data) {
  if (!data) return;

  const go = () => {
    // Resolve type from explicit `type` field or from `deeplink` URL path
    let {type, round, year, race, slug, deeplink} = data;

    if (!type && deeplink) {
      // e.g. "btccfanhub://roadmap" → type = "roadmap"
      try {
        const url = deeplink.replace(/^btccfanhub:\/\//, '');
        type = url.split('?')[0].split('/')[0];
      } catch {}
    }

    if ((type === 'round' || (!type && round)) && round) {
      navigationRef.navigate('Calendar', {screen: 'TrackDetail', params: {round}});

    } else if (type === 'news' && slug) {
      navigationRef.navigate('News', {screen: 'Article', params: {slug}});

    } else if (type === 'results' && round) {
      const y = parseInt(year, 10) || new Date().getFullYear();
      const season = getSeasonData(y);
      const roundObj = season?.rounds?.find(r => r.round === parseInt(round, 10));
      if (roundObj) {
        const initialRace = race ? parseInt(race, 10) - 1 : 0;
        navigationRef.navigate('Results', {
          screen: 'RoundResults',
          params: {round: roundObj, year: y, initialRace},
        });
      }

    } else if (type === 'podcast' || type === 'podcasts') {
      navigationRef.navigate('More', {screen: 'Podcasts'});

    } else if (type === 'roadmap') {
      navigationRef.navigate('More', {screen: 'Roadmap'});

    } else if (type === 'records') {
      navigationRef.navigate('More', {screen: 'Records'});

    } else if (type === 'radio') {
      navigationRef.navigate('More', {screen: 'Radio'});

    } else if (type === 'partners') {
      navigationRef.navigate('More', {screen: 'Partners'});

    } else if (type === 'settings') {
      navigationRef.navigate('More', {screen: 'Settings'});

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
