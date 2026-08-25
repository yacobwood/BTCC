import React from 'react';
import {Linking} from 'react-native';
import {act, fireEvent, waitFor} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RoundResultsScreen from '../../src/screens/RoundResultsScreen';
import {renderWithProviders, makeNav, makeRoute, MOCK_ROUND} from './testUtils';

jest.mock('../../src/utils/broadcaster', () => ({
  detectBroadcaster: jest.fn(() => 'uk'),
}));

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {
    screen: jest.fn(),
    roundResultsViewed: jest.fn(),
    penaltiesShown: jest.fn(),
    penaltyDocumentOpened: jest.fn(),
    penaltyDocumentOpenFailed: jest.fn(),
    contentShared: jest.fn(),
  },
}));

const nav = makeNav();

function renderRound({round = MOCK_ROUND, initialRace = 0, favourites = [], year = 2026} = {}) {
  AsyncStorage.getItem.mockImplementation((key) => {
    if (key === 'favourite_drivers') return Promise.resolve(JSON.stringify(favourites));
    return Promise.resolve(null);
  });
  const route = makeRoute({round, year, initialRace, origin: 'results'});
  return renderWithProviders(<RoundResultsScreen navigation={nav} route={route} />);
}

describe('RoundResultsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls Analytics.screen("round_results") on mount', async () => {
    const {Analytics} = require('../../src/utils/analytics');
    renderRound();
    await waitFor(() => expect(Analytics.screen).toHaveBeenCalledWith('round_results'));
  });

  it('shares a web link to this round\'s results and logs contentShared when the share button is pressed', async () => {
    const {Share} = require('react-native');
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({action: 'sharedAction'});
    const {Analytics} = require('../../src/utils/analytics');
    const {getByLabelText} = renderRound();
    await waitFor(() => getByLabelText('Share round result'));
    fireEvent.press(getByLabelText('Share round result'));
    expect(Analytics.contentShared).toHaveBeenCalledWith('round_result', MOCK_ROUND.round);
    expect(shareSpy).toHaveBeenCalledWith({
      message: expect.stringContaining(`https://btcchub.vercel.app/results/${MOCK_ROUND.round}?src=round_result`),
    });
    shareSpy.mockRestore();
  });

  describe('tab bar', () => {
    it('renders abbreviated tab labels for all sessions', () => {
      const {getByText} = renderRound();
      expect(getByText('FP')).toBeTruthy();
      expect(getByText('QUAL')).toBeTruthy();
      expect(getByText('Q RACE')).toBeTruthy();
      expect(getByText('R1')).toBeTruthy();
      expect(getByText('R2')).toBeTruthy();
      expect(getByText('R3')).toBeTruthy();
    });

    it('starts on the FP tab by default (initialRace=0)', () => {
      const {getByText} = renderRound({initialRace: 0});
      expect(getByText('Tom INGRAM')).toBeTruthy();
    });

    it('starts on a specified initial tab', () => {
      const {getByText} = renderRound({initialRace: 3}); // Race 1: Shedden P1
      expect(getByText('Gordon SHEDDEN')).toBeTruthy();
    });

    it('switching tabs renders different results', async () => {
      const {getByText, queryByText} = renderRound({initialRace: 0});
      // FP: no points shown
      expect(queryByText('+20 pts')).toBeNull();

      await act(async () => {
        fireEvent.press(getByText('R1'));
      });
      // Race 1: Shedden wins (20 pts — bonus already in points from scraper)
      expect(getByText('+20 pts')).toBeTruthy();
    });
  });

  describe('result rows', () => {
    it('shows position numbers', () => {
      const {getByText} = renderRound({initialRace: 0});
      expect(getByText('1')).toBeTruthy();
      expect(getByText('2')).toBeTruthy();
    });

    it('shows driver names formatted correctly', () => {
      const {getByText} = renderRound({initialRace: 0});
      expect(getByText('Tom INGRAM')).toBeTruthy();
      expect(getByText('Gordon SHEDDEN')).toBeTruthy();
    });

    it('shows team names', () => {
      const {getByText} = renderRound({initialRace: 0});
      expect(getByText('Team Ingram')).toBeTruthy();
    });

    it('shows DNF for a driver who did not finish', () => {
      const {getAllByText} = renderRound({initialRace: 2}); // Q Race
      expect(getAllByText('DNF').length).toBeGreaterThan(0);
    });

    it('shows DQ for a disqualified driver rather than DNS', () => {
      const {getByText} = renderRound({initialRace: 4}); // Race 2
      expect(getByText('DQ')).toBeTruthy();
    });

    it('shows points for a race session', async () => {
      const {getByText} = renderRound({initialRace: 3}); // Race 1
      await waitFor(() => {
        expect(getByText('+20 pts')).toBeTruthy();
      });
    });

    it('does not show points for Free Practice', () => {
      const {queryByText} = renderRound({initialRace: 0});
      expect(queryByText('+0 pts')).toBeNull();
      expect(queryByText('+20 pts')).toBeNull();
    });
  });

  // ── TTB (TOCA Turbo Boost) badge on the post-race results list - reg 1.11.1 ──
  //
  // The Starting Grid tab's TTB badge (tested below under "starting grid tab")
  // disappears once a race has results, since RoundResultsScreen swaps to the
  // plain results FlatList at that point. This carries the same allocation
  // (a fixed pre-race number, not a live "laps consumed" counter) onto that
  // list. MOCK_ROUND's Race 2 finishes Ingram P1, Shedden P2, Cammish P3 (DQ,
  // 0 laps - non-classified, sorted after the classified two). Donington Park
  // is an "A circuit" per reg 1.11.1.b, so Race 3's TTB laps run 1 -> 2 -> 3.
  describe('result rows — TTB badge (results already in)', () => {
    it('shows TTB laps on the Race 3 results list, derived from the driver’s Race 2 finish', () => {
      const {getByLabelText} = renderRound({initialRace: 5}); // Race 3
      expect(getByLabelText('1 laps of TOCA Turbo Boost')).toBeTruthy(); // Ingram: R2 P1
    });

    it('shows no TTB badge for a driver who did not race in Race 2', () => {
      const {queryAllByLabelText} = renderRound({initialRace: 5}); // Race 3
      // Colin Turkington (Race 3 P1) isn't in Race 2's results at all - only
      // Ingram's badge should render, not one per Race 3 finisher.
      expect(queryAllByLabelText(/laps of TOCA Turbo Boost/)).toHaveLength(1);
    });

    it('does not show the TTB badge on the results list for an archive season', () => {
      const {queryByLabelText} = renderRound({initialRace: 5, year: 2024});
      expect(queryByLabelText(/Turbo Boost/)).toBeNull();
    });

    // Regression: a long team name (e.g. a full title-sponsor name) has no
    // bounded width of its own, and RN flex children default to flexShrink:0 -
    // so without truncation it renders at full natural width and pushes
    // whatever comes after it (delta arrow, TTB badge) off the edge of the row
    // instead of yielding to them.
    it('truncates a long team name instead of letting it push the TTB badge off the row', () => {
      const longNameRound = {
        ...MOCK_ROUND,
        races: MOCK_ROUND.races.map(r =>
          r.label === 'Race 3'
            ? {...r, results: r.results.map(res => res.driver === 'Tom Ingram' ? {...res, team: 'LKQ Euro Car Parts with Power Maxed Racing'} : res)}
            : r,
        ),
      };
      const {getByText, getByLabelText} = renderRound({round: longNameRound, initialRace: 5});
      expect(getByText('LKQ Euro Car Parts with Power Maxed Racing').props.numberOfLines).toBe(1);
      expect(getByLabelText('1 laps of TOCA Turbo Boost')).toBeTruthy(); // badge still renders, not squeezed out
    });
  });

  describe('favourite driver', () => {
    it('favourite driver name renders in yellow', async () => {
      const {getByText} = renderRound({initialRace: 0, favourites: ['Tom Ingram']});
      await waitFor(() => getByText('Tom INGRAM'));
      expect(getByText('Tom INGRAM')).toHaveStyle({color: '#FEBD02'});
    });

    it('non-favourite driver name is not yellow', async () => {
      const {getByText} = renderRound({initialRace: 0, favourites: ['Tom Ingram']});
      await waitFor(() => getByText('Gordon SHEDDEN'));
      expect(getByText('Gordon SHEDDEN')).not.toHaveStyle({color: '#FEBD02'});
    });

    it('multiple favourites are all highlighted', async () => {
      const {getByText} = renderRound({
        initialRace: 0,
        favourites: ['Tom Ingram', 'Gordon Shedden'],
      });
      await waitFor(() => getByText('Tom INGRAM'));
      expect(getByText('Tom INGRAM')).toHaveStyle({color: '#FEBD02'});
      expect(getByText('Gordon SHEDDEN')).toHaveStyle({color: '#FEBD02'});
    });

    it('favourite matching is case-insensitive', async () => {
      const {getByText} = renderRound({initialRace: 0, favourites: ['Tom INGRAM']});
      await waitFor(() => getByText('Tom INGRAM'));
      expect(getByText('Tom INGRAM')).toHaveStyle({color: '#FEBD02'});
    });

    it('has accessibility label with driver name and points', () => {
      const {getByLabelText} = renderRound({initialRace: 0});
      expect(getByLabelText('Position 1, Tom Ingram, 0 points')).toBeTruthy();
    });
  });

  describe('grid position deltas', () => {
    // Deltas are rendered as a coloured number beside a Material Icon arrow.
    // We detect them by finding Text nodes whose style includes the green (#4ADE80)
    // or red (#F87171) delta colour.
    function hasDeltaText(UNSAFE_queryAllByType) {
      const {Text} = require('react-native');
      const deltaColours = new Set(['#4ADE80', '#F87171']);
      return UNSAFE_queryAllByType(Text).some(el => {
        return [].concat(el.props.style || []).some(s => deltaColours.has(s?.color));
      });
    }

    it('Race 1 shows delta arrows (grid from Q Race results)', async () => {
      const {UNSAFE_queryAllByType} = renderRound({initialRace: 3}); // Race 1
      await waitFor(() => {
        expect(hasDeltaText(UNSAFE_queryAllByType)).toBe(true);
      });
    });

    it('Race 2 shows delta arrows (grid from Race 1 results)', async () => {
      const {UNSAFE_queryAllByType} = renderRound({initialRace: 4}); // Race 2
      await waitFor(() => {
        expect(hasDeltaText(UNSAFE_queryAllByType)).toBe(true);
      });
    });

    it('Free Practice shows no delta arrows', () => {
      const {UNSAFE_queryAllByType} = renderRound({initialRace: 0});
      expect(hasDeltaText(UNSAFE_queryAllByType)).toBe(false);
    });

    it('Race 3 shows no delta arrows (random reversal not stored)', () => {
      const {UNSAFE_queryAllByType} = renderRound({initialRace: 5});
      expect(hasDeltaText(UNSAFE_queryAllByType)).toBe(false);
    });
  });

  describe('navigation', () => {
    it('back button calls navigation.goBack', () => {
      const {getByLabelText} = renderRound();
      fireEvent.press(getByLabelText('Go back'));
      expect(nav.goBack).toHaveBeenCalled();
    });
  });

  // ── Reverse grid tab (Race 3 with no results) ─────────────────────────────────

  const REVERSE_GRID_ROUND = {
    round: 2,
    venue: 'Brands Hatch Indy',
    date: '10–11 May 2026',
    races: [
      {label: 'Free Practice',   results: []},
      {label: 'Qualifying',      results: []},
      {label: 'Qualifying Race', results: []},
      {label: 'Race 1',          results: []},
      {
        label: 'Race 2',
        results: [
          {driver: 'Tom Ingram',       position: 1, laps: 20, team: 'Team Ingram',  points: 25, time: '30:00.0', gap: null,  bestLap: '1:23.9', fastestLap: false, leadLap: false, pole: false},
          {driver: 'Gordon Shedden',   position: 2, laps: 20, team: 'Laser Tools',  points: 18, time: '30:01.0', gap: '1.0', bestLap: '1:24.0', fastestLap: false, leadLap: false, pole: false},
          {driver: 'Ashley Sutton',    position: 0, laps: 12, team: 'NAPA Racing',  points: 0,  time: 'DNF',     gap: null,  bestLap: null,      fastestLap: false, leadLap: false, pole: false},
          {driver: 'Colin Turkington', position: 0, laps: 8,  team: 'West Surrey',  points: 0,  time: 'DNF',     gap: null,  bestLap: null,      fastestLap: false, leadLap: false, pole: false},
        ],
      },
      {label: 'Race 3', results: []},
    ],
  };

  describe('reverse grid tab', () => {
    it('shows predicted grid heading when Race 3 has no results', () => {
      const {getByText} = renderRound({round: REVERSE_GRID_ROUND, initialRace: 5});
      expect(getByText('Predicted R3 Grid')).toBeTruthy();
    });

    it('shows all Race 2 finishers in the predicted grid', () => {
      const {getByText} = renderRound({round: REVERSE_GRID_ROUND, initialRace: 5});
      expect(getByText('Tom INGRAM')).toBeTruthy();
      expect(getByText('Gordon SHEDDEN')).toBeTruthy();
      expect(getByText('Ashley SUTTON')).toBeTruthy();
      expect(getByText('Colin TURKINGTON')).toBeTruthy();
    });

    it('reverses the top N classified drivers (default reversal=8 reverses both classified)', () => {
      const {getByText} = renderRound({round: REVERSE_GRID_ROUND, initialRace: 5});
      // R2 P2 Shedden goes to grid 1, P1 Ingram goes to grid 2
      const sheddenRow = getByText('Gordon SHEDDEN').parent?.parent;
      const ingramRow  = getByText('Tom INGRAM').parent?.parent;
      expect(getByText('P2 in R2')).toBeTruthy();
      expect(getByText('P1 in R2')).toBeTruthy();
    });

    it('places DNF drivers after classified, ordered by laps covered descending', () => {
      const {UNSAFE_queryAllByType} = renderRound({round: REVERSE_GRID_ROUND, initialRace: 5});
      const {Text} = require('react-native');
      const names = UNSAFE_queryAllByType(Text)
        .map(el => el.props.children)
        .filter(c => typeof c === 'string' && (c.includes('SUTTON') || c.includes('TURKINGTON')));
      const suttonIdx   = names.findIndex(n => n.includes('SUTTON'));
      const turkingtonIdx = names.findIndex(n => n.includes('TURKINGTON'));
      // Sutton (12 laps) must appear before Turkington (8 laps)
      expect(suttonIdx).toBeGreaterThan(-1);
      expect(turkingtonIdx).toBeGreaterThan(suttonIdx);
    });

    it('shows REV badge on reversed drivers', () => {
      const {getAllByText} = renderRound({round: REVERSE_GRID_ROUND, initialRace: 5});
      // Both classified are within reversal=8, so both get REV
      expect(getAllByText('REV').length).toBe(2);
    });

    it('stepper starts at 8', () => {
      const {getByText} = renderRound({round: REVERSE_GRID_ROUND, initialRace: 5});
      expect(getByText('8')).toBeTruthy();
    });

    it('stepper decrements by 1 on press', async () => {
      const {getByText, getByLabelText} = renderRound({round: REVERSE_GRID_ROUND, initialRace: 5});
      await act(async () => { fireEvent.press(getByLabelText('Decrease reversal count')); });
      expect(getByText('7')).toBeTruthy();
    });

    it('stepper increments by 1 on press', async () => {
      const {getByText, getByLabelText} = renderRound({round: REVERSE_GRID_ROUND, initialRace: 5});
      await act(async () => { fireEvent.press(getByLabelText('Increase reversal count')); });
      expect(getByText('9')).toBeTruthy();
    });

    it('stepper cannot go below 6', async () => {
      const {getByText, getByLabelText} = renderRound({round: REVERSE_GRID_ROUND, initialRace: 5});
      const dec = getByLabelText('Decrease reversal count');
      // 8 → 7 → 6 → (blocked)
      await act(async () => { fireEvent.press(dec); fireEvent.press(dec); fireEvent.press(dec); });
      expect(getByText('6')).toBeTruthy();
    });

    it('stepper cannot go above 12', async () => {
      const {getByText, getByLabelText} = renderRound({round: REVERSE_GRID_ROUND, initialRace: 5});
      const inc = getByLabelText('Increase reversal count');
      // 8 → 9 → 10 → 11 → 12 → (blocked)
      await act(async () => {
        fireEvent.press(inc); fireEvent.press(inc); fireEvent.press(inc);
        fireEvent.press(inc); fireEvent.press(inc);
      });
      expect(getByText('12')).toBeTruthy();
    });

    it('shows fallback message when Race 2 also has no results', () => {
      const noR2Round = {
        ...REVERSE_GRID_ROUND,
        races: REVERSE_GRID_ROUND.races.map(r =>
          r.label === 'Race 2' ? {...r, results: []} : r,
        ),
      };
      const {getByText} = renderRound({round: noR2Round, initialRace: 5});
      expect(getByText('Nothing to see here. Literally.')).toBeTruthy();
    });
  });

  // ── Starting grid tab (race has grid PDF data, no results yet) ────────────────

  // Six R2 finishers whose top 6 reversed exactly match the R3 grid (draw = 6).
  const GRID_ROUND = {
    round: 2,
    venue: 'Brands Hatch Indy',
    date: '10–11 May 2026',
    races: [
      {label: 'Free Practice',   results: [], grid: []},
      {label: 'Qualifying',      results: [], grid: []},
      {label: 'Qualifying Race', results: [], grid: []},
      {label: 'Race 1',          results: [], grid: []},
      {
        label: 'Race 2',
        grid: [],
        results: [
          {driver: 'Alpha Driver',   position: 1, team: 'Team Alpha', points: 25, time: '30:00', gap: null, laps: 20, bestLap: '1:24', fastestLap: false, leadLap: false, pole: false},
          {driver: 'Beta Driver',    position: 2, team: 'Team Beta',  points: 18, time: '30:01', gap: '1.0', laps: 20, bestLap: '1:24', fastestLap: false, leadLap: false, pole: false},
          {driver: 'Gamma Driver',   position: 3, team: 'Team Gamma', points: 15, time: '30:02', gap: '2.0', laps: 20, bestLap: '1:24', fastestLap: false, leadLap: false, pole: false},
          {driver: 'Delta Driver',   position: 4, team: 'Team Delta', points: 13, time: '30:03', gap: '3.0', laps: 20, bestLap: '1:24', fastestLap: false, leadLap: false, pole: false},
          {driver: 'Echo Driver',    position: 5, team: 'Team Echo',  points: 11, time: '30:04', gap: '4.0', laps: 20, bestLap: '1:24', fastestLap: false, leadLap: false, pole: false},
          {driver: 'Foxtrot Driver', position: 6, team: 'Team Fox',   points: 10, time: '30:05', gap: '5.0', laps: 20, bestLap: '1:24', fastestLap: false, leadLap: false, pole: false},
        ],
      },
      {
        label: 'Race 3',
        results: [],
        // R2 top-6 reversed (draw = 6): F→1, E→2, D→3, C→4, B→5, A→6
        grid: [
          {pos: 1, no: 6,  cl: 'M', driver: 'Foxtrot Driver', team: ''},
          {pos: 2, no: 5,  cl: 'M', driver: 'Echo Driver',    team: ''},
          {pos: 3, no: 4,  cl: 'M', driver: 'Delta Driver',   team: ''},
          {pos: 4, no: 3,  cl: 'M', driver: 'Gamma Driver',   team: ''},
          {pos: 5, no: 2,  cl: 'M', driver: 'Beta Driver',    team: ''},
          {pos: 6, no: 1,  cl: 'M', driver: 'Alpha Driver',   team: ''},
        ],
      },
    ],
  };

  describe('starting grid tab', () => {
    it('shows Official Starting Grid heading', () => {
      const {getByText} = renderRound({round: GRID_ROUND, initialRace: 5});
      expect(getByText('Official Starting Grid')).toBeTruthy();
    });

    it('renders all drivers from grid data', () => {
      const {getByText} = renderRound({round: GRID_ROUND, initialRace: 5});
      expect(getByText('Foxtrot DRIVER')).toBeTruthy();
      expect(getByText('Alpha DRIVER')).toBeTruthy();
    });

    it('cross-references team names from race results', () => {
      const {getByText} = renderRound({round: GRID_ROUND, initialRace: 5});
      expect(getByText('Team Fox')).toBeTruthy();
      expect(getByText('Team Alpha')).toBeTruthy();
    });

    it('shows reversal badge with detected draw number at the bottom', () => {
      const {getByText} = renderRound({round: GRID_ROUND, initialRace: 5});
      expect(getByText('Top 6 reversed (draw: 6)')).toBeTruthy();
    });

    it('does not show reversal badge when R3 grid does not match a clean reversal', () => {
      const scrambledRound = {
        ...GRID_ROUND,
        races: GRID_ROUND.races.map(r =>
          r.label === 'Race 3'
            ? {...r, grid: [{pos: 1, no: 1, cl: 'M', driver: 'Alpha Driver', team: ''}, {pos: 2, no: 2, cl: 'M', driver: 'Beta Driver', team: ''}]}
            : r,
        ),
      };
      const {queryByText} = renderRound({round: scrambledRound, initialRace: 5});
      expect(queryByText(/reversed/)).toBeNull();
    });

    it('does not show reversal badge for non-R3 races', () => {
      const r1GridRound = {
        ...GRID_ROUND,
        races: GRID_ROUND.races.map(r =>
          r.label === 'Race 1'
            ? {...r, grid: [{pos: 1, no: 1, cl: 'M', driver: 'Alpha Driver', team: ''}]}
            : r,
        ),
      };
      const {queryByText} = renderRound({round: r1GridRound, initialRace: 2});
      expect(queryByText(/reversed/)).toBeNull();
    });

    it('uses reverseGridDraw field instead of inferring from grid when set', () => {
      // Grid would infer draw=6, but reverseGridDraw:8 is the explicit override
      // (simulates TSL amending the grid PDF after the scrape window closed)
      const overrideRound = {
        ...GRID_ROUND,
        races: GRID_ROUND.races.map(r =>
          r.label === 'Race 3' ? {...r, reverseGridDraw: 8} : r,
        ),
      };
      const {getByText} = renderRound({round: overrideRound, initialRace: 5});
      expect(getByText('Top 8 reversed (draw: 8)')).toBeTruthy();
    });

    it('highlights favourite driver in the grid', async () => {
      const {getByText} = renderRound({round: GRID_ROUND, initialRace: 5, favourites: ['Foxtrot Driver']});
      await waitFor(() => getByText('Foxtrot DRIVER'));
      expect(getByText('Foxtrot DRIVER')).toHaveStyle({color: '#FEBD02'});
    });

    it('non-favourite driver is not highlighted', async () => {
      const {getByText} = renderRound({round: GRID_ROUND, initialRace: 5, favourites: ['Foxtrot Driver']});
      await waitFor(() => getByText('Alpha DRIVER'));
      expect(getByText('Alpha DRIVER')).not.toHaveStyle({color: '#FEBD02'});
    });

    // ── TTB (TOCA Turbo Boost) badge - reg 1.11.1 ───────────────────────────────
    // GRID_ROUND is round 2 at Brands Hatch Indy (a "B circuit" per reg 1.11.1.b).
    // Race 3's TTB position comes from Race 2's finishing order in the same
    // round: Alpha P1 -> Foxtrot P6, so their B-circuit TTB laps run 4 -> 10.

    it('shows the TTB legend line when boost laps are available', () => {
      const {getByText} = renderRound({round: GRID_ROUND, initialRace: 5});
      expect(getByText('⚡ Laps of TOCA Turbo Boost available this race')).toBeTruthy();
    });

    it('shows each driver’s TTB laps using the B-circuit scale', () => {
      const {getByLabelText} = renderRound({round: GRID_ROUND, initialRace: 5});
      expect(getByLabelText('4 laps of TOCA Turbo Boost')).toBeTruthy(); // Alpha: R2 P1
      expect(getByLabelText('5 laps of TOCA Turbo Boost')).toBeTruthy(); // Beta: R2 P2
      expect(getByLabelText('10 laps of TOCA Turbo Boost')).toBeTruthy(); // Foxtrot: R2 P6
    });

    it('does not show TTB badge/legend for a season other than the current one', () => {
      const {queryByText, queryByLabelText} = renderRound({round: GRID_ROUND, initialRace: 5, year: 2024});
      expect(queryByText(/Turbo Boost/)).toBeNull();
      expect(queryByLabelText(/Turbo Boost/)).toBeNull();
    });

    it('gives every driver the max TTB tier on Race 1 at round 1 (season opener - no Championship Order to rank by yet)', () => {
      const round1Race1Grid = {
        ...GRID_ROUND,
        round: 1,
        races: GRID_ROUND.races.map(r =>
          r.label === 'Race 1'
            ? {...r, grid: [{pos: 1, no: 1, cl: 'M', driver: 'Alpha Driver', team: ''}, {pos: 2, no: 2, cl: 'M', driver: 'Beta Driver', team: ''}]}
            : r,
        ),
      };
      const {getByText, getAllByLabelText} = renderRound({round: round1Race1Grid, initialRace: 3});
      expect(getByText('⚡ Season opener - every driver gets max TOCA Turbo Boost')).toBeTruthy();
      // Brands Hatch Indy is a B circuit -> P8+ row is 14 laps, for both drivers.
      expect(getAllByLabelText('14 laps of TOCA Turbo Boost')).toHaveLength(2);
    });

    it('does not show TTB badge/legend on Race 1 at round 1 for an archive season', () => {
      const round1Race1Grid = {
        ...GRID_ROUND,
        round: 1,
        races: GRID_ROUND.races.map(r =>
          r.label === 'Race 1'
            ? {...r, grid: [{pos: 1, no: 1, cl: 'M', driver: 'Alpha Driver', team: ''}]}
            : r,
        ),
      };
      const {queryByText, queryByLabelText} = renderRound({round: round1Race1Grid, initialRace: 3, year: 2024});
      expect(queryByText(/Turbo Boost/)).toBeNull();
      expect(queryByLabelText(/Turbo Boost/)).toBeNull();
    });
  });

  // ── TTB (TOCA Turbo Boost) - Qualifying / Qualifying Race secs/lap scale ────
  //
  // Reg 1.11.1.b: Qualifying and the Qualifying Race share Race 1's
  // Championship-Order position source (not each other's finishing order the
  // way Race 2/3 use the prior race), and use a seconds-per-lap scale instead
  // of the Races laps scale. Real Championship-Order values can't be tested
  // deterministically through the full screen at round 2+ here (allRounds is
  // seeded from the real bundled season data, unmockable without a network
  // fetch) - see ttbQualifyingPositionMap's own unit tests in ttb.test.js for
  // that. These integration tests stick to the deterministic round-1
  // season-opener case, same scoping the existing Race 1 tests above use.

  describe('starting grid tab (Qualifying Race) — TTB secs/lap badge', () => {
    const round1QualRaceGrid = {
      ...GRID_ROUND,
      round: 1,
      races: GRID_ROUND.races.map(r =>
        r.label === 'Qualifying Race'
          ? {...r, grid: [{pos: 1, no: 1, cl: 'M', driver: 'Alpha Driver', team: ''}, {pos: 2, no: 2, cl: 'M', driver: 'Beta Driver', team: ''}]}
          : r,
      ),
    };

    it('shows the seconds legend line and gives every driver the max TTB tier (season opener)', () => {
      const {getByText, getAllByLabelText} = renderRound({round: round1QualRaceGrid, initialRace: 2}); // Qualifying Race
      expect(getByText('⚡ Season opener - every driver gets max TOCA Turbo Boost')).toBeTruthy();
      // P8+ row of the secs/lap scale is 20, regardless of circuit type.
      expect(getAllByLabelText('20 seconds of TOCA Turbo Boost per lap')).toHaveLength(2);
    });

    it('does not show TTB badge/legend for an archive season', () => {
      const {queryByText, queryByLabelText} = renderRound({round: round1QualRaceGrid, initialRace: 2, year: 2024});
      expect(queryByText(/Turbo Boost/)).toBeNull();
      expect(queryByLabelText(/Turbo Boost/)).toBeNull();
    });
  });

  describe('result rows — TTB secs/lap badge (Qualifying / Qualifying Race, results already in)', () => {
    it('shows the max-tier seconds badge on the Qualifying results list (MOCK_ROUND is round 1)', () => {
      const {getAllByLabelText} = renderRound({initialRace: 1}); // Qualifying
      // Tom Ingram, Gordon Shedden both rostered from Qualifying's own results.
      expect(getAllByLabelText('20 seconds of TOCA Turbo Boost per lap')).toHaveLength(2);
    });

    it('shows the max-tier seconds badge on the Qualifying Race results list', () => {
      const qualRaceWithGrid = {
        ...MOCK_ROUND,
        races: MOCK_ROUND.races.map(r =>
          r.label === 'Qualifying Race'
            ? {...r, grid: [{pos: 1, no: 80, cl: 'M', driver: 'Tom Ingram', team: ''}, {pos: 2, no: 52, cl: 'M', driver: 'Gordon Shedden', team: ''}, {pos: 3, no: 4, cl: 'M', driver: 'Colin Turkington', team: ''}]}
            : r,
        ),
      };
      const {getAllByLabelText} = renderRound({round: qualRaceWithGrid, initialRace: 2}); // Qualifying Race
      expect(getAllByLabelText('20 seconds of TOCA Turbo Boost per lap')).toHaveLength(3);
    });

    it('does not show the seconds badge for an archive season', () => {
      const {queryByLabelText} = renderRound({initialRace: 1, year: 2024});
      expect(queryByLabelText(/Turbo Boost/)).toBeNull();
    });

    it('does not show a seconds badge on Free Practice (no TTB position source)', () => {
      const {queryByLabelText} = renderRound({initialRace: 0});
      expect(queryByLabelText(/Turbo Boost/)).toBeNull();
    });
  });

  // ── Predicted grid tab (R1/R2, before the official TSL grid PDF is published) ─
  //
  // Reg 3.4.1.b: R1's grid is the Qualifying Race finishing order; R2's grid is
  // the Race 1 finishing order. Non-classified competitors go after the last
  // classified competitor, ordered by laps covered (descending).

  const PREDICTED_R1_GRID_ROUND = {
    round: 2,
    venue: 'Brands Hatch Indy',
    date: '10–11 May 2026',
    races: [
      {label: 'Free Practice',   results: []},
      {label: 'Qualifying',      results: []},
      {
        label: 'Qualifying Race',
        results: [
          {driver: 'Alpha Driver', position: 1, laps: 15, team: 'Team Alpha', points: 25, time: '20:00', gap: null, bestLap: '1:24', fastestLap: false, leadLap: false, pole: false},
          {driver: 'Beta Driver',  position: 2, laps: 15, team: 'Team Beta',  points: 18, time: '20:01', gap: '1.0', bestLap: '1:24', fastestLap: false, leadLap: false, pole: false},
          {driver: 'Gamma Wilson', position: 0, laps: 10, team: 'Team Gamma', points: 0,  time: 'DNF',   gap: null, bestLap: null,     fastestLap: false, leadLap: false, pole: false},
          {driver: 'Delta Foster', position: 0, laps: 14, team: 'Team Delta', points: 0,  time: 'DNF',   gap: null, bestLap: null,     fastestLap: false, leadLap: false, pole: false},
        ],
      },
      {label: 'Race 1', results: [], grid: []},
      {label: 'Race 2', results: [], grid: []},
      {label: 'Race 3', results: []},
    ],
  };

  describe('predicted grid tab (Race 1, before official grid published)', () => {
    it('shows Predicted Starting Grid heading', () => {
      const {getByText} = renderRound({round: PREDICTED_R1_GRID_ROUND, initialRace: 3});
      expect(getByText('Predicted Starting Grid')).toBeTruthy();
    });

    it('shows subtitle referencing the Qualifying Race', () => {
      const {getByText} = renderRound({round: PREDICTED_R1_GRID_ROUND, initialRace: 3});
      expect(getByText('Based on Qualifying Race finishing order')).toBeTruthy();
    });

    it('keeps classified finishers in finishing order', () => {
      const {getByText} = renderRound({round: PREDICTED_R1_GRID_ROUND, initialRace: 3});
      expect(getByText('Alpha DRIVER')).toBeTruthy();
      expect(getByText('Beta DRIVER')).toBeTruthy();
    });

    it('places DNF drivers after classified, ordered by laps covered descending', () => {
      const {UNSAFE_queryAllByType} = renderRound({round: PREDICTED_R1_GRID_ROUND, initialRace: 3});
      const {Text} = require('react-native');
      const names = UNSAFE_queryAllByType(Text)
        .map(el => el.props.children)
        .filter(c => typeof c === 'string' && (c.includes('WILSON') || c.includes('FOSTER')));
      const fosterIdx = names.findIndex(n => n.includes('FOSTER'));
      const wilsonIdx = names.findIndex(n => n.includes('WILSON'));
      // Delta Foster (14 laps) must appear before Gamma Wilson (10 laps)
      expect(fosterIdx).toBeGreaterThan(-1);
      expect(wilsonIdx).toBeGreaterThan(fosterIdx);
    });

    it('cross-references team names from the Qualifying Race results', () => {
      const {getByText} = renderRound({round: PREDICTED_R1_GRID_ROUND, initialRace: 3});
      expect(getByText('Team Alpha')).toBeTruthy();
    });

    it('does not show a reversal badge (R1 grid is not reversed)', () => {
      const {queryByText} = renderRound({round: PREDICTED_R1_GRID_ROUND, initialRace: 3});
      expect(queryByText(/reversed/)).toBeNull();
    });

    it('Race 2 falls back to the plain empty state when Race 1 also has no results', () => {
      const {getByText} = renderRound({round: PREDICTED_R1_GRID_ROUND, initialRace: 4});
      expect(getByText('Nothing to see here. Literally.')).toBeTruthy();
    });
  });

  const PREDICTED_R2_GRID_ROUND = {
    ...PREDICTED_R1_GRID_ROUND,
    races: PREDICTED_R1_GRID_ROUND.races.map(r => {
      if (r.label === 'Qualifying Race') return {...r, results: []};
      if (r.label === 'Race 1') {
        return {
          label: 'Race 1',
          results: [
            {driver: 'Alpha Driver', position: 1, laps: 20, team: 'Team Alpha', points: 25, time: '30:00', gap: null, bestLap: '1:23', fastestLap: false, leadLap: false, pole: false},
            {driver: 'Beta Driver',  position: 2, laps: 20, team: 'Team Beta',  points: 18, time: '30:01', gap: '1.0', bestLap: '1:23', fastestLap: false, leadLap: false, pole: false},
          ],
        };
      }
      return r;
    }),
  };

  describe('predicted grid tab (Race 2, before official grid published)', () => {
    it('shows Predicted Starting Grid based on Race 1 finishing order', () => {
      const {getByText} = renderRound({round: PREDICTED_R2_GRID_ROUND, initialRace: 4});
      expect(getByText('Predicted Starting Grid')).toBeTruthy();
      expect(getByText('Based on Race 1 finishing order')).toBeTruthy();
      expect(getByText('Alpha DRIVER')).toBeTruthy();
    });
  });

  // ── R3 delta arrows when actual grid is available ─────────────────────────────

  const R3_WITH_GRID_ROUND = {
    ...MOCK_ROUND,
    races: MOCK_ROUND.races.map(r =>
      r.label === 'Race 3'
        ? {
            ...r,
            // Colin was P1 on grid, finished P1 (delta 0)
            // Tom was P2 on grid, finished P2 (delta 0)
            // Swap them to create visible deltas: Tom P1 grid → finishes P2 (↓1), Colin P2 grid → finishes P1 (↑1)
            grid: [
              {pos: 1, no: 80, cl: 'M', driver: 'Tom Ingram',       team: ''},
              {pos: 2, no: 4,  cl: 'M', driver: 'Colin Turkington', team: ''},
            ],
          }
        : r,
    ),
  };

  // ── Round switch when screen is reused (navigation stale-state regression) ───
  //
  // React Navigation does NOT remount a screen when navigate() is called for a
  // screen already in the stack - it updates route.params in place. Before the
  // fix, useState(initialRound) only ran once on mount, so navigating from e.g.
  // Donington → Brands Hatch would leave stale Donington data on screen.

  const BRANDS_HATCH = {
    round: 2,
    venue: 'Brands Hatch Indy',
    races: [
      {
        label: 'Free Practice',
        results: [
          {driver: 'Ashley Sutton', position: 1, time: '1:22.000', team: 'NAPA Racing', points: 0, bestLap: '1:22.000', gap: null, laps: 10, fastestLap: false, leadLap: false, pole: false},
          {driver: 'Charles Rainford', position: 2, time: '1:22.500', team: 'WSR', points: 0, bestLap: '1:22.500', gap: '0.5', laps: 10, fastestLap: false, leadLap: false, pole: false},
        ],
      },
      {label: 'Qualifying',      results: []},
      {label: 'Qualifying Race', results: []},
      {label: 'Race 1',          results: []},
      {label: 'Race 2',          results: []},
      {label: 'Race 3',          results: []},
    ],
  };

  describe('round switch when screen is reused', () => {
    it('updates the venue header when navigated to a different round', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      const route1 = makeRoute({round: MOCK_ROUND, year: 2026, initialRace: 0, origin: 'calendar'});
      const {getByText, rerender} = renderWithProviders(
        <RoundResultsScreen navigation={nav} route={route1} />,
      );

      expect(getByText('Donington Park')).toBeTruthy();

      const route2 = makeRoute({round: BRANDS_HATCH, year: 2026, initialRace: 0, origin: 'calendar'});
      await act(async () => {
        rerender(<RoundResultsScreen navigation={nav} route={route2} />);
      });

      expect(getByText('Brands Hatch Indy')).toBeTruthy();
    });

    it('shows results from the new round after navigation', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      const route1 = makeRoute({round: MOCK_ROUND, year: 2026, initialRace: 0, origin: 'calendar'});
      const {getByText, queryByText, rerender} = renderWithProviders(
        <RoundResultsScreen navigation={nav} route={route1} />,
      );

      // Donington FP: Tom Ingram P1, no Ashley Sutton
      expect(getByText('Tom INGRAM')).toBeTruthy();
      expect(queryByText('Ashley SUTTON')).toBeNull();

      const route2 = makeRoute({round: BRANDS_HATCH, year: 2026, initialRace: 0, origin: 'calendar'});
      await act(async () => {
        rerender(<RoundResultsScreen navigation={nav} route={route2} />);
      });

      // Brands Hatch FP: Ashley Sutton P1, no Tom Ingram
      expect(getByText('Ashley SUTTON')).toBeTruthy();
      expect(queryByText('Tom INGRAM')).toBeNull();
    });

    it('does not reset state when params update with the same round number', async () => {
      // The useEffect is keyed on initialRound.round (integer). Passing a new
      // object reference for the same round (as the refresh path does) must not
      // cause a visible state reset.
      AsyncStorage.getItem.mockResolvedValue(null);
      const route1 = makeRoute({round: MOCK_ROUND, year: 2026, initialRace: 0, origin: 'results'});
      const {getByText, rerender} = renderWithProviders(
        <RoundResultsScreen navigation={nav} route={route1} />,
      );

      expect(getByText('Donington Park')).toBeTruthy();

      // Same round number, different object reference - should not flicker/reset
      const route2 = makeRoute({round: {...MOCK_ROUND}, year: 2026, initialRace: 0, origin: 'results'});
      await act(async () => {
        rerender(<RoundResultsScreen navigation={nav} route={route2} />);
      });

      expect(getByText('Donington Park')).toBeTruthy();
    });

    it('updates the race tabs when navigating to a round with different session data', async () => {
      // Brands Hatch only has FP with results - switching to it and pressing Race 1
      // should show an empty state, not Donington Race 1 results.
      AsyncStorage.getItem.mockResolvedValue(null);
      const route1 = makeRoute({round: MOCK_ROUND, year: 2026, initialRace: 3, origin: 'calendar'});
      const {queryByText, rerender} = renderWithProviders(
        <RoundResultsScreen navigation={nav} route={route1} />,
      );

      // Donington Race 1: Shedden P1 scores 21 pts
      expect(queryByText('+20 pts')).toBeTruthy();

      const route2 = makeRoute({round: BRANDS_HATCH, year: 2026, initialRace: 3, origin: 'calendar'});
      await act(async () => {
        rerender(<RoundResultsScreen navigation={nav} route={route2} />);
      });

      // Brands Hatch Race 1 has no results - points badge should be gone
      expect(queryByText('+20 pts')).toBeNull();
    });
  });

  describe('grid position deltas — Race 3 with actual TSL grid', () => {
    it('shows delta arrows when R3 has both grid and results', async () => {
      const {UNSAFE_queryAllByType} = renderRound({round: R3_WITH_GRID_ROUND, initialRace: 5});
      const {Text} = require('react-native');
      const deltaColours = new Set(['#4ADE80', '#F87171']);
      await waitFor(() => {
        const hasDelta = UNSAFE_queryAllByType(Text).some(el =>
          [].concat(el.props.style || []).some(s => deltaColours.has(s?.color)),
        );
        expect(hasDelta).toBe(true);
      });
    });

    it('uses grid position not previous-race derivation for R3 delta', async () => {
      // Tom started P1 on grid, finished P2 → delta should be -1 (red / downward)
      const {UNSAFE_queryAllByType} = renderRound({round: R3_WITH_GRID_ROUND, initialRace: 5});
      const {Text} = require('react-native');
      await waitFor(() => {
        const redDeltas = UNSAFE_queryAllByType(Text).filter(el =>
          [].concat(el.props.style || []).some(s => s?.color === '#F87171'),
        );
        expect(redDeltas.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Watch Full Race button', () => {
    const RACE_1_TAB = 3;

    it('shows for 2026 when bundled youtubeUrls are available', () => {
      const {queryByText} = renderRound({year: 2026, initialRace: RACE_1_TAB});
      expect(queryByText('Watch Full Race')).toBeTruthy();
    });

    it('does not show for a past year when round has no youtubeUrls', () => {
      const {queryByText} = renderRound({year: 2024, initialRace: RACE_1_TAB});
      expect(queryByText('Watch Full Race')).toBeNull();
    });

    it('shows for a past year when the round explicitly has youtubeUrls', () => {
      const roundWithUrls = {
        ...MOCK_ROUND,
        youtubeUrls: [null, null, null, 'https://www.youtube.com/watch?v=old_r1', null, null],
      };
      const {queryByText} = renderRound({round: roundWithUrls, year: 2024, initialRace: RACE_1_TAB});
      expect(queryByText('Watch Full Race')).toBeTruthy();
    });
  });

  describe('judicial decisions', () => {
    const PENALTY_ONE_LINER = 'Tom Ingram (No. 80): 5s time penalty - track limits';
    const PENALTY_PDF_URL = 'https://www.barc.net/wp-content/uploads/decision.pdf';
    const PENALTIES_RESPONSE = {
      season: '2026',
      rounds: [{
        round: 1, // matches MOCK_ROUND.round
        penalties: [{
          session: 'Free Practice', driver: 'Tom Ingram', carNo: 80,
          sanction: '5s time penalty', oneLiner: PENALTY_ONE_LINER, pdfUrl: PENALTY_PDF_URL,
        }],
      }],
    };

    // The default global fetch mock (jest.setup.js) resolves {} for every
    // URL - override just the penalties.json call so fetchResults' own
    // fetch (still hit by the results-refresh effect) is unaffected.
    function mockPenaltiesFetch(response = PENALTIES_RESPONSE) {
      global.fetch.mockImplementation((url) =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(url.includes('penalties') ? response : {}),
          text: () => Promise.resolve(''),
        }),
      );
    }

    it('shows the card on the session tab a penalty belongs to', async () => {
      mockPenaltiesFetch();
      const {findByText} = renderRound({initialRace: 0}); // Free Practice
      expect(await findByText(PENALTY_ONE_LINER)).toBeTruthy();
    });

    it('shows Facts/Offence/Decision as labelled fields when the scraper split them out, not the collapsed oneLiner', async () => {
      mockPenaltiesFetch({
        season: '2026',
        rounds: [{
          round: 1,
          penalties: [{
            session: 'Free Practice', driver: 'Tom Ingram', carNo: 80,
            facts: 'Contact was made with car 3 at turn 6',
            offence: 'NCR 12.7.1.8 Causing a collision',
            decision: 'Be penalised by the addition of 5 seconds to your race time.',
            sanction: '5s time penalty', oneLiner: PENALTY_ONE_LINER, pdfUrl: PENALTY_PDF_URL,
          }],
        }],
      });
      const {findByText, queryByText} = renderRound({initialRace: 0});
      expect(await findByText('Tom Ingram (No. 80)')).toBeTruthy();
      expect(await findByText('Contact was made with car 3 at turn 6')).toBeTruthy();
      expect(await findByText('NCR 12.7.1.8 Causing a collision')).toBeTruthy();
      expect(await findByText('Be penalised by the addition of 5 seconds to your race time.')).toBeTruthy();
      expect(queryByText(PENALTY_ONE_LINER)).toBeNull();
    });

    it('does not show a card on a session tab with no penalties of its own', async () => {
      mockPenaltiesFetch();
      const {findByText, queryByText} = renderRound({initialRace: 1}); // Qualifying
      await findByText('Tom INGRAM'); // wait for the fetch/render cycle to settle
      expect(queryByText(/Judicial Decision/)).toBeNull();
    });

    it('fires Analytics.penaltiesShown once the card renders', async () => {
      const {Analytics} = require('../../src/utils/analytics');
      mockPenaltiesFetch();
      const {findByText} = renderRound({initialRace: 0});
      await findByText(/Judicial Decision/);
      expect(Analytics.penaltiesShown).toHaveBeenCalledWith(1, 'Free Practice', 1);
    });

    it('opens the decision PDF and logs success on tap', async () => {
      const {Analytics} = require('../../src/utils/analytics');
      jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
      mockPenaltiesFetch();
      const {findByText} = renderRound({initialRace: 0});
      const link = await findByText('View decision →');
      await act(async () => fireEvent.press(link));
      await waitFor(() => expect(Linking.openURL).toHaveBeenCalledWith(PENALTY_PDF_URL));
      expect(Analytics.penaltyDocumentOpened).toHaveBeenCalledWith(1, 'Free Practice');
    });

    it('logs failure when the PDF link fails to open', async () => {
      const {Analytics} = require('../../src/utils/analytics');
      jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
      mockPenaltiesFetch();
      const {findByText} = renderRound({initialRace: 0});
      const link = await findByText('View decision →');
      await act(async () => fireEvent.press(link));
      await waitFor(() => expect(Analytics.penaltyDocumentOpenFailed).toHaveBeenCalledWith(1, 'Free Practice', 'no handler'));
    });
  });
});
