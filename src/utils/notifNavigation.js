import {getSeasonData} from '../assets/seasonData';

/**
 * Navigate to the appropriate screen based on notification data.
 * Polls until navigationRef is ready (handles cold-start timing).
 *
 * @param {object} navigationRef  - React Navigation container ref (must expose navigate + isReady)
 * @param {Record<string,string>|undefined} data - FCM / notifee data payload
 */
export function navigateFromData(navigationRef, data) {
  if (!data) return;

  const go = () => {
    const {type, round, year, race, slug} = data;

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

    } else if (type === 'podcast') {
      navigationRef.navigate('More', {screen: 'Podcasts'});
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
