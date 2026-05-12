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
  fetchStandings: jest.fn(),
}));

const {fetchStandings} = require('../../src/api/client');
const REAL_DRIVERS = require('../../data/drivers.json').drivers;

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

const EMPTY_STANDINGS = {standings: []};

describe('DriverDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    fetchStandings.mockResolvedValue(EMPTY_STANDINGS);
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

  // Rookie driver - the bug: history.length === 0 used to hide the entire SEASON HISTORY section
  const ROOKIE = {
    name: 'Lewis Selby',
    number: 11,
    team: 'NAPA Racing UK',
    nationality: 'British',
    history: [],
    imageUrl: null,
    cardBgUrl: null,
  };

  it('shows SEASON HISTORY heading for a rookie driver (no prior history)', async () => {
    const route = makeRoute({driver: ROOKIE});
    const {getByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getByText('SEASON HISTORY')).toBeTruthy());
  });

  it('shows 2026 IN PROGRESS card for a rookie driver', async () => {
    const route = makeRoute({driver: ROOKIE});
    const {getByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => {
      expect(getByText('2026')).toBeTruthy();
      expect(getByText('IN PROGRESS')).toBeTruthy();
    });
  });

  it('shows stats badges for a rookie driver from standings data', async () => {
    fetchStandings.mockResolvedValue({
      standings: [{driver: 'Lewis SELBY', points: 43, wins: 1, seconds: 1, thirds: 0, team: 'NAPA Racing UK'}],
    });
    const route = makeRoute({driver: ROOKIE});
    const {getByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => {
      expect(getByText('43 pts')).toBeTruthy();
      expect(getByText('1 W')).toBeTruthy();
      expect(getByText('2 P')).toBeTruthy(); // wins + seconds + thirds = 1+1+0
    });
  });

  it('does NOT show BTCC CAREER section for a rookie driver (no history)', async () => {
    const route = makeRoute({driver: ROOKIE});
    const {queryByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(queryByText('BTCC CAREER')).toBeNull());
  });

  it('shows both BTCC CAREER and SEASON HISTORY for a veteran driver', async () => {
    const route = makeRoute({driver: DRIVER});
    const {getByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => {
      expect(getByText('BTCC CAREER')).toBeTruthy();
      expect(getByText('SEASON HISTORY')).toBeTruthy();
    });
  });

  it('shows stats badges for a veteran driver using standings', async () => {
    fetchStandings.mockResolvedValue({
      standings: [{driver: 'Tom INGRAM', points: 87, wins: 4, seconds: 1, thirds: 2, team: 'Team Ingram'}],
    });
    const route = makeRoute({driver: DRIVER});
    const {getByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => {
      expect(getByText('87 pts')).toBeTruthy(); // unique: historical rows show 250/200 pts
      expect(getByText('4 W')).toBeTruthy();    // unique: historical rows show 3W and 2W
      expect(getByText('7 P')).toBeTruthy();    // wins(4) + seconds(1) + thirds(2)
    });
  });

  it('shows 0 pts badge when driver is in standings with no points yet', async () => {
    fetchStandings.mockResolvedValue({
      standings: [{driver: 'Lewis SELBY', points: 0, wins: 0, seconds: 0, thirds: 0, team: 'NAPA Racing UK'}],
    });
    const route = makeRoute({driver: ROOKIE});
    const {getByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getByText('0 pts')).toBeTruthy());
  });

  it('shows 0 pts badge when driver is active but not yet in standings feed', async () => {
    // e.g. Árón Taylor-Smith has a team but 0 pts and isn't listed in standings.json yet
    fetchStandings.mockResolvedValue({standings: []});
    const route = makeRoute({driver: ROOKIE});
    const {getByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getByText('0 pts')).toBeTruthy());
  });
});

// ─── All real drivers smoke test ──────────────────────────────────────────────

describe('DriverDetailScreen - all real drivers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    fetchStandings.mockResolvedValue(EMPTY_STANDINGS);
  });

  const navSmoke = makeNav();

  REAL_DRIVERS.forEach(driver => {
    it(`renders without crashing: ${driver.name} (history years: ${(driver.history || []).map(h => h.year).join(', ') || 'none'})`, async () => {
      const route = makeRoute({driver});
      const {getByText, getAllByText} = renderWithProviders(
        <DriverDetailScreen route={route} navigation={navSmoke} />,
      );
      await waitFor(() => expect(getAllByText(new RegExp(driver.name.split(' ')[0])).length).toBeGreaterThan(0));
      // Active drivers must show SEASON HISTORY
      if (driver.team) {
        await waitFor(() => expect(getByText('SEASON HISTORY')).toBeTruthy());
      }
    });
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
