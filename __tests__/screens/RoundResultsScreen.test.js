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
      expect(queryByText('+25 pts')).toBeNull();

      await act(async () => {
        fireEvent.press(getByText('R1'));
      });
      // Race 1: Shedden wins 25 pts — only appears after switching to R1
      expect(getByText('+25 pts')).toBeTruthy();
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
        expect(getByText('+25 pts')).toBeTruthy();
      });
    });

    it('does not show points for Free Practice', () => {
      const {queryByText} = renderRound({initialRace: 0});
      expect(queryByText('+0 pts')).toBeNull();
      expect(queryByText('+25 pts')).toBeNull();
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
      expect(getByText('Race 2 results needed to predict grid')).toBeTruthy();
    });
  });
});
