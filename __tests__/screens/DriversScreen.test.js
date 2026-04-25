import React from 'react';
import {act, fireEvent} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DriversScreen from '../../src/screens/DriversScreen';
import {renderWithProviders, makeNav, MOCK_GRID} from './testUtils';

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
  });
});
