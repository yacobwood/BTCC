import React from 'react';
import {act, fireEvent, waitFor} from '@testing-library/react-native';
import DriverDetailScreen from '../../src/screens/DriverDetailScreen';
import TeamDetailScreen from '../../src/screens/TeamDetailScreen';
import {renderWithProviders, makeNav, makeRoute} from './testUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn(), favouriteToggled: jest.fn()},
}));

jest.mock('../../src/api/client', () => ({
  fetchResults: jest.fn(),
}));

const {fetchResults} = require('../../src/api/client');

const nav = makeNav();

// ─── DriverDetailScreen ───────────────────────────────────────────────────────

const DRIVER = {
  name: 'Tom Ingram',
  number: 80,
  team: 'Team Ingram',
  nationality: 'British',
  dob: '1994-06-26',
  bio: 'Tom Ingram is a multiple BTCC champion.',
  history: [
    {year: 2024, team: 'Team Ingram', wins: 3, podiums: 8, points: 250},
    {year: 2023, team: 'Team Ingram', wins: 2, podiums: 6, points: 200},
  ],
  imageUrl: null,
  cardBgUrl: null,
};

const DRIVER_NO_TEAM = {
  ...DRIVER,
  team: null,
  history: [],
};

describe('DriverDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    fetchResults.mockResolvedValue({rounds: []});
  });

  it('displays the driver name', async () => {
    const route = makeRoute({driver: DRIVER});
    const {getByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getByText(/Tom Ingram/)).toBeTruthy());
  });

  it('displays the driver bio', async () => {
    const route = makeRoute({driver: DRIVER});
    const {getByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getByText('Tom Ingram is a multiple BTCC champion.')).toBeTruthy());
  });

  it('displays the team name', async () => {
    const route = makeRoute({driver: DRIVER});
    const {getAllByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getAllByText('Team Ingram').length).toBeGreaterThan(0));
  });

  it('shows career history year entries', async () => {
    const route = makeRoute({driver: DRIVER});
    const {getByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => {
      expect(getByText('2024')).toBeTruthy();
      expect(getByText('2023')).toBeTruthy();
    });
  });

  it('toggles favourite when star button is pressed', async () => {
    AsyncStorage.getItem.mockImplementation(key => {
      if (key === 'favourite_drivers') return Promise.resolve(JSON.stringify([]));
      return Promise.resolve(null);
    });
    const route = makeRoute({driver: DRIVER});
    const {getByLabelText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => getByLabelText(/favourite/i));
    fireEvent.press(getByLabelText(/favourite/i));
    // After pressing, AsyncStorage should be updated
    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  it('does not crash when history is empty and no team', async () => {
    const route = makeRoute({driver: DRIVER_NO_TEAM});
    const {getByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getByText(/Tom Ingram/)).toBeTruthy());
  });

  it('does not count a QR win as an official win in 2026 live stats', async () => {
    fetchResults.mockResolvedValue({
      rounds: [{
        races: [
          // QR P1 — should NOT count as a win
          {label: 'Qualifying Race', results: [{pos: 1, driver: 'Tom Ingram', team: 'Team Ingram', points: 10, bestLap: ''}]},
          // Race 1 P3 — not a win, but is a podium
          {label: 'Race 1', results: [{pos: 3, driver: 'Tom Ingram', team: 'Team Ingram', points: 15, bestLap: ''}]},
        ],
      }],
    });
    const route = makeRoute({driver: DRIVER});
    const {queryByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    // wins = 0 (QR excluded) → "1 W" badge must not appear
    await waitFor(() => expect(queryByText('1 W')).toBeNull());
  });

  it('does not count a QR podium in 2026 live stats', async () => {
    fetchResults.mockResolvedValue({
      rounds: [{
        races: [
          // QR P2 — should NOT count as a podium
          {label: 'Qualifying Race', results: [{pos: 2, driver: 'Tom Ingram', team: 'Team Ingram', points: 9, bestLap: ''}]},
        ],
      }],
    });
    const route = makeRoute({driver: DRIVER});
    const {queryByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    // podiums = 0 → "1 P" badge must not appear
    await waitFor(() => expect(queryByText('1 P')).toBeNull());
  });
});

// ─── TeamDetailScreen ─────────────────────────────────────────────────────────

const TEAM = {
  name: 'Team Ingram',
  car: 'Toyota GR Yaris',
  founded: 2015,
  base: 'Northampton',
  entries: 2,
  bio: 'A leading BTCC outfit.',
  cardBgUrl: null,
  carImageUrl: null,
  drivers: [
    {name: 'Tom Ingram',  number: 80, imageUrl: null},
    {name: 'Dan Lloyd',   number: 81, imageUrl: null},
  ],
};

describe('TeamDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  it('displays the team name', async () => {
    const route = makeRoute({team: TEAM});
    const {getByText} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getByText('Team Ingram')).toBeTruthy());
  });

  it('displays the car name', async () => {
    const route = makeRoute({team: TEAM});
    const {getByText} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getByText('Toyota GR Yaris')).toBeTruthy());
  });

  it('displays team bio', async () => {
    const route = makeRoute({team: TEAM});
    const {getByText} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getByText('A leading BTCC outfit.')).toBeTruthy());
  });

  it('lists each driver by name', async () => {
    const route = makeRoute({team: TEAM});
    const {getByText} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    // formatDriverName uppercases the surname: "Tom Ingram" → "Tom INGRAM"
    await waitFor(() => {
      expect(getByText('Tom INGRAM')).toBeTruthy();
      expect(getByText('Dan LLOYD')).toBeTruthy();
    });
  });

  it('navigates to DriverDetail when a driver card is pressed', async () => {
    const route = makeRoute({team: TEAM});
    const {getByLabelText} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => getByLabelText('Tom Ingram'));
    fireEvent.press(getByLabelText('Tom Ingram'));
    expect(nav.navigate).toHaveBeenCalledWith('DriverDetail', {
      driver: expect.objectContaining({name: 'Tom Ingram'}),
    });
  });

  it('shows founded year in stats', async () => {
    const route = makeRoute({team: TEAM});
    const {getByText} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getByText('2015')).toBeTruthy());
  });

  it('shows base location in stats', async () => {
    const route = makeRoute({team: TEAM});
    const {getByText} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getByText('Northampton')).toBeTruthy());
  });
});
