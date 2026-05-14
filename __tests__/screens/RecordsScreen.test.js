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
  {driver: 'Andy Rouse',       starts: 0,   wins: 60, podiums: 0,  poles: 0,  fastestLaps:  0, dnfs: 0,  racesLed: 0,  hatTricks: 0, winStreak: 0, bestSeasonWins: 0,  podiumStreak: 0,  bestSeasonPodiums: 0,  poleStreak: 0, bestSeasonPoles: 0, consecutive: 0,  consecutivePoints: 0,  points: 0,    seasons:  0, championships: 4, winPct: 0.0,    podiumPct: 0.0,    pointsPerStart: 0.0,  dnfPct: 0.0,  historical: true},
];

jest.mock('../../src/api/client', () => ({
  fetchRecords: jest.fn().mockResolvedValue({drivers: DRIVERS}),
}));

const nav = makeNav();

describe('RecordsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

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

  // ── Section switching ─────────────────────────────────────────────────────────

  it('shows Rates and Totals section chips', async () => {
    const {getByLabelText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => {
      expect(getByLabelText('Rates')).toBeTruthy();
      expect(getByLabelText('Totals')).toBeTruthy();
    });
  });

  it('defaults to Rates section showing Win % tab', async () => {
    const {getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => expect(getByText('Win %')).toBeTruthy());
  });

  it('switches to Totals section when pressed', async () => {
    const {getByLabelText, getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Totals'));
    fireEvent.press(getByLabelText('Totals'));
    await waitFor(() => expect(getByText('Starts')).toBeTruthy());
  });

  // ── Tab switching ─────────────────────────────────────────────────────────────

  it('shows Podium % tab in Rates section', async () => {
    const {getByLabelText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => expect(getByLabelText('Podium % tab')).toBeTruthy());
  });

  it('switches to Podium % tab when pressed', async () => {
    const {getByLabelText, getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Podium % tab'));
    fireEvent.press(getByLabelText('Podium % tab'));
    // Tom has highest podium % (40%) — should appear with that value
    await waitFor(() => expect(getByText('40.0%')).toBeTruthy());
  });

  // ── Data rendering ────────────────────────────────────────────────────────────

  it('renders driver names in Rates Win % list', async () => {
    const {getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => {
      expect(getByText('Tom Ingram')).toBeTruthy();
      expect(getByText('Gordon Shedden')).toBeTruthy();
    });
  });

  it('renders formatted win percentage values', async () => {
    const {getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    // Tom Ingram: 20% win rate
    await waitFor(() => expect(getByText('20.0%')).toBeTruthy());
  });

  it('renders driver names in Totals Starts list', async () => {
    const {getByLabelText, getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Totals'));
    fireEvent.press(getByLabelText('Totals'));
    fireEvent.press(getByLabelText('Starts tab'));
    await waitFor(() => {
      expect(getByText('Tom Ingram')).toBeTruthy();
      expect(getByText('Gordon Shedden')).toBeTruthy();
    });
  });

  it('shows the Rates section subtitle about minimum starts', async () => {
    const {getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => expect(getByText(/Min\. 30 starts/)).toBeTruthy());
  });

  // ── hideZero filtering ────────────────────────────────────────────────────────

  it('filters out zero-value entries for hideZero metrics in Totals', async () => {
    const {getByLabelText, queryByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Totals'));
    fireEvent.press(getByLabelText('Totals'));
    // Championships tab has hideZero — Colin has 0 championships, should not appear
    await waitFor(() => getByLabelText('Titles tab'));
    fireEvent.press(getByLabelText('Titles tab'));
    await waitFor(() => expect(queryByText('Colin Turkington')).toBeNull());
  });

  // ── Ranking ───────────────────────────────────────────────────────────────────

  it('shows rank 1 for the top entry', async () => {
    const {getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    // Medal emoji for rank 1
    await waitFor(() => expect(getByText('🥇')).toBeTruthy());
  });

  it('shows rank 2 medal for second place', async () => {
    const {getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => expect(getByText('🥈')).toBeTruthy());
  });

  // ── Historical driver filtering ───────────────────────────────────────────────

  it('shows historical drivers in the Wins tab', async () => {
    const {getByLabelText, getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Totals'));
    fireEvent.press(getByLabelText('Totals'));
    fireEvent.press(getByLabelText('Wins tab'));
    await waitFor(() => expect(getByText('Andy Rouse')).toBeTruthy());
  });

  it('hides historical drivers from the Starts tab', async () => {
    const {getByLabelText, queryByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Totals'));
    fireEvent.press(getByLabelText('Totals'));
    fireEvent.press(getByLabelText('Starts tab'));
    await waitFor(() => expect(queryByText('Andy Rouse')).toBeNull());
  });

  it('shows historical drivers in the Titles tab', async () => {
    const {getByLabelText, getByText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Totals'));
    fireEvent.press(getByLabelText('Totals'));
    fireEvent.press(getByLabelText('Titles tab'));
    await waitFor(() => expect(getByText('Andy Rouse')).toBeTruthy());
  });

  // ── Laps Led tab removed ──────────────────────────────────────────────────────

  it('does not show a Laps Led tab', async () => {
    const {getByLabelText, queryByLabelText} = renderWithProviders(<RecordsScreen navigation={nav} />);
    await waitFor(() => getByLabelText('Totals'));
    fireEvent.press(getByLabelText('Totals'));
    await waitFor(() => expect(queryByLabelText('Laps Led tab')).toBeNull());
  });
});
