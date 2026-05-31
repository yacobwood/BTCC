/**
 * Tests for notification deep-link navigation logic.
 *
 * Covers every data payload the FCM / Notifee system can receive and verifies
 * that navigateFromData calls the correct navigationRef.navigate / dispatch target.
 *
 * Cold-start timing (navigationRef not immediately ready) is tested using
 * fake timers so the polling loop can be exercised without real delays.
 */

jest.mock('../../src/assets/seasonData', () => ({
  getSeasonData: jest.fn(),
}));

import {navigateFromData} from '../../src/utils/notifNavigation';
import {getSeasonData} from '../../src/assets/seasonData';

// A sample round object matching the shape stored in season data
const MOCK_ROUND = {
  round: 3,
  venue: 'Snetterton',
  startDate: '2025-07-12',
  endDate: '2025-07-13',
  date: '12-13 Jul 2025',
};

const MOCK_SEASON = {
  rounds: [
    {round: 1, venue: 'Donington Park'},
    {round: 3, venue: 'Snetterton', ...MOCK_ROUND},
    {round: 10, venue: 'Brands Hatch GP'},
  ],
};

function makeRef(isReady = true) {
  return {
    navigate: jest.fn(),
    dispatch: jest.fn(),
    isReady:  jest.fn(() => isReady),
  };
}

// Helpers to build the expected dispatch argument shapes.
// CommonActions.reset is mocked in jest.setup.js as jest.fn(v => v), so
// dispatch receives the raw config object passed to reset().
function resetTo(tabName, nestedState) {
  return {
    index: 0,
    routes: [{name: tabName, state: nestedState}],
  };
}

function nestedState(screens) {
  return {routes: screens, index: screens.length - 1};
}

describe('navigateFromData', () => {
  describe('round / track detail deeplinks', () => {
    it('dispatches Calendar → TrackDetail for type="round"', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'round', round: '1'});

      expect(ref.dispatch).toHaveBeenCalledWith(
        resetTo('Calendar', nestedState([{name: 'CalendarList'}, {name: 'TrackDetail', params: {round: '1'}}])),
      );
    });

    it('dispatches Calendar → TrackDetail when no type but round is present (legacy)', () => {
      const ref = makeRef();
      navigateFromData(ref, {round: '5'});

      expect(ref.dispatch).toHaveBeenCalledWith(
        resetTo('Calendar', nestedState([{name: 'CalendarList'}, {name: 'TrackDetail', params: {round: '5'}}])),
      );
    });

    it('passes the round string through unchanged', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'round', round: '10'});
      expect(ref.dispatch).toHaveBeenCalledWith(
        resetTo('Calendar', nestedState([{name: 'CalendarList'}, {name: 'TrackDetail', params: {round: '10'}}])),
      );
    });
  });

  describe('news article deeplinks', () => {
    it('dispatches News → Article with the slug', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'news', slug: 'ingram-wins-race-3'});

      expect(ref.dispatch).toHaveBeenCalledWith(
        resetTo('News', nestedState([{name: 'NewsFeed'}, {name: 'Article', params: {slug: 'ingram-wins-race-3', trafficSource: 'notification'}}])),
      );
    });

    it('navigates to News tab for type="news" without a slug', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'news'});
      expect(ref.navigate).toHaveBeenCalledWith('News');
    });
  });

  describe('results deeplinks', () => {
    beforeEach(() => {
      getSeasonData.mockReturnValue(MOCK_SEASON);
    });

    it('dispatches Results → RoundResults with the correct roundObj', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'results', round: '3', year: '2025'});

      expect(ref.dispatch).toHaveBeenCalledWith(
        resetTo('Results', nestedState([
          {name: 'ResultsList'},
          {name: 'RoundResults', params: {
            round: expect.objectContaining({round: 3, venue: 'Snetterton'}),
            year: 2025,
            initialRace: 0,
          }},
        ])),
      );
    });

    it('sets initialRace from race param (1-indexed → 0-indexed)', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'results', round: '3', year: '2025', race: '2'});

      const dispatchArg = ref.dispatch.mock.calls[0][0];
      const rrParams = dispatchArg.routes[0].state.routes[1].params;
      expect(rrParams.initialRace).toBe(1);
    });

    it('defaults initialRace to 0 when no race param provided', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'results', round: '3', year: '2025'});

      const dispatchArg = ref.dispatch.mock.calls[0][0];
      const rrParams = dispatchArg.routes[0].state.routes[1].params;
      expect(rrParams.initialRace).toBe(0);
    });

    it('defaults to current year when year param is missing', () => {
      const ref = makeRef();
      const currentYear = new Date().getFullYear();
      getSeasonData.mockReturnValue({rounds: [{round: 1, venue: 'Test'}]});

      navigateFromData(ref, {type: 'results', round: '1'});

      expect(getSeasonData).toHaveBeenCalledWith(currentYear);
    });

    it('does NOT dispatch when round number not found in season', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'results', round: '999', year: '2025'});

      expect(ref.dispatch).not.toHaveBeenCalled();
    });

    it('does NOT dispatch when getSeasonData returns null', () => {
      getSeasonData.mockReturnValue(null);
      const ref = makeRef();
      navigateFromData(ref, {type: 'results', round: '1', year: '2025'});

      expect(ref.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('podcast deeplinks', () => {
    it('dispatches More → Podcasts', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'podcast'});

      expect(ref.dispatch).toHaveBeenCalledWith(
        resetTo('More', nestedState([{name: 'MoreMenu'}, {name: 'Podcasts'}])),
      );
    });
  });

  describe('hub news deeplinks', () => {
    it('navigates to News tab for type="hub" with no id (legacy fallback)', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'hub', channel: 'news', title: 'Test post'});

      expect(ref.navigate).toHaveBeenCalledWith('News');
    });

    it('navigates to News tab for type="hub" even without optional fields', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'hub'});

      expect(ref.navigate).toHaveBeenCalledWith('News');
    });

    it('type="hub" with id triggers async fetch (navigate not called synchronously)', () => {
      // When id is present, notifNavigation fetches hub_news.json before navigating.
      // Navigation is async so this test just confirms no synchronous navigate call.
      const ref = makeRef();
      navigateFromData(ref, {type: 'hub', id: '42', channel: 'news', title: 'Test post'});

      expect(ref.navigate).not.toHaveBeenCalled();
      expect(ref.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('no-op cases', () => {
    it('does nothing for undefined data', () => {
      const ref = makeRef();
      navigateFromData(ref, undefined);
      expect(ref.navigate).not.toHaveBeenCalled();
      expect(ref.dispatch).not.toHaveBeenCalled();
    });

    it('does nothing for empty data object', () => {
      const ref = makeRef();
      navigateFromData(ref, {});
      expect(ref.navigate).not.toHaveBeenCalled();
      expect(ref.dispatch).not.toHaveBeenCalled();
    });

    it('does nothing for unrecognised type', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'unknown_type'});
      expect(ref.navigate).not.toHaveBeenCalled();
      expect(ref.dispatch).not.toHaveBeenCalled();
    });

    it('does nothing for type="round" with no round value', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'round'});
      expect(ref.navigate).not.toHaveBeenCalled();
      expect(ref.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('cold-start polling (navigationRef not yet ready)', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('dispatches once navigationRef becomes ready', () => {
      let readyCount = 0;
      const ref = {
        navigate: jest.fn(),
        dispatch: jest.fn(),
        isReady:  jest.fn(() => {
          readyCount++;
          return readyCount >= 3; // not ready for first 2 polls
        }),
      };

      navigateFromData(ref, {type: 'round', round: '1'});

      // Not yet dispatched — ref not ready
      expect(ref.dispatch).not.toHaveBeenCalled();

      // Advance past 2 poll intervals (100ms each)
      jest.advanceTimersByTime(300);

      expect(ref.dispatch).toHaveBeenCalledWith(
        resetTo('Calendar', nestedState([{name: 'CalendarList'}, {name: 'TrackDetail', params: {round: '1'}}])),
      );
    });

    it('dispatches immediately when already ready', () => {
      const ref = makeRef(true);
      navigateFromData(ref, {type: 'podcast'});

      // No timers needed — called synchronously
      expect(ref.dispatch).toHaveBeenCalledWith(
        resetTo('More', nestedState([{name: 'MoreMenu'}, {name: 'Podcasts'}])),
      );
    });

    it('does not navigate after 10 second timeout if ref never becomes ready', () => {
      const ref = makeRef(false); // never ready
      navigateFromData(ref, {type: 'round', round: '1'});

      // Advance past the 10s safety timeout
      jest.advanceTimersByTime(11000);

      expect(ref.navigate).not.toHaveBeenCalled();
      expect(ref.dispatch).not.toHaveBeenCalled();
    });

    it('dispatches exactly once even if polling fires multiple times before navigate', () => {
      let callCount = 0;
      const ref = {
        navigate: jest.fn(),
        dispatch: jest.fn(),
        isReady: jest.fn(() => {
          callCount++;
          return callCount >= 2;
        }),
      };

      navigateFromData(ref, {type: 'podcast'});
      jest.advanceTimersByTime(500);

      expect(ref.dispatch).toHaveBeenCalledTimes(1);
    });
  });
});

// ── Integration: full notification tap scenario ─────────────────────────────────
describe('notification tap integration scenarios', () => {
  beforeEach(() => {
    getSeasonData.mockReturnValue(MOCK_SEASON);
  });

  it('race session notification → opens track detail', () => {
    const ref = makeRef();
    navigateFromData(ref, {channel: 'race', type: 'round', round: '3'});

    expect(ref.dispatch).toHaveBeenCalledWith(
      resetTo('Calendar', nestedState([{name: 'CalendarList'}, {name: 'TrackDetail', params: {round: '3'}}])),
    );
  });

  it('qualifying notification → opens track detail', () => {
    const ref = makeRef();
    navigateFromData(ref, {channel: 'qualifying', type: 'round', round: '3'});

    expect(ref.dispatch).toHaveBeenCalledWith(
      resetTo('Calendar', nestedState([{name: 'CalendarList'}, {name: 'TrackDetail', params: {round: '3'}}])),
    );
  });

  it('free practice notification → opens track detail', () => {
    const ref = makeRef();
    navigateFromData(ref, {channel: 'free_practice', type: 'round', round: '1'});

    expect(ref.dispatch).toHaveBeenCalledWith(
      resetTo('Calendar', nestedState([{name: 'CalendarList'}, {name: 'TrackDetail', params: {round: '1'}}])),
    );
  });

  it('results notification → opens RoundResults with round data', () => {
    const ref = makeRef();
    navigateFromData(ref, {channel: 'results', type: 'results', round: '3', year: '2025', race: '1'});

    expect(ref.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        routes: [expect.objectContaining({name: 'Results'})],
      }),
    );
  });

  it('news notification → opens article', () => {
    const ref = makeRef();
    navigateFromData(ref, {channel: 'news', type: 'news', slug: 'btcc-2026-season-preview'});

    expect(ref.dispatch).toHaveBeenCalledWith(
      resetTo('News', nestedState([{name: 'NewsFeed'}, {name: 'Article', params: {slug: 'btcc-2026-season-preview', trafficSource: 'notification'}}])),
    );
  });

  it('podcast notification → opens podcasts screen', () => {
    const ref = makeRef();
    navigateFromData(ref, {channel: 'podcasts', type: 'podcast'});

    expect(ref.dispatch).toHaveBeenCalledWith(
      resetTo('More', nestedState([{name: 'MoreMenu'}, {name: 'Podcasts'}])),
    );
  });

  it('hub news notification without id → opens news tab', () => {
    const ref = makeRef();
    navigateFromData(ref, {channel: 'news', type: 'hub', title: 'New post'});

    expect(ref.navigate).toHaveBeenCalledWith('News');
  });

  it('notification with only channel (missing type/round) → no navigation', () => {
    // This is the bug we fixed — admin page was sending only {channel:'qualifying'}
    const ref = makeRef();
    navigateFromData(ref, {channel: 'qualifying'});

    expect(ref.navigate).not.toHaveBeenCalled();
    expect(ref.dispatch).not.toHaveBeenCalled();
  });
});
