/**
 * Tests for notification deep-link navigation logic.
 *
 * Covers every data payload the FCM / Notifee system can receive and verifies
 * that navigateFromData calls the correct navigationRef.navigate target.
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
    isReady:  jest.fn(() => isReady),
  };
}

describe('navigateFromData', () => {
  describe('round / track detail deeplinks', () => {
    it('navigates to Calendar → TrackDetail for type="round"', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'round', round: '1'});

      expect(ref.navigate).toHaveBeenCalledWith('Calendar', {
        screen: 'TrackDetail',
        params: {round: '1'},
      });
    });

    it('navigates to Calendar → TrackDetail when no type but round is present (legacy)', () => {
      const ref = makeRef();
      navigateFromData(ref, {round: '5'});

      expect(ref.navigate).toHaveBeenCalledWith('Calendar', {
        screen: 'TrackDetail',
        params: {round: '5'},
      });
    });

    it('passes the round string through unchanged', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'round', round: '10'});
      expect(ref.navigate).toHaveBeenCalledWith('Calendar', {
        screen: 'TrackDetail',
        params: {round: '10'},
      });
    });
  });

  describe('news article deeplinks', () => {
    it('navigates to News → Article with the slug', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'news', slug: 'ingram-wins-race-3'});

      expect(ref.navigate).toHaveBeenCalledWith('News', {
        screen: 'Article',
        params: {slug: 'ingram-wins-race-3'},
      });
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

    it('navigates to Results → RoundResults with the correct roundObj', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'results', round: '3', year: '2025'});

      expect(ref.navigate).toHaveBeenCalledWith('Results', {
        screen: 'RoundResults',
        params: {
          round: expect.objectContaining({round: 3, venue: 'Snetterton'}),
          year: 2025,
          initialRace: 0,
        },
      });
    });

    it('sets initialRace from race param (1-indexed → 0-indexed)', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'results', round: '3', year: '2025', race: '2'});

      expect(ref.navigate).toHaveBeenCalledWith('Results', expect.objectContaining({
        screen: 'RoundResults',
        params: expect.objectContaining({initialRace: 1}),
      }));
    });

    it('defaults initialRace to 0 when no race param provided', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'results', round: '3', year: '2025'});

      const params = ref.navigate.mock.calls[0][1].params;
      expect(params.initialRace).toBe(0);
    });

    it('defaults to current year when year param is missing', () => {
      const ref = makeRef();
      const currentYear = new Date().getFullYear();
      getSeasonData.mockReturnValue({rounds: [{round: 1, venue: 'Test'}]});

      navigateFromData(ref, {type: 'results', round: '1'});

      expect(getSeasonData).toHaveBeenCalledWith(currentYear);
    });

    it('does NOT navigate when round number not found in season', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'results', round: '999', year: '2025'});

      expect(ref.navigate).not.toHaveBeenCalled();
    });

    it('does NOT navigate when getSeasonData returns null', () => {
      getSeasonData.mockReturnValue(null);
      const ref = makeRef();
      navigateFromData(ref, {type: 'results', round: '1', year: '2025'});

      expect(ref.navigate).not.toHaveBeenCalled();
    });
  });

  describe('podcast deeplinks', () => {
    it('navigates to More → Podcasts', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'podcast'});

      expect(ref.navigate).toHaveBeenCalledWith('More', {screen: 'Podcasts'});
    });
  });

  describe('hub news deeplinks', () => {
    it('navigates to News tab for type="hub"', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'hub', id: '42', channel: 'news', title: 'Test post'});

      expect(ref.navigate).toHaveBeenCalledWith('News');
    });

    it('navigates to News tab for type="hub" even without optional fields', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'hub'});

      expect(ref.navigate).toHaveBeenCalledWith('News');
    });
  });

  describe('no-op cases', () => {
    it('does nothing for undefined data', () => {
      const ref = makeRef();
      navigateFromData(ref, undefined);
      expect(ref.navigate).not.toHaveBeenCalled();
    });

    it('does nothing for empty data object', () => {
      const ref = makeRef();
      navigateFromData(ref, {});
      expect(ref.navigate).not.toHaveBeenCalled();
    });

    it('does nothing for unrecognised type', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'unknown_type'});
      expect(ref.navigate).not.toHaveBeenCalled();
    });

    it('does nothing for type="round" with no round value', () => {
      const ref = makeRef();
      navigateFromData(ref, {type: 'round'});
      expect(ref.navigate).not.toHaveBeenCalled();
    });
  });

  describe('cold-start polling (navigationRef not yet ready)', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('navigates once navigationRef becomes ready', () => {
      let readyCount = 0;
      const ref = {
        navigate: jest.fn(),
        isReady:  jest.fn(() => {
          readyCount++;
          return readyCount >= 3; // not ready for first 2 polls
        }),
      };

      navigateFromData(ref, {type: 'round', round: '1'});

      // Not yet navigated — ref not ready
      expect(ref.navigate).not.toHaveBeenCalled();

      // Advance past 2 poll intervals (100ms each)
      jest.advanceTimersByTime(300);

      expect(ref.navigate).toHaveBeenCalledWith('Calendar', {
        screen: 'TrackDetail',
        params: {round: '1'},
      });
    });

    it('navigates immediately when already ready', () => {
      const ref = makeRef(true);
      navigateFromData(ref, {type: 'podcast'});

      // No timers needed — called synchronously
      expect(ref.navigate).toHaveBeenCalledWith('More', {screen: 'Podcasts'});
    });

    it('does not navigate after 10 second timeout if ref never becomes ready', () => {
      const ref = makeRef(false); // never ready
      navigateFromData(ref, {type: 'round', round: '1'});

      // Advance past the 10s safety timeout
      jest.advanceTimersByTime(11000);

      expect(ref.navigate).not.toHaveBeenCalled();
    });

    it('navigates exactly once even if polling fires multiple times before navigate', () => {
      let callCount = 0;
      const ref = {
        navigate: jest.fn(),
        isReady: jest.fn(() => {
          callCount++;
          return callCount >= 2;
        }),
      };

      navigateFromData(ref, {type: 'podcast'});
      jest.advanceTimersByTime(500);

      expect(ref.navigate).toHaveBeenCalledTimes(1);
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
    // This is what the FCM data looks like for a race notification
    navigateFromData(ref, {channel: 'race', type: 'round', round: '3'});

    expect(ref.navigate).toHaveBeenCalledWith('Calendar', {
      screen: 'TrackDetail',
      params: {round: '3'},
    });
  });

  it('qualifying notification → opens track detail', () => {
    const ref = makeRef();
    navigateFromData(ref, {channel: 'qualifying', type: 'round', round: '3'});

    expect(ref.navigate).toHaveBeenCalledWith('Calendar', {
      screen: 'TrackDetail',
      params: {round: '3'},
    });
  });

  it('free practice notification → opens track detail', () => {
    const ref = makeRef();
    navigateFromData(ref, {channel: 'free_practice', type: 'round', round: '1'});

    expect(ref.navigate).toHaveBeenCalledWith('Calendar', {
      screen: 'TrackDetail',
      params: {round: '1'},
    });
  });

  it('results notification → opens RoundResults with round data', () => {
    const ref = makeRef();
    navigateFromData(ref, {channel: 'results', type: 'results', round: '3', year: '2025', race: '1'});

    expect(ref.navigate).toHaveBeenCalledWith('Results', expect.objectContaining({
      screen: 'RoundResults',
    }));
  });

  it('news notification → opens article', () => {
    const ref = makeRef();
    navigateFromData(ref, {channel: 'news', type: 'news', slug: 'btcc-2026-season-preview'});

    expect(ref.navigate).toHaveBeenCalledWith('News', {
      screen: 'Article',
      params: {slug: 'btcc-2026-season-preview'},
    });
  });

  it('podcast notification → opens podcasts screen', () => {
    const ref = makeRef();
    navigateFromData(ref, {channel: 'podcasts', type: 'podcast'});

    expect(ref.navigate).toHaveBeenCalledWith('More', {screen: 'Podcasts'});
  });

  it('hub news notification → opens news tab', () => {
    const ref = makeRef();
    navigateFromData(ref, {channel: 'news', type: 'hub', id: '123', title: 'New post'});

    expect(ref.navigate).toHaveBeenCalledWith('News');
  });

  it('notification with only channel (missing type/round) → no navigation', () => {
    // This is the bug we fixed — admin page was sending only {channel:'qualifying'}
    const ref = makeRef();
    navigateFromData(ref, {channel: 'qualifying'});

    expect(ref.navigate).not.toHaveBeenCalled();
  });
});
