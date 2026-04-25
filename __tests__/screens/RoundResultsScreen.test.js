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
      const {getByText} = renderRound({initialRace: 0});
      // FP: Ingram P1
      expect(getByText('Tom INGRAM')).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByText('R1'));
      });
      // Race 1: Shedden P1
      expect(getByText('Gordon SHEDDEN')).toBeTruthy();
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
});
