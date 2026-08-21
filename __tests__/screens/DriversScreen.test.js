import React from 'react';
import {act, fireEvent} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DriversScreen from '../../src/screens/DriversScreen';
import {renderWithProviders, makeNav, MOCK_GRID, MOCK_DRIVERS_RAW} from './testUtils';

jest.mock('../../src/api/client', () => ({fetchDrivers: jest.fn()}));
jest.mock('../../src/api/parsers', () => ({parseGrid: jest.fn()}));

const {fetchDrivers} = require('../../src/api/client');
const {parseGrid}    = require('../../src/api/parsers');
const nav = makeNav();

// Renders the screen and waits until loading completes
async function renderDrivers({grid = MOCK_GRID, favourites = []} = {}) {
  AsyncStorage.getItem.mockImplementation((key) => {
    if (key === 'favourite_drivers') return Promise.resolve(JSON.stringify(favourites));
    return Promise.resolve(null);
  });
  fetchDrivers.mockResolvedValue([]);
  parseGrid.mockReturnValue(grid);

  const utils = renderWithProviders(<DriversScreen navigation={nav} />);
  // Wait for the post-load confirmed count to appear
  await utils.findByText(`${grid.drivers.length} CONFIRMED`);
  return utils;
}

describe('DriversScreen', () => {
  describe('driver grid', () => {
    it('renders driver names after load', async () => {
      const {getByText} = await renderDrivers();
      expect(getByText('Tom INGRAM')).toBeTruthy();
      expect(getByText('Gordon SHEDDEN')).toBeTruthy();
    });

    it('shows the confirmed driver count', async () => {
      const {getByText} = await renderDrivers();
      expect(getByText(`${MOCK_GRID.drivers.length} CONFIRMED`)).toBeTruthy();
    });

    it('renders driver cards as pressable buttons', async () => {
      const {getByLabelText} = await renderDrivers();
      expect(getByLabelText('Tom Ingram, Team Ingram, number 80')).toBeTruthy();
    });

    it('pressing a driver card navigates to DriverDetail', async () => {
      const {getByLabelText} = await renderDrivers();
      await act(async () => {
        fireEvent.press(getByLabelText('Tom Ingram, Team Ingram, number 80'));
      });
      expect(nav.navigate).toHaveBeenCalledWith('DriverDetail', expect.objectContaining({
        driver: expect.objectContaining({name: 'Tom Ingram'}),
      }));
    });
  });

  describe('favourite driver highlighting', () => {
    it('non-favourite driver name is not yellow', async () => {
      const {getByText} = await renderDrivers({favourites: []});
      expect(getByText('Tom INGRAM')).not.toHaveStyle({color: '#FEBD02'});
    });

    it('favourite driver name is yellow', async () => {
      const {getByText} = await renderDrivers({favourites: ['Tom Ingram']});
      expect(getByText('Tom INGRAM')).toHaveStyle({color: '#FEBD02'});
    });

    it('multiple favourites are all highlighted', async () => {
      const {getByText} = await renderDrivers({favourites: ['Tom Ingram', 'Gordon Shedden']});
      expect(getByText('Tom INGRAM')).toHaveStyle({color: '#FEBD02'});
      expect(getByText('Gordon SHEDDEN')).toHaveStyle({color: '#FEBD02'});
    });

    it('non-faved driver is not highlighted when others are faved', async () => {
      const {getByText} = await renderDrivers({favourites: ['Tom Ingram']});
      expect(getByText('Gordon SHEDDEN')).not.toHaveStyle({color: '#FEBD02'});
    });

    it('favourite matching is case-insensitive', async () => {
      const {getByText} = await renderDrivers({favourites: ['Tom INGRAM']});
      expect(getByText('Tom INGRAM')).toHaveStyle({color: '#FEBD02'});
    });
  });

  describe('tabs', () => {
    it('renders DRIVERS and TEAMS tab labels', async () => {
      const {getByText} = await renderDrivers();
      expect(getByText('DRIVERS')).toBeTruthy();
      expect(getByText('TEAMS')).toBeTruthy();
    });

    it('switching to TEAMS tab shows team count', async () => {
      const {getByText, getByLabelText} = await renderDrivers();
      await act(async () => {
        fireEvent.press(getByLabelText('TEAMS tab'));
      });
      expect(getByText(`${MOCK_GRID.teams.length} TEAMS`)).toBeTruthy();
    });

    it('team names are shown in the teams tab', async () => {
      const {getByText, getByLabelText} = await renderDrivers();
      await act(async () => {
        fireEvent.press(getByLabelText('TEAMS tab'));
      });
      expect(getByText('Team Ingram')).toBeTruthy();
    });

    it('driver names remain in the tree after switching to teams tab and back', async () => {
      const {getByText, getByLabelText} = await renderDrivers();
      await act(async () => { fireEvent.press(getByLabelText('TEAMS tab')); });
      await act(async () => { fireEvent.press(getByLabelText('DRIVERS tab')); });
      // Drivers must still be present — offscreenPageLimit keeps the page mounted
      expect(getByText('Tom INGRAM')).toBeTruthy();
    });
  });

  describe('not currently racing section', () => {
    // A driver who's moved out of their seat mid-season (e.g. to a reserve
    // role) keeps their profile and last team, but drops out of the main
    // "CONFIRMED" grid into a separate section below it - never removed
    // outright, since they did race this season.
    const gridWithPastDriver = {
      ...MOCK_GRID,
      drivers: [
        ...MOCK_DRIVERS_RAW,
        {name: 'Max Buxton', number: 21, team: 'Speedworks Corolla Racing', imageUrl: null, cardBgUrl: null, currentlyRacing: false},
      ],
    };

    it('active drivers are counted separately from a past driver', async () => {
      parseGrid.mockReturnValue(gridWithPastDriver);
      const utils = renderWithProviders(<DriversScreen navigation={nav} />);
      await utils.findByText(`${MOCK_DRIVERS_RAW.length} CONFIRMED`);
      expect(utils.getByText('NOT CURRENTLY RACING · RACED IN 2026')).toBeTruthy();
    });

    it('past driver still renders as a pressable card', async () => {
      parseGrid.mockReturnValue(gridWithPastDriver);
      const {getByLabelText, findByText} = renderWithProviders(<DriversScreen navigation={nav} />);
      await findByText(`${MOCK_DRIVERS_RAW.length} CONFIRMED`);
      expect(getByLabelText('Max Buxton, Speedworks Corolla Racing, number 21')).toBeTruthy();
    });

    it('past drivers section is absent when every driver is currently racing', async () => {
      const {queryByText} = await renderDrivers();
      expect(queryByText('NOT CURRENTLY RACING · RACED IN 2026')).toBeNull();
    });
  });

  describe('reserve-only driver', () => {
    // A one-off reserve/stand-in appearance (e.g. Senna Proctor covering Sam
    // Osborne's seat for a single round) never held a full-season grid spot,
    // so unlike the "not currently racing" case above they get no tile at
    // all - not in CONFIRMED, not in the past-drivers section either - even
    // though they still show up in the points standings (a separate,
    // drivers.json-independent data source).
    const gridWithReserveDriver = {
      ...MOCK_GRID,
      drivers: [
        ...MOCK_DRIVERS_RAW,
        {name: 'Senna Proctor', number: 18, team: 'NAPA Racing UK', imageUrl: null, cardBgUrl: null, reserveOnly: true},
      ],
    };

    it('is excluded from the CONFIRMED count', async () => {
      parseGrid.mockReturnValue(gridWithReserveDriver);
      const utils = renderWithProviders(<DriversScreen navigation={nav} />);
      await utils.findByText(`${MOCK_DRIVERS_RAW.length} CONFIRMED`);
    });

    it('renders no card anywhere on the screen', async () => {
      parseGrid.mockReturnValue(gridWithReserveDriver);
      const utils = renderWithProviders(<DriversScreen navigation={nav} />);
      await utils.findByText(`${MOCK_DRIVERS_RAW.length} CONFIRMED`);
      expect(utils.queryByLabelText('Senna Proctor, NAPA Racing UK, number 18')).toBeNull();
    });

    it('does not trigger the "not currently racing" section on its own', async () => {
      parseGrid.mockReturnValue(gridWithReserveDriver);
      const utils = renderWithProviders(<DriversScreen navigation={nav} />);
      await utils.findByText(`${MOCK_DRIVERS_RAW.length} CONFIRMED`);
      expect(utils.queryByText('NOT CURRENTLY RACING · RACED IN 2026')).toBeNull();
    });
  });

  describe('image caching', () => {
    it('driver photo uses CachedImage when imageUrl is set and no bundled image exists', async () => {
      // getDriverImage is mocked to return null (jest.setup.js), so imageUrl triggers CachedImage
      const gridWithImage = {
        ...MOCK_GRID,
        drivers: [{...MOCK_GRID.drivers[0], imageUrl: 'https://www.btcc.net/wp-content/uploads/driver.jpg'}],
      };
      parseGrid.mockReturnValue(gridWithImage);
      const {getAllByTestId, findByText} = renderWithProviders(<DriversScreen navigation={nav} />);
      await findByText('1 CONFIRMED');
      // The CachedImage mock renders with testID="cached-image"
      expect(getAllByTestId('cached-image').length).toBeGreaterThanOrEqual(1);
    });

    it('driver number graphic uses CachedImage when numberImageUrl is set', async () => {
      const gridWithNumberImage = {
        ...MOCK_GRID,
        drivers: [{...MOCK_GRID.drivers[0], numberImageUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/numberImages/80.png'}],
      };
      parseGrid.mockReturnValue(gridWithNumberImage);
      const {getAllByTestId, findByText} = renderWithProviders(<DriversScreen navigation={nav} />);
      await findByText('1 CONFIRMED');
      expect(getAllByTestId('cached-image').length).toBeGreaterThanOrEqual(1);
    });

    it('falls back to the plain-text number when numberImageUrl is absent', async () => {
      const {getByText} = await renderDrivers();
      // MOCK_GRID's driver has no numberImageUrl - the styled number 80 renders as text.
      expect(getByText('80')).toBeTruthy();
    });

    it('driver card background uses CachedImage (with retry) when cardBgUrl is set', async () => {
      // Root-caused live 2026-08-19: this used to be a raw <Image> with a manual
      // onError -> permanent grey-fallback handler, no retry at all - a single
      // transient failure (e.g. a burst of ~24 driver tiles' images requesting
      // at once) showed the fallback forever for that card. Confirms it now
      // goes through CachedImage like every other remote image on this screen.
      const gridWithBg = {
        ...MOCK_GRID,
        drivers: [{...MOCK_GRID.drivers[0], cardBgUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/backgroundImages/team-vertu.png'}],
      };
      parseGrid.mockReturnValue(gridWithBg);
      const {getAllByTestId, findByText} = renderWithProviders(<DriversScreen navigation={nav} />);
      await findByText('1 CONFIRMED');
      expect(getAllByTestId('cached-image').length).toBeGreaterThanOrEqual(1);
    });

    it('team card background and car image both use CachedImage when URLs are set', async () => {
      const gridWithImages = {
        drivers: [],
        teams: [{
          name: 'Team Ingram',
          cardBgUrl: 'https://www.btcc.net/wp-content/uploads/bg.jpg',
          cardBgThumbUrl: null,
          carImageUrl: 'https://www.btcc.net/wp-content/uploads/car.jpg',
          carThumbUrl: null,
        }],
      };
      parseGrid.mockReturnValue(gridWithImages);
      const {getAllByTestId, findByText} = renderWithProviders(<DriversScreen navigation={nav} />);
      await findByText('0 CONFIRMED');
      // cardBgUrl and carImageUrl each render a CachedImage
      expect(getAllByTestId('cached-image').length).toBeGreaterThanOrEqual(2);
    });

    it('team logo renders via CachedImage when logoUrl is set', async () => {
      const gridWithLogo = {
        drivers: [],
        teams: [{
          name: 'Team Ingram',
          cardBgUrl: null,
          carImageUrl: null,
          logoUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/logoImages/team-ingram.png',
        }],
      };
      parseGrid.mockReturnValue(gridWithLogo);
      const {getAllByTestId, findByText} = renderWithProviders(<DriversScreen navigation={nav} />);
      await findByText('0 CONFIRMED');
      expect(getAllByTestId('cached-image').length).toBeGreaterThanOrEqual(1);
    });

    it('no logo image renders when logoUrl is absent (e.g. CPRL, no logo file yet)', async () => {
      const gridWithoutLogo = {
        drivers: [],
        teams: [{name: 'CPRL', cardBgUrl: null, carImageUrl: null, logoUrl: ''}],
      };
      parseGrid.mockReturnValue(gridWithoutLogo);
      const {queryAllByTestId, findByText} = renderWithProviders(<DriversScreen navigation={nav} />);
      await findByText('0 CONFIRMED');
      expect(queryAllByTestId('cached-image').length).toBe(0);
    });
  });
});
