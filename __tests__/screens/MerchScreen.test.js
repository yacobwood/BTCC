// Override the global jest.setup.js CachedImage stub with one that also forwards
// resizeMode/collapsable, so the "Grid Teams tab parity" test below can assert on
// them directly - the default stub only forwards {uri, style} and would hide a
// regression back to the cover/stretch bug this screen shipped with.
jest.mock('../../src/components/CachedImage', () => {
  const React = require('react');
  const {Image} = require('react-native');
  return {
    __esModule: true,
    default: ({uri, style, resizeMode, collapsable}) =>
      React.createElement(Image, {source: {uri}, style, resizeMode, collapsable, testID: 'cached-image'}),
  };
});

import React from 'react';
import {Linking} from 'react-native';
import {act, fireEvent} from '@testing-library/react-native';
import MerchScreen from '../../src/screens/MerchScreen';
import {renderWithProviders, makeNav} from './testUtils';

jest.mock('../../src/api/client', () => ({fetchDrivers: jest.fn(), fetchMerchStores: jest.fn()}));
jest.mock('../../src/api/parsers', () => ({parseGrid: jest.fn()}));

const {fetchDrivers, fetchMerchStores} = require('../../src/api/client');
const {parseGrid}                      = require('../../src/api/parsers');
const nav = makeNav();

const MOCK_TEAMS_GRID = {
  drivers: [],
  teams: [
    {name: 'Team Ingram', cardBgUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/backgroundImages/team-ingram-bg.jpg', cardBgThumbUrl: null, carImageUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/team-ingram-car.png', carThumbUrl: null, logoUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/logoImages/team-ingram.png'},
    {name: 'Laser Tools', cardBgUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/backgroundImages/laser-tools-bg.jpg', cardBgThumbUrl: null, carImageUrl: null, carThumbUrl: null, logoUrl: ''},
    {name: 'West Surrey',  cardBgUrl: null, cardBgThumbUrl: null, carImageUrl: null, carThumbUrl: null, logoUrl: null},
  ],
};

const DEFAULT_STORES = {
  'Team Ingram': [{name: 'Official Store', url: 'https://shop.example.com/ingram'}],
  'Laser Tools': [
    {name: 'Store A', url: 'https://shop.example.com/a'},
    {name: 'Store B', url: 'https://shop.example.com/b'},
  ],
  // West Surrey deliberately has no entry - it has no merch stores and must
  // be filtered out of the grid entirely, not shown with an empty/broken tile.
};

// Renders the screen and waits until loading completes (the intro line is
// present regardless of whether any teams have merch, unlike team names).
async function renderMerch({stores = DEFAULT_STORES} = {}) {
  fetchDrivers.mockResolvedValue([]);
  fetchMerchStores.mockResolvedValue(stores);
  parseGrid.mockReturnValue(MOCK_TEAMS_GRID);
  const utils = renderWithProviders(<MerchScreen navigation={nav} />);
  await utils.findByText('Shop official merchandise from your favourite BTCC teams.');
  return utils;
}

describe('MerchScreen', () => {
  it('renders only teams that have at least one merch store', async () => {
    const {queryByText} = await renderMerch();
    expect(queryByText('Team Ingram')).toBeTruthy();
    expect(queryByText('Laser Tools')).toBeTruthy();
    expect(queryByText('West Surrey')).toBeNull();
  });

  it('shows "SHOP" for a single-store team and "N SHOPS" for a multi-store team', async () => {
    const {getByText} = await renderMerch();
    expect(getByText('SHOP')).toBeTruthy();
    expect(getByText('2 SHOPS')).toBeTruthy();
  });

  it('shows the empty state when no teams have merch stores', async () => {
    const {getByText, queryByText} = await renderMerch({stores: {}});
    expect(getByText('No merch stores available yet.')).toBeTruthy();
    expect(queryByText('Team Ingram')).toBeNull();
  });

  it('tapping a single-store team opens its store URL directly, with UTM tracking params', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const {getByLabelText} = await renderMerch();
    await act(async () => { fireEvent.press(getByLabelText('Shop Team Ingram merchandise')); });
    expect(openURL).toHaveBeenCalledWith(
      'https://shop.example.com/ingram?utm_source=btcchub&utm_medium=app&utm_campaign=merch',
    );
  });

  it('tapping a multi-store team opens the store picker instead of a URL', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const {getByLabelText, getByText} = await renderMerch();
    await act(async () => { fireEvent.press(getByLabelText('Shop Laser Tools merchandise')); });
    expect(openURL).not.toHaveBeenCalled();
    expect(getByText('CHOOSE A STORE')).toBeTruthy();
    expect(getByText('Store A')).toBeTruthy();
    expect(getByText('Store B')).toBeTruthy();
  });

  it('picking a store from the picker opens that store\'s URL and closes the sheet', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const {getByLabelText, getByText, queryByText} = await renderMerch();
    await act(async () => { fireEvent.press(getByLabelText('Shop Laser Tools merchandise')); });
    await act(async () => { fireEvent.press(getByText('Store B')); });
    expect(openURL).toHaveBeenCalledWith(
      'https://shop.example.com/b?utm_source=btcchub&utm_medium=app&utm_campaign=merch',
    );
    expect(queryByText('CHOOSE A STORE')).toBeNull();
  });

  describe('team tile background (Grid Teams-tab parity)', () => {
    it('renders the card background with resizeMode="stretch" and collapsable={false}, matching DriversScreen\'s Teams tab', async () => {
      // Regression test: this tile independently shipped with resizeMode="cover",
      // which crops the pre-rendered diagonal-stripe/corner-decoration graphic baked
      // into cardBgUrl down to a flat colour swatch (visible on live: solid-colour
      // tiles instead of the branded design shown on Grid -> Teams). "stretch"
      // (matching DriversScreen.js's teamImageArea) shows the whole graphic;
      // collapsable={false} guards against the Android view-flattening blank-tile
      // bug already fixed once for this same image elsewhere in the app.
      const {getAllByTestId} = await renderMerch();
      const bgImages = getAllByTestId('cached-image')
        .filter(img => img.props.source.uri?.includes('backgroundImages'));
      expect(bgImages.length).toBe(2); // Team Ingram + Laser Tools
      bgImages.forEach(img => {
        expect(img.props.resizeMode).toBe('stretch');
        expect(img.props.collapsable).toBe(false);
      });
    });
  });

  describe('team logo (same treatment as driver number graphics)', () => {
    it('renders the sponsor logo via CachedImage when logoUrl is set', async () => {
      const {getAllByTestId} = await renderMerch();
      const logoImages = getAllByTestId('cached-image')
        .filter(img => img.props.source.uri?.includes('logoImages'));
      expect(logoImages.length).toBe(1); // only Team Ingram has a logoUrl in the fixture
      expect(logoImages[0].props.resizeMode).toBe('contain');
    });

    it('renders no logo image for a team with no logoUrl (e.g. no logo file provided yet)', async () => {
      const {getAllByTestId} = await renderMerch();
      const logoImages = getAllByTestId('cached-image')
        .filter(img => img.props.source.uri?.includes('logoImages'));
      // Laser Tools (logoUrl: '') must not contribute a second logo image
      expect(logoImages.length).toBe(1);
    });
  });
});
