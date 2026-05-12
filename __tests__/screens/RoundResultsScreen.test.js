import React from 'react';
import {act, fireEvent, waitFor} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RoundResultsScreen from '../../src/screens/RoundResultsScreen';
import {renderWithProviders, makeNav, makeRoute, MOCK_ROUND} from './testUtils';

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
      expect(queryByText('+21 pts')).toBeNull();

      await act(async () => {
        fireEvent.press(getByText('R1'));
      });
      // Race 1: Shedden wins (20 pts) + FL bonus (1 pt) = 21 pts
      expect(getByText('+21 pts')).toBeTruthy();
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

    it('shows points for a race session', async () => {
      const {getByText} = renderRound({initialRace: 3}); // Race 1
      await waitFor(() => {
        expect(getByText('+21 pts')).toBeTruthy();
      });
    });

    it('does not show points for Free Practice', () => {
      const {queryByText} = renderRound({initialRace: 0});
      expect(queryByText('+0 pts')).toBeNull();
      expect(queryByText('+21 pts')).toBeNull();
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
      expect(queryByText('+21 pts')).toBeTruthy();

      const route2 = makeRoute({round: BRANDS_HATCH, year: 2026, initialRace: 3, origin: 'calendar'});
      await act(async () => {
        rerender(<RoundResultsScreen navigation={nav} route={route2} />);
      });

      // Brands Hatch Race 1 has no results - points badge should be gone
      expect(queryByText('+21 pts')).toBeNull();
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
});
