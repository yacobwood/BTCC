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

  it('shows nationality, team, car and class as labelled key-fact tiles (same style as TeamDetailScreen)', async () => {
    const driver = {...DRIVER, car: 'Toyota GR Yaris', cls: 'I'};
    const route = makeRoute({driver});
    const {getByText, getAllByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => {
      expect(getByText('Nationality')).toBeTruthy();
      expect(getByText('British')).toBeTruthy();
      expect(getByText('Team')).toBeTruthy();
      expect(getAllByText('Team Ingram').length).toBeGreaterThan(0);
      expect(getByText('Car')).toBeTruthy();
      expect(getAllByText('Toyota GR Yaris').length).toBeGreaterThan(0);
      expect(getByText('Class')).toBeTruthy();
      expect(getByText('Independents')).toBeTruthy();
    });
  });

  it('hides the Car/Class tile row entirely when the driver has neither', async () => {
    // DRIVER has no car/cls set - the second key-facts row must not render
    // (previously the chip row simply omitted whichever chips were absent;
    // an empty tile row would look broken rather than just being absent).
    const route = makeRoute({driver: DRIVER});
    const {queryByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => {
      expect(queryByText('Car')).toBeNull();
      expect(queryByText('Class')).toBeNull();
    });
  });

  it('displays the Lives in row when livesIn is set', async () => {
    const route = makeRoute({driver: {...DRIVER, livesIn: 'Coventry'}});
    const {getByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => {
      expect(getByText('Lives in')).toBeTruthy();
      expect(getByText('Coventry')).toBeTruthy();
    });
  });

  it('does not render the Lives in row when livesIn is absent', async () => {
    const route = makeRoute({driver: DRIVER});
    const {queryByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(queryByText('Lives in')).toBeNull());
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

  it('extends the career chart Y-axis past P20 when a season position is worse', async () => {
    // Regression: the chart's gridlines/labels used to be a hardcoded
    // [1, 5, 10, 15, 20] array that could only be filtered down, never
    // extended - a driver with a season finish worse than P20 (e.g. a
    // backmarker season) plotted correctly but with no nearby gridline.
    const driver = {
      ...DRIVER,
      history: [
        {year: 2019, team: 'X', pos: 19},
        {year: 2020, team: 'X', pos: 12},
        {year: 2021, team: 'X', pos: 33},
      ],
    };
    const route = makeRoute({driver});
    const {getByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getByText('P30')).toBeTruthy());
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

  it('header number graphic uses CachedImage when numberImageUrl is set', async () => {
    const route = makeRoute({driver: {...DRIVER, numberImageUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/numberImages/80.png'}});
    const {getAllByTestId} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getAllByTestId('cached-image').length).toBeGreaterThanOrEqual(1));
  });

  it('falls back to the plain-text number when numberImageUrl is absent', async () => {
    const route = makeRoute({driver: DRIVER});
    const {getByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getByText('80')).toBeTruthy());
  });

  // Full-width banner below the name row (see DriversScreen's history for
  // why the car renders per-driver rather than a shared team image at all).
  // Requests the -thumb-crop variant, not the plain -thumb TeamDetailScreen
  // uses - this banner has no logo overlay to keep clear of, so it can crop
  // out the padding TeamDetailScreen's cars deliberately keep.
  it("shows the driver's own car via CachedImage, requesting the -thumb-crop variant", async () => {
    const route = makeRoute({driver: {
      ...DRIVER,
      carImageUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/ingram.webp',
    }});
    const {getAllByTestId} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => {
      const carImage = getAllByTestId('cached-image').find(img => img.props.source.uri?.includes('carImages'));
      expect(carImage).toBeTruthy();
      expect(carImage.props.source.uri).toBe(
        'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/ingram-thumb-crop.webp',
      );
    });
  });

  it('shows no car image when carImageUrl is absent', async () => {
    const route = makeRoute({driver: DRIVER});
    const {queryAllByTestId, getByText} = renderWithProviders(
      <DriverDetailScreen route={route} navigation={nav} />,
    );
    // Wait for the screen to actually finish rendering before asserting an
    // absence, or this could pass vacuously before data even loads.
    await waitFor(() => expect(getByText(/Tom Ingram/)).toBeTruthy());
    const carImages = queryAllByTestId('cached-image').filter(img => img.props.source.uri?.includes('carImages'));
    expect(carImages.length).toBe(0);
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

  it('shows the Cars tile on its own second row, even when the team has no race results yet', async () => {
    // Cars moved off the Founded/Base row (which now only fits those two) onto
    // the same row as Races/Wins - but Cars must still render when a brand new
    // team hasn't raced yet and Races/Wins are hidden.
    const newTeam = {...TEAM, totalRaces: 0, totalWins: 0};
    const route = makeRoute({team: newTeam});
    const {getByText, queryByText} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getByText('Cars')).toBeTruthy());
    expect(queryByText('Races')).toBeNull();
    expect(queryByText('Wins')).toBeNull();
  });

  it('gives the Base stat tile extra width so long "Town, County" values don\'t wrap mid-word', async () => {
    // Regression test: "Wellingborough, Northamptonshire" (CPRL) was wrapping
    // across 3 lines and breaking "Northamptonshire" mid-word because the Base
    // tile shared equal flex with the much shorter Founded/Cars tiles.
    const teamWithLongBase = {...TEAM, base: 'Wellingborough, Northamptonshire'};
    const route = makeRoute({team: teamWithLongBase});
    const {UNSAFE_getAllByType} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    const {View} = require('react-native');
    await waitFor(() => {
      const baseBox = UNSAFE_getAllByType(View).find(v =>
        [].concat(v.props.children || []).some(
          c => c?.props?.children === 'Wellingborough, Northamptonshire',
        ),
      );
      expect(baseBox).toBeTruthy();
      const flatStyle = [].concat(baseBox.props.style || []);
      expect(flatStyle.some(s => (s?.flex || 0) >= 2)).toBe(true);
    });
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

  it('renders SPONSORS section grouped by tier when sponsors are present', async () => {
    const teamWithSponsors = {
      ...TEAM,
      sponsors: [
        {name: 'Acme Racing', tier: 'principal'},
        {name: 'Widgets Co', tier: 'technical'},
        {name: 'Tiny Decal Ltd', tier: 'decal'},
      ],
    };
    const route = makeRoute({team: teamWithSponsors});
    const {getByText} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => {
      expect(getByText('SPONSORS')).toBeTruthy();
      expect(getByText('PRINCIPAL PARTNERS')).toBeTruthy();
      expect(getByText('Acme Racing')).toBeTruthy();
      expect(getByText('TECHNICAL PARTNERS')).toBeTruthy();
      expect(getByText('Widgets Co')).toBeTruthy();
      expect(getByText('ALSO ON THE CAR')).toBeTruthy();
      expect(getByText('Tiny Decal Ltd')).toBeTruthy();
    });
    // A tier with no sponsors in this team shouldn't get an empty group heading.
    expect(getByText('SPONSORS')).toBeTruthy();
  });

  it('does not render an ASSOCIATE PARTNERS heading when no sponsor has that tier', async () => {
    const teamWithSponsors = {...TEAM, sponsors: [{name: 'Acme Racing', tier: 'principal'}]};
    const route = makeRoute({team: teamWithSponsors});
    const {queryByText} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(queryByText('ASSOCIATE PARTNERS')).toBeNull());
  });

  it('renders the sponsorsNote caveat text when present, even with an empty sponsors list', async () => {
    // e.g. CPRL post-restructuring: livery in flux, nothing confirmed yet to list.
    const teamInFlux = {...TEAM, sponsors: [], sponsorsNote: "Livery in flux, check back soon."};
    const route = makeRoute({team: teamInFlux});
    const {getByText} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => {
      expect(getByText('SPONSORS')).toBeTruthy();
      expect(getByText('Livery in flux, check back soon.')).toBeTruthy();
    });
  });

  it('does not render SPONSORS section when sponsors is empty and there is no sponsorsNote', async () => {
    const route = makeRoute({team: TEAM});
    const {queryByText} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(queryByText('SPONSORS')).toBeNull());
  });

  it('driver photo uses CachedImage when imageUrl is set and no bundled image exists', async () => {
    // getDriverImage is mocked to return null (jest.setup.js), so imageUrl triggers CachedImage.
    // Regression: this used to be a raw <Image> requesting a hardcoded "-300x300" WordPress
    // thumbnail suffix with no fallback - a 404 on that specific size (as happened for Ryan
    // Bensley's photo) silently rendered nothing. CachedImage retries the full-size original.
    const teamWithPhoto = {
      ...TEAM,
      drivers: [{name: 'Tom Ingram', number: 80, imageUrl: 'https://btcc.net/wp-content/uploads/driver.jpg'}],
    };
    const route = makeRoute({team: teamWithPhoto});
    const {getAllByTestId} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getAllByTestId('cached-image').length).toBeGreaterThanOrEqual(1));
  });

  it('driver number graphic uses CachedImage when numberImageUrl is set', async () => {
    const teamWithNumberImage = {
      ...TEAM,
      drivers: [{name: 'Tom Ingram', number: 80, numberImageUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/numberImages/80.png'}],
    };
    const route = makeRoute({team: teamWithNumberImage});
    const {getAllByTestId} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getAllByTestId('cached-image').length).toBeGreaterThanOrEqual(1));
  });

  it('team sponsor logo renders on the hero, centered above the car grid, when logoUrl is set', async () => {
    // The hero mounts whenever there's a logo or at least one driver car to show
    // (see TeamDetailScreen.js) - logoUrl alone is enough here, no car needed.
    const teamWithLogo = {
      ...TEAM,
      logoUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/logoImages/team-ingram.png',
    };
    const route = makeRoute({team: teamWithLogo});
    const {getAllByTestId} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => expect(getAllByTestId('cached-image').length).toBeGreaterThanOrEqual(1));
  });

  it('no logo image renders on the hero when logoUrl is absent', async () => {
    const teamWithCarOnly = {
      ...TEAM,
      drivers: [{name: 'Tom Ingram', number: 80, imageUrl: null, carImageUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/ingram.png'}],
    };
    const route = makeRoute({team: teamWithCarOnly});
    const {getAllByTestId} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    // Just the driver's car image - no separate logo CachedImage without logoUrl.
    await waitFor(() => {
      const images = getAllByTestId('cached-image');
      expect(images.some(img => img.props.source.uri?.includes('logoImages'))).toBe(false);
      expect(images.some(img => img.props.source.uri?.includes('carImages'))).toBe(true);
    });
  });

  // A team's hero used to show one carImageUrl representing the whole team;
  // it now shows one card per active driver's OWN car (team.drivers, already
  // filtered to the current non-reserve roster by parseGrid) - accurate for
  // a team fielding more than one livery, e.g. Steel Seal with Power Maxed
  // Racing's Dexter Patterson vs. Nick Halstead's separately-liveried "Ask GVT" car.
  describe('hero shows each driver\'s own car', () => {
    it("renders one car image per driver, using each driver's own carImageUrl", async () => {
      const teamWithTwoCars = {
        ...TEAM,
        drivers: [
          {name: 'Dexter Patterson', number: 17, imageUrl: null, carImageUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/patterson.png'},
          {name: 'Nick Halstead',    number: 55, imageUrl: null, carImageUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/halstead.webp'},
        ],
      };
      const route = makeRoute({team: teamWithTwoCars});
      const {getAllByTestId} = renderWithProviders(
        <TeamDetailScreen route={route} navigation={nav} />,
      );
      await waitFor(() => {
        const carUris = getAllByTestId('cached-image')
          .map(img => img.props.source.uri)
          .filter(uri => uri?.includes('carImages'));
        // Rewritten to the -thumb variant (see TeamDetailScreen.js's
        // carThumbUrl) - a car card here only ever renders at a couple
        // hundred px, not the full-size original's 1536x1024.
        expect(carUris.sort()).toEqual([
          'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/halstead-thumb.webp',
          'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/patterson-thumb.png',
        ]);
      });
    });

    // Regression guard: a driver-name caption used to sit under each car
    // cutout, but it read poorly against some teams' hero backgrounds (e.g.
    // NAPA Racing UK's gold) and was removed 2026-08-22, by request. Each
    // driver's name still appears once, in the DRIVERS grid further down -
    // just not duplicated here.
    it('does not show a driver-name caption under each car', async () => {
      const teamWithTwoCars = {
        ...TEAM,
        drivers: [
          {name: 'Dexter Patterson', number: 17, imageUrl: null, carImageUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/patterson.png'},
          {name: 'Nick Halstead',    number: 55, imageUrl: null, carImageUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/halstead.webp'},
        ],
      };
      const route = makeRoute({team: teamWithTwoCars});
      const {getAllByText} = renderWithProviders(
        <TeamDetailScreen route={route} navigation={nav} />,
      );
      // formatDriverName uppercases the surname - each name should appear
      // exactly once (the DRIVERS grid entry), not twice (grid + caption).
      await waitFor(() => {
        expect(getAllByText('Dexter PATTERSON').length).toBe(1);
        expect(getAllByText('Nick HALSTEAD').length).toBe(1);
      });
    });

    it('skips a driver with no carImageUrl of their own (e.g. a reserve with no car cutout yet)', async () => {
      const teamWithOneCarMissing = {
        ...TEAM,
        drivers: [
          {name: 'Tom Ingram', number: 80, imageUrl: null, carImageUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/ingram.png'},
          {name: 'Max Buxton', number: 19, imageUrl: null, carImageUrl: ''},
        ],
      };
      const route = makeRoute({team: teamWithOneCarMissing});
      const {getAllByTestId} = renderWithProviders(
        <TeamDetailScreen route={route} navigation={nav} />,
      );
      await waitFor(() => {
        const carUris = getAllByTestId('cached-image')
          .map(img => img.props.source.uri)
          .filter(uri => uri?.includes('carImages'));
        expect(carUris).toEqual(['https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/ingram-thumb.png']);
      });
    });

    it('shows the hero with no car cards when no driver has a carImageUrl and there is no logo either', async () => {
      const teamWithNeither = {...TEAM, drivers: [{name: 'Max Buxton', number: 19, imageUrl: null, carImageUrl: ''}]};
      const route = makeRoute({team: teamWithNeither});
      const {queryAllByTestId} = renderWithProviders(
        <TeamDetailScreen route={route} navigation={nav} />,
      );
      await waitFor(() => {
        const carUris = queryAllByTestId('cached-image')
          .map(img => img.props.source.uri)
          .filter(uri => uri?.includes('carImages'));
        expect(carUris).toEqual([]);
      });
    });
  });

  it('uses the standard, larger logo box on the hero when team.smallLogo is not set', async () => {
    const teamWithLogo = {
      ...TEAM,
      logoUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/logoImages/team-ingram.png',
    };
    const route = makeRoute({team: teamWithLogo});
    const {getAllByTestId} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => {
      const logoImg = getAllByTestId('cached-image').find(img => img.props.source.uri.includes('logoImages'));
      expect(logoImg.props.style.width).toBe('55%');
    });
  });

  it('uses the smaller logo box on the hero when team.smallLogo is set (e.g. Steel Seal)', async () => {
    // Regression test: shrinking teamLogoImg directly (instead of adding this
    // dedicated smallLogo-only override) shrank every other team's hero logo
    // too - reported live after the first attempt at this fix.
    const teamWithSmallLogo = {
      ...TEAM,
      logoUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/logoImages/team-ingram.png',
      smallLogo: true,
    };
    const route = makeRoute({team: teamWithSmallLogo});
    const {getAllByTestId} = renderWithProviders(
      <TeamDetailScreen route={route} navigation={nav} />,
    );
    await waitFor(() => {
      const logoImg = getAllByTestId('cached-image').find(img => img.props.source.uri.includes('logoImages'));
      expect(logoImg.props.style.width).toBe('45%');
    });
  });
});
