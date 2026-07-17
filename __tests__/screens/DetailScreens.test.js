import React from 'react';
import {act, fireEvent, waitFor} from '@testing-library/react-native';
import DriverDetailScreen from '../../src/screens/DriverDetailScreen';
import TeamDetailScreen from '../../src/screens/TeamDetailScreen';
import {renderWithProviders, makeNav, makeRoute} from './testUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: cb => { require('react').useEffect(cb, []); },
}));

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn(), favouriteToggled: jest.fn()},
}));

jest.mock('../../src/api/client', () => ({
  fetchResults: jest.fn(),
  fetchStandings: jest.fn(),
  fetchDrivers: jest.fn(),
}));

const {fetchResults, fetchStandings, fetchDrivers} = require('../../src/api/client');
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

const EMPTY_RESULTS = {rounds: []};

describe('DriverDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    fetchResults.mockResolvedValue(EMPTY_RESULTS);
    fetchStandings.mockResolvedValue({standings: []});
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

  // Regression: a driver reached via slug (deep link / share link) used to read
  // raw, unparsed JSON directly (no cls/cardBgUrl/lightCardBg, champion instead
  // of isChampion), silently losing the class chip, champion gold styling and
  // header background - while the exact same driver reached by tapping a card
  // (the `driver` param path, tested throughout this file) rendered correctly.
  it('deep-link (slug) navigation shows the same class chip as the normal navigation path', async () => {
    const rawTeams = [{name: 'WSR', cardBgUrl: 'https://example.com/wsr.png', lightCardBg: true}];
    const rawDriver = {
      name: 'A Driver', number: 29, team: 'WSR', class: 'I',
      history: [{year: 2020, team: 'WSR', champion: true}],
    };
    fetchDrivers.mockResolvedValue({drivers: [rawDriver], teams: rawTeams});

    const route = makeRoute({slug: 'a-driver'});
    const {getByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getByText('Independents')).toBeTruthy());
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

  it('shows stats badges using standings for pts/wins/podiums and results for FL', async () => {
    fetchStandings.mockResolvedValue({
      standings: [{driver: 'Lewis SELBY', points: 43, wins: 1, seconds: 1, thirds: 0, team: 'NAPA Racing UK'}],
    });
    fetchResults.mockResolvedValue({rounds: [{races: [
      {label: 'Race 1', results: [
        {driver: 'Lewis SELBY', pos: 1, points: 25, pole: true, fastestLap: true},
      ]},
      {label: 'Race 2', results: [
        {driver: 'Lewis SELBY', pos: 2, points: 18, pole: false, fastestLap: false},
      ]},
    ]}]});
    const route = makeRoute({driver: ROOKIE});
    const {getByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => {
      expect(getByText('43 pts')).toBeTruthy();  // from standings
      expect(getByText('1 W')).toBeTruthy();     // from standings
      expect(getByText('2 P')).toBeTruthy();     // from standings (wins + seconds)
      expect(getByText('1 FL')).toBeTruthy();    // from results
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

  it('shows standings pts/wins/podiums for a veteran driver', async () => {
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

  it('shows 0 pts badge when driver has a team but is not in standings', async () => {
    fetchStandings.mockResolvedValue({standings: []});
    const route = makeRoute({driver: ROOKIE});
    const {getByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getByText('0 pts')).toBeTruthy());
  });

  it('shows standings pts even when fetchResults fails', async () => {
    fetchStandings.mockResolvedValue({
      standings: [{driver: 'Lewis SELBY', points: 30, wins: 1, seconds: 0, thirds: 1, team: 'NAPA Racing UK'}],
    });
    fetchResults.mockRejectedValue(new Error('network error'));
    const route = makeRoute({driver: ROOKIE});
    const {getByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => {
      expect(getByText('30 pts')).toBeTruthy();
      expect(getByText('1 W')).toBeTruthy();
    });
  });

  it('shows 0 pts when both fetches fail', async () => {
    fetchStandings.mockRejectedValue(new Error('network error'));
    fetchResults.mockRejectedValue(new Error('network error'));
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
    fetchResults.mockResolvedValue(EMPTY_RESULTS);
    fetchStandings.mockResolvedValue({standings: []});
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

  it('renders CAR SPECS section when carSpecs are present', async () => {
    const teamWithSpecs = {
      ...TEAM,
      carSpecs: {
        Engine: '350+bhp 2-litre turbo direct-injection',
        Gearbox: 'Xtrac 6-speed sequential',
        Drive: 'Front-wheel drive',
      },
    };
    const route = makeRoute({team: teamWithSpecs});
    const {getByText} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => {
      expect(getByText('CAR SPECS')).toBeTruthy();
      expect(getByText('Engine')).toBeTruthy();
      expect(getByText('350+bhp 2-litre turbo direct-injection')).toBeTruthy();
      expect(getByText('Front-wheel drive')).toBeTruthy();
    });
  });

  it('does not render CAR SPECS section when carSpecs is absent', async () => {
    const route = makeRoute({team: TEAM});
    const {queryByText} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(queryByText('CAR SPECS')).toBeNull());
  });
});
