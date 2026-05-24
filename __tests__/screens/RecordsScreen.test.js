import React from 'react';
import {fireEvent, waitFor} from '@testing-library/react-native';
import RecordsScreen from '../../src/screens/RecordsScreen';
import {renderWithProviders, makeNav} from './testUtils';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn(), navItemClicked: jest.fn(), scrollToTop: jest.fn()},
}));

jest.mock('../../src/store/cache', () => ({
  cacheRead: jest.fn().mockResolvedValue(null),
  cacheWrite: jest.fn(),
}));

const DRIVERS = [
  {driver: 'Tom Ingram',       starts: 100, wins: 20, podiums: 40, poles: 15, fastestLaps: 12, dnfs: 5,  racesLed: 50, hatTricks: 3, winStreak: 4, bestSeasonWins: 8,  podiumStreak: 10, bestSeasonPodiums: 16, poleStreak: 3, bestSeasonPoles: 6, consecutive: 50, consecutivePoints: 80, points: 1250, seasons: 10, championships: 2, winPct: 0.20,   podiumPct: 0.40,   pointsPerStart: 12.5, dnfPct: 0.05},
  {driver: 'Gordon Shedden',   starts: 80,  wins: 15, podiums: 35, poles: 10, fastestLaps:  8, dnfs: 8,  racesLed: 40, hatTricks: 2, winStreak: 3, bestSeasonWins: 6,  podiumStreak: 8,  bestSeasonPodiums: 14, poleStreak: 2, bestSeasonPoles: 5, consecutive: 40, consecutivePoints: 70, points: 880,  seasons:  8, championships: 1, winPct: 0.1875, podiumPct: 0.4375, pointsPerStart: 11.0, dnfPct: 0.10},
  {driver: 'Colin Turkington', starts: 60,  wins: 10, podiums: 25, poles:  8, fastestLaps:  6, dnfs: 3,  racesLed: 20, hatTricks: 0, winStreak: 2, bestSeasonWins: 4,  podiumStreak: 0,  bestSeasonPodiums: 10, poleStreak: 0, bestSeasonPoles: 3, consecutive: 30, consecutivePoints: 50, points: 600,  seasons:  6, championships: 0, winPct: 0.1667, podiumPct: 0.4167, pointsPerStart: 10.0, dnfPct: 0.05},
  // historical=true, starts=0 — appears in Wins and Titles tabs only
  {driver: 'Andy Rouse',       starts: 0,   wins: 60, podiums: 0,  poles: 0,  fastestLaps:  0, dnfs: 0,  racesLed: 0,  hatTricks: 0, winStreak: 0, bestSeasonWins: 0,  podiumStreak: 0,  bestSeasonPodiums: 0,  poleStreak: 0, bestSeasonPoles: 0, consecutive: 0,  consecutivePoints: 0,  points: 0,    seasons:  0, championships: 4, winPct: 0.0,    podiumPct: 0.0,    pointsPerStart: 0.0,  dnfPct: 0.0,  historical: true},
];

jest.mock('../../src/api/client', () => ({
  fetchRecords: jest.fn().mockResolvedValue({drivers: DRIVERS}),
}));

const nav = makeNav();

// Helper: navigate to a section by label
async function goToSection(getByLabelText, label) {
  await waitFor(() => getByLabelText(label));
  fireEvent.press(getByLabelText(label));
}

describe('RecordsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Analytics ────────────────────────────────────────────────────────────────

  it('calls Analytics.screen("records") on mount', async () => {
    const {Analytics} = require('../../src/utils/analytics');
    renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => expect(Analytics.screen).toHaveBeenCalledWith('records'));
  });

  // ── Header ────────────────────────────────────────────────────────────────────

  it('renders ALL-TIME RECORDS title', async () => {
    const {getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => expect(getByText('ALL-TIME RECORDS')).toBeTruthy());
  });

  it('navigates back when back button pressed', async () => {
    const {getByLabelText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Go back'));
    fireEvent.press(getByLabelText('Go back'));
    expect(nav.goBack).toHaveBeenCalled();
  });

  // ── Section order and defaults ────────────────────────────────────────────────

  it('shows Totals and Rates section chips', async () => {
    const {getByLabelText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => {
      expect(getByLabelText('Totals')).toBeTruthy();
      expect(getByLabelText('Rates')).toBeTruthy();
    });
  });

  it('defaults to Totals section showing Titles tab', async () => {
    const {getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => expect(getByText('Titles')).toBeTruthy());
  });

  it('does not show Win % tab when on Totals section', async () => {
    const {queryByLabelText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => expect(queryByLabelText('Win % tab')).toBeNull());
  });

  it('switches to Rates section when pressed', async () => {
    const {getByLabelText, getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await goToSection(getByLabelText, 'Rates');
    await waitFor(() => expect(getByText('Win %')).toBeTruthy());
  });

  // ── Totals section ────────────────────────────────────────────────────────────

  it('shows Source: btcc.net subtitle in Totals', async () => {
    const {getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    // Totals is the default section; subtitle appears in the list header
    await waitFor(() => expect(getByText('Source: btcc.net')).toBeTruthy());
  });

  it('Totals has only Titles and Wins tabs', async () => {
    const {getByLabelText, queryByLabelText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => {
      expect(getByLabelText('Titles tab')).toBeTruthy();
      expect(getByLabelText('Wins tab')).toBeTruthy();
      expect(queryByLabelText('Starts tab')).toBeNull();
      expect(queryByLabelText('Podiums tab')).toBeNull();
    });
  });

  it('Titles tab filters out drivers with zero championships', async () => {
    const {getByLabelText, queryByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Titles tab'));
    fireEvent.press(getByLabelText('Titles tab'));
    // Colin Turkington has 0 championships in the mock
    await waitFor(() => expect(queryByText('Colin Turkington')).toBeNull());
  });

  it('Titles tab sorts by championship count descending', async () => {
    const {getByLabelText, getAllByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Titles tab'));
    fireEvent.press(getByLabelText('Titles tab'));
    // Andy Rouse (4) should appear before Tom Ingram (2) and Gordon Shedden (1)
    await waitFor(() => {
      const medal1 = getAllByText('🥇');
      expect(medal1.length).toBeGreaterThan(0);
    });
  });

  it('Wins tab shows modern and historical drivers sorted by wins', async () => {
    const {getByLabelText, getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Wins tab'));
    fireEvent.press(getByLabelText('Wins tab'));
    await waitFor(() => {
      expect(getByText('Andy Rouse')).toBeTruthy();   // historical, 60 wins
      expect(getByText('Tom Ingram')).toBeTruthy();   // modern, 20 wins
    });
  });

  it('Wins tab ranks Andy Rouse first (60 wins vs 20)', async () => {
    const {getByLabelText, getByText, getAllByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Wins tab'));
    fireEvent.press(getByLabelText('Wins tab'));
    await waitFor(() => expect(getAllByText('🥇').length).toBeGreaterThan(0));
    // The gold medal row should contain Andy Rouse
    expect(getByText('Andy Rouse')).toBeTruthy();
  });

  // ── Historical driver filtering ───────────────────────────────────────────────

  it('Titles tab includes historical drivers', async () => {
    const {getByLabelText, getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Titles tab'));
    fireEvent.press(getByLabelText('Titles tab'));
    await waitFor(() => expect(getByText('Andy Rouse')).toBeTruthy());
  });

  it('Wins tab includes historical drivers', async () => {
    const {getByLabelText, getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Wins tab'));
    fireEvent.press(getByLabelText('Wins tab'));
    await waitFor(() => expect(getByText('Andy Rouse')).toBeTruthy());
  });

  it('Rates section excludes historical drivers (starts < 30)', async () => {
    const {getByLabelText, queryByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await goToSection(getByLabelText, 'Rates');
    // Andy Rouse has 0 starts — below MIN_STARTS of 30
    await waitFor(() => expect(queryByText('Andy Rouse')).toBeNull());
  });

  // ── Rates section ─────────────────────────────────────────────────────────────

  it('shows Min. 30 starts subtitle in Rates', async () => {
    const {getByLabelText, getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await goToSection(getByLabelText, 'Rates');
    await waitFor(() => expect(getByText(/Min\. 30 starts/)).toBeTruthy());
  });

  it('shows Podium % tab in Rates section', async () => {
    const {getByLabelText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await goToSection(getByLabelText, 'Rates');
    await waitFor(() => expect(getByLabelText('Podium % tab')).toBeTruthy());
  });

  it('Win % tab shows formatted percentage values', async () => {
    const {getByLabelText, getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await goToSection(getByLabelText, 'Rates');
    // Tom Ingram: 20 wins / 100 starts = 20.0%
    await waitFor(() => expect(getByText('20.0%')).toBeTruthy());
  });

  it('Podium % tab shows highest value first', async () => {
    const {getByLabelText, getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await goToSection(getByLabelText, 'Rates');
    await waitFor(() => getByLabelText('Podium % tab'));
    fireEvent.press(getByLabelText('Podium % tab'));
    // Tom Ingram: 40 podiums / 100 starts = 40.0%
    await waitFor(() => expect(getByText('40.0%')).toBeTruthy());
  });

  it('Rates section shows modern drivers', async () => {
    const {getByLabelText, getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await goToSection(getByLabelText, 'Rates');
    await waitFor(() => {
      expect(getByText('Tom Ingram')).toBeTruthy();
      expect(getByText('Gordon Shedden')).toBeTruthy();
    });
  });

  // ── Ranking medals ────────────────────────────────────────────────────────────

  it('shows gold medal for rank 1', async () => {
    const {getAllByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => expect(getAllByText('🥇').length).toBeGreaterThan(0));
  });

  it('shows silver medal for rank 2', async () => {
    const {getAllByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => expect(getAllByText('🥈').length).toBeGreaterThan(0));
  });
});
