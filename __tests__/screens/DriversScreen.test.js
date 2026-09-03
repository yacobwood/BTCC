import React from 'react';
import {act, fireEvent} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ScrollView} from 'react-native';
import DriversScreen from '../../src/screens/DriversScreen';
import {renderWithProviders, makeNav, MOCK_GRID, MOCK_DRIVERS_RAW} from './testUtils';

jest.mock('../../src/api/client', () => ({fetchDrivers: jest.fn()}));
jest.mock('../../src/api/parsers', () => ({parseGrid: jest.fn()}));
// Local override, not just the global one - NumberBadge needs onLoad forwarded
// through to assert its aspectRatio actually updates once the image "loads".
jest.mock('../../src/components/CachedImage', () => {
  const React = require('react');
  const {Image} = require('react-native');
  return {
    __esModule: true,
    default: ({uri, style, resizeMode, onLoad}) =>
      React.createElement(Image, {source: {uri}, style, resizeMode, onLoad, testID: 'cached-image'}),
  };
});

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

    // Regression (2026-08-24): TouchableOpacity's built-in fade dims the whole
    // card's subtree via per-layer paint compositing on Android (no offscreen
    // buffer by default), which briefly let the opaque number graphic behind
    // the driver photo show through it on press - "the number can quickly be
    // seen through his face". Fixed by disabling the built-in fade entirely
    // and using a dedicated scrim overlay instead (see DriverCardInner).
    it('does not use a whole-tile opacity fade on press', async () => {
      const {UNSAFE_getAllByType, getByLabelText} = await renderDrivers();
      const {TouchableOpacity} = require('react-native');
      // getByLabelText resolves to the underlying host view - activeOpacity/
      // onPressIn/onPressOut are JS-level TouchableOpacity props that never
      // reach it, so query the composite element itself.
      const card = UNSAFE_getAllByType(TouchableOpacity).find(
        c => c.props.accessibilityLabel === 'Tom Ingram, Team Ingram, number 80',
      );
      expect(getByLabelText('Tom Ingram, Team Ingram, number 80')).toBeTruthy();
      expect(card.props.activeOpacity).toBe(1);
      expect(typeof card.props.onPressIn).toBe('function');
      expect(typeof card.props.onPressOut).toBe('function');
    });

    it('pressing in and out does not interfere with tapping through to DriverDetail', async () => {
      const {UNSAFE_getAllByType, getByLabelText} = await renderDrivers();
      const {TouchableOpacity} = require('react-native');
      const card = UNSAFE_getAllByType(TouchableOpacity).find(
        c => c.props.accessibilityLabel === 'Tom Ingram, Team Ingram, number 80',
      );
      await act(async () => {
        card.props.onPressIn();
        card.props.onPressOut();
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

    // Regression guard (2026-08-22): a fixed width+height box on the number
    // graphic let `contain` letterbox each number's file differently
    // depending on how its own aspect ratio (single vs multi-digit numbers
    // are very different shapes) compared to the box's - "some numbers
    // touching the tile's top edge, some not". NumberBadge fixes this by
    // sizing itself off the loaded image's own real aspect ratio instead.
    it("sizes the number graphic off its own loaded aspect ratio, not a fixed box", async () => {
      const gridWithNumberImage = {
        ...MOCK_GRID,
        drivers: [{...MOCK_GRID.drivers[0], numberImageUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/numberImages/80.png'}],
      };
      parseGrid.mockReturnValue(gridWithNumberImage);
      const {getAllByTestId, findByText} = renderWithProviders(<DriversScreen navigation={nav} />);
      await findByText('1 CONFIRMED');
      const numberImg = getAllByTestId('cached-image').find(img => img.props.source.uri?.includes('numberImages'));
      // Before the image "loads", it renders at the 1.5 placeholder ratio.
      expect(numberImg.props.style).toEqual(expect.arrayContaining([expect.objectContaining({aspectRatio: 1.5})]));
      // A wide, 3-digit-shaped number (200x100 = 2:1) should update to match
      // once loaded - not stay pinned to a box tuned for some other shape.
      act(() => { numberImg.props.onLoad({nativeEvent: {source: {width: 200, height: 100}}}); });
      const reloaded = getAllByTestId('cached-image').find(img => img.props.source.uri?.includes('numberImages'));
      expect(reloaded.props.style).toEqual(expect.arrayContaining([expect.objectContaining({aspectRatio: 2})]));
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

    it('team card background renders via CachedImage when its URL is set', async () => {
      const gridWithImages = {
        drivers: [],
        teams: [{
          name: 'Team Ingram',
          cardBgUrl: 'https://www.btcc.net/wp-content/uploads/bg.jpg',
          cardBgThumbUrl: null,
        }],
      };
      parseGrid.mockReturnValue(gridWithImages);
      const {getAllByTestId, findByText} = renderWithProviders(<DriversScreen navigation={nav} />);
      await findByText('0 CONFIRMED');
      expect(getAllByTestId('cached-image').length).toBeGreaterThanOrEqual(1);
    });

    // Regression guard: a team tile used to show one "representative" car,
    // which stopped being accurate once a team could field a different
    // livery per driver (see the driver-tile carImageUrl tests below) -
    // the tile now shows only the shared team logo, never a car.
    it('never renders a car image on the team tile, even when carImageUrl is set', async () => {
      const gridWithCar = {
        drivers: [],
        teams: [{
          name: 'Steel Seal with Power Maxed Racing',
          cardBgUrl: null,
          carImageUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/patterson.png',
          logoUrl: null,
        }],
      };
      parseGrid.mockReturnValue(gridWithCar);
      const {queryAllByTestId, findByText} = renderWithProviders(<DriversScreen navigation={nav} />);
      await findByText('0 CONFIRMED');
      expect(queryAllByTestId('cached-image').length).toBe(0);
    });

    it('team logo renders large and centered via CachedImage when logoUrl is set', async () => {
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
      const images = getAllByTestId('cached-image');
      expect(images.length).toBe(1);
      // Large/centered (70% box, no absolute corner position), not the old
      // small top-right badge it shared the tile with a car cutout.
      expect(images[0].props.style.width).toBe('70%');
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

  // Regression guard: the driver tile used to show the driver's own car as a
  // rotated side badge, but that moved to the profile page only (2026-08-21,
  // by request) so the tile could give the driver photo the full tile height
  // instead. A driver with carImageUrl set must not resurrect it here.
  describe("driver tile car image (removed 2026-08-21 - lives on the profile page only)", () => {
    it('never renders a car image on the driver tile, even when carImageUrl is set', async () => {
      const gridWithCar = {
        drivers: [{
          name: 'Nick Halstead', number: 55, team: 'Steel Seal with Power Maxed Racing',
          imageUrl: null, cardBgUrl: null,
          carImageUrl: 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/halstead.webp',
        }],
        teams: [],
      };
      parseGrid.mockReturnValue(gridWithCar);
      const {queryAllByTestId, findByText} = renderWithProviders(<DriversScreen navigation={nav} />);
      await findByText('1 CONFIRMED');
      const carImages = queryAllByTestId('cached-image')
        .filter(img => img.props.source.uri?.includes('carImages'));
      expect(carImages.length).toBe(0);
    });
  });

  // Regression guard (2026-08-30): scroll-to-top used to fire on every focus,
  // including a plain back-pop from DriverDetail/TeamDetail - fixed to fire
  // only when route.params.scrollToTopToken changes, which AppNavigator.js's
  // useResetStackOnTabPress sets solely on an actual Grid tab bar press.
  describe('scroll to top on tab press', () => {
    it('does not scroll on initial mount', async () => {
      const spy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
      await renderDrivers();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('scrolls both lists to top when the Grid tab bar icon is pressed', async () => {
      const spy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
      await renderDrivers();
      expect(spy).not.toHaveBeenCalled();
      await act(async () => { nav.__fireTabPress(); });
      expect(spy).toHaveBeenCalledWith({y: 0, animated: false});
      spy.mockRestore();
    });

    it('scrolls again on a second tab press', async () => {
      const spy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
      await renderDrivers();
      await act(async () => { nav.__fireTabPress(); });
      spy.mockClear();
      await act(async () => { nav.__fireTabPress(); });
      expect(spy).toHaveBeenCalledWith({y: 0, animated: false});
      spy.mockRestore();
    });
  });
});
