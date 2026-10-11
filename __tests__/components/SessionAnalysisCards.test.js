// jest.setup.js SVG mock lacks a default export; add one so `import Svg from 'react-native-svg'` works
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Svg: 'Svg', Polyline: 'Polyline', Line: 'Line',
  Text: 'SvgText', Path: 'Path', Circle: 'Circle', G: 'G',
}));

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {
    sessionAnalysisLoaded: jest.fn(),
    sessionAnalysisLoadFailed: jest.fn(),
    sessionAnalysisRetried: jest.fn(),
    lapTimesShown: jest.fn(),
    lapTimesDriverToggled: jest.fn(),
    lapTimesDriverExpanded: jest.fn(),
    lapTimesDriverCollapsed: jest.fn(),
    tyresShown: jest.fn(),
    topSpeedsShown: jest.fn(),
    sessionStatsShown: jest.fn(),
  },
}));

jest.mock('../../src/api/client', () => ({
  fetchSessionAnalysis: jest.fn(),
}));

import React from 'react';
import {act, fireEvent, waitFor} from '@testing-library/react-native';
import {
  LapTimesCard, TyresCard, TopSpeedsCard, SessionStatsCard,
  cleanLaps, lapStats, delayLabel, formatLapTime, clearSessionAnalysisMemo,
} from '../../src/components/SessionAnalysisCards';
import {fetchSessionAnalysis} from '../../src/api/client';
import {Analytics} from '../../src/utils/analytics';
import {renderWithProviders} from '../screens/testUtils';

// Raw file shape written by scrape_tsl.py's write_session_analysis()
const FILE = {
  year: 2026, round: 10, session: 'Qualifying Race',
  laps: [
    {no: 16, driver: 'Aiden MOFFAT', team: 'LKQ Euro Car Parts with Power Maxed Racing', ideal: 89.791, best: 89.94, laps: [
      {lap: 1, t: 97.529, s: [null, 16.742, 23.664, 21.561], v: [106.3, 140.1, 96.5, 132.8]},
      {lap: 2, t: 90.009, s: [28.955, 16.273, 23.513, 21.268], v: []},
      {lap: 3, t: 89.94, s: [28.86, 16.25, 23.436, 21.394], v: []},
      {lap: 4, t: 90.5, s: [28.9, 16.3, 23.8, 21.5], v: [], deleted: true},
    ]},
    {no: 80, driver: 'Tom INGRAM', team: 'Team VERTU', ideal: 89.815, best: 89.958, laps: [
      {lap: 1, t: 98.21, s: [null, 16.66, 23.758, 21.479], v: []},
      {lap: 2, t: 89.958, s: [28.752, 16.411, 23.271, 21.524], v: []},
    ]},
  ],
  tyres: [
    {no: 80, driver: 'Tom INGRAM', team: 'Team VERTU', compounds: ['Medium']},
    {no: 11, driver: 'Ricky COLLARD', team: 'Team VERTU', compounds: ['Medium', 'Soft']},
  ],
  topSpeeds: [{pos: 1, no: 11, driver: 'Ricky COLLARD', team: 'Team VERTU', speeds: [146.8, 146.5, 146.2, 145.8, 145.8], avg: 146.2, best: 146.8}],
  topSpeedsTrap: 'Intermediate 2',
  sessionStats: {
    competitors: 23, plannedStart: '2026-10-10T14:50:00', actualStart: '2026-10-10T15:09:48',
    finishTime: '2026-10-10T15:24:57', startDelayMins: 20, totalLaps: 230, totalDistance: 559.6566, trackLength: 2.4332,
    fastestLapHistory: [
      {no: 16, driver: 'Aiden MOFFAT', time: '1:37.529', secs: 97.529, lap: 1},
      {no: 16, driver: 'Aiden MOFFAT', time: '1:29.940', secs: 89.94, lap: 3},
    ],
    classes: {
      M: {starters: 12, fastestLap: {no: 80, driver: 'Tom INGRAM', time: '1:29.958', secs: 89.958, lap: 3}},
      IND: {starters: 11, fastestLap: {no: 16, driver: 'Aiden MOFFAT', time: '1:29.940', secs: 89.94, lap: 3}},
    },
  },
};

const PROPS = {year: 2026, roundNumber: 10, session: 'Qualifying Race', isFavourite: () => false};

beforeEach(() => {
  jest.clearAllMocks();
  clearSessionAnalysisMemo();
  fetchSessionAnalysis.mockResolvedValue(FILE);
});

describe('helpers', () => {
  const drv = {best: 90, laps: [
    {lap: 1, time: 97, pit: false, outLap: false, inLap: false, deleted: false},  // >107%: slow start lap, still in
    {lap: 2, time: 90, pit: false, outLap: false, inLap: false, deleted: false},
    {lap: 3, time: 91, pit: false, outLap: false, inLap: false, deleted: false},
    {lap: 4, time: 120, pit: false, outLap: false, inLap: false, deleted: false}, // Safety Car lap
    {lap: 5, time: 92, pit: true, outLap: false, inLap: true, deleted: false},
    {lap: 6, time: 90.5, pit: false, outLap: false, inLap: false, deleted: true},
    {lap: 7, time: null, pit: false, outLap: false, inLap: false, deleted: false},
  ]};

  it('cleanLaps keeps representative laps only', () => {
    expect(cleanLaps(drv).map(l => l.lap)).toEqual([2, 3]);
  });

  it('lapStats averages clean laps and gives their spread', () => {
    const st = lapStats(drv);
    expect(st.clean).toBe(2);
    expect(st.avg).toBeCloseTo(90.5);
    expect(st.spread).toBeCloseTo(0.5);
  });

  it('lapStats copes with no clean laps', () => {
    expect(lapStats({best: null, laps: []})).toEqual({clean: 0, avg: null, spread: null});
  });

  it('delayLabel reads late, early and on time', () => {
    expect(delayLabel(20)).toBe('Started 20 min late');
    expect(delayLabel(-5)).toBe('Started 5 min early');
    expect(delayLabel(0)).toBe('Started on time');
    expect(delayLabel(null)).toBeNull();
  });

  it('formatLapTime matches TSL formatting', () => {
    expect(formatLapTime(56.887)).toBe('56.887');
    expect(formatLapTime(89.94)).toBe('1:29.940');
    expect(formatLapTime(null)).toBe('-');
  });
});

describe('LapTimesCard', () => {
  it('loads the session file, lists drivers and logs shown + loaded', async () => {
    const {findByText, getByText} = renderWithProviders(<LapTimesCard {...PROPS} />);
    await findByText('Aiden MOFFAT');
    expect(getByText('Tom INGRAM')).toBeTruthy();
    expect(fetchSessionAnalysis).toHaveBeenCalledWith(2026, 10, 'Qualifying Race', false);
    expect(Analytics.sessionAnalysisLoaded).toHaveBeenCalledWith(10, 'Qualifying Race');
    expect(Analytics.lapTimesShown).toHaveBeenCalledWith(10, 'Qualifying Race', 2, 6);
  });

  it('expands a driver into every lap and sector, then collapses', async () => {
    const {findByLabelText, getByText, queryByText} = renderWithProviders(<LapTimesCard {...PROPS} />);
    fireEvent.press(await findByLabelText('Show every lap for Aiden MOFFAT'));
    expect(Analytics.lapTimesDriverExpanded).toHaveBeenCalledWith(10, 'Qualifying Race', 'Aiden MOFFAT');
    expect(getByText('28.955')).toBeTruthy();
    expect(getByText('1:30.500 DEL')).toBeTruthy();
    fireEvent.press(await findByLabelText('Hide every lap for Aiden MOFFAT'));
    expect(Analytics.lapTimesDriverCollapsed).toHaveBeenCalledWith(10, 'Qualifying Race', 'Aiden MOFFAT');
    expect(queryByText('28.955')).toBeNull();
  });

  it('toggles a driver on and off the chart', async () => {
    const {findByLabelText} = renderWithProviders(<LapTimesCard {...PROPS} />);
    const box = await findByLabelText('Plot Tom INGRAM on chart');
    expect(box.props.accessibilityState.checked).toBe(true); // top 3 shown by default
    fireEvent.press(box);
    expect(Analytics.lapTimesDriverToggled).toHaveBeenCalledWith(10, 'Qualifying Race', 'Tom INGRAM', false);
  });

  it('auto-retries once, then shows a tap-to-retry message and logs the failure', async () => {
    jest.useFakeTimers();
    fetchSessionAnalysis.mockRejectedValue(new Error('HTTP 500'));
    const {findByLabelText} = renderWithProviders(<LapTimesCard {...PROPS} />);
    await act(async () => {}); // first fetch rejects, schedules the auto-retry
    await act(async () => { jest.advanceTimersByTime(3000); });
    await act(async () => {}); // retry rejects too
    const retry = await findByLabelText('Retry loading session analysis');
    expect(fetchSessionAnalysis).toHaveBeenCalledTimes(2);
    expect(fetchSessionAnalysis).toHaveBeenLastCalledWith(2026, 10, 'Qualifying Race', true);
    expect(Analytics.sessionAnalysisLoadFailed).toHaveBeenCalledWith(10, 'Qualifying Race', 'HTTP 500');
    fetchSessionAnalysis.mockResolvedValue(FILE);
    fireEvent.press(retry);
    expect(Analytics.sessionAnalysisRetried).toHaveBeenCalledWith(10, 'Qualifying Race');
    jest.useRealTimers();
  });
});

describe('favourite summaries', () => {
  it('Lap Times: says where the favourite ranks on pace without a misleading P-number', async () => {
    const {findByText, queryByText} = renderWithProviders(<LapTimesCard {...PROPS} isFavourite={n => n === 'Tom INGRAM'} />);
    expect(await findByText(/2nd fastest lap/)).toBeTruthy();
    expect(queryByText('P2')).toBeNull();
  });

  it('Top 5 Average: fastest favourite reads as quickest on average', async () => {
    const {findByText} = renderWithProviders(<TopSpeedsCard {...PROPS} useKm={false} isFavourite={n => n === 'Ricky COLLARD'} />);
    expect(await findByText(/Quickest on average/)).toBeTruthy();
    expect(await findByText('P1')).toBeTruthy();
  });

  it('shows nothing when no favourite took part', async () => {
    const {findByText, queryByText} = renderWithProviders(<TopSpeedsCard {...PROPS} useKm={false} />);
    await findByText('146.2');
    expect(queryByText('YOUR DRIVER')).toBeNull();
  });
});

describe('TyresCard', () => {
  it('orders by classification, shows compound usage and draws tyre icons', async () => {
    const results = [{number: 11}, {number: 80}];
    const {findByText, getByText, getAllByLabelText} = renderWithProviders(<TyresCard {...PROPS} results={results} />);
    await findByText('cars on Medium');
    expect(getByText('car on Soft')).toBeTruthy();
    expect(getAllByLabelText('Medium')).toHaveLength(3); // usage tile + both drivers
    expect(Analytics.tyresShown).toHaveBeenCalledWith(10, 'Qualifying Race', 2);
  });

  it('tells a favourite driver\'s tyre story', async () => {
    const results = [{number: 11}, {number: 80}];
    const {findByText} = renderWithProviders(
      <TyresCard {...PROPS} results={results} isFavourite={n => n === 'Ricky COLLARD'} />,
    );
    expect(await findByText('Medium, then Soft')).toBeTruthy();
    expect(await findByText('YOUR DRIVER')).toBeTruthy();
  });
});

describe('TopSpeedsCard', () => {
  it('shows average and best in mph', async () => {
    const {findByText, getByText} = renderWithProviders(<TopSpeedsCard {...PROPS} useKm={false} />);
    await findByText('146.2');
    expect(getByText('146.8')).toBeTruthy();
    expect(Analytics.topSpeedsShown).toHaveBeenCalledWith(10, 'Qualifying Race', 'Intermediate 2', 1);
  });

  it('converts to km/h', async () => {
    const {findByText} = renderWithProviders(<TopSpeedsCard {...PROPS} useKm />);
    expect(await findByText('235.3')).toBeTruthy();
  });
});

describe('SessionStatsCard', () => {
  it('shows start delay, totals, class bests and fastest lap progression', async () => {
    const {findByText, getByText} = renderWithProviders(<SessionStatsCard {...PROPS} useKm={false} />);
    await findByText('Started 20 min late (14:50)');
    expect(getByText('15:09')).toBeTruthy();
    expect(getByText('560 miles covered')).toBeTruthy();
    expect(getByText('15 min session')).toBeTruthy();
    expect(getByText('MANUFACTURER')).toBeTruthy();
    expect(getByText('INDEPENDENT')).toBeTruthy();
    expect(getByText('1:37.529')).toBeTruthy();
    expect(Analytics.sessionStatsShown).toHaveBeenCalledWith(10, 'Qualifying Race');
  });

  it('folds in weather and flag incidents', async () => {
    const {findByText, getByText} = renderWithProviders(
      <SessionStatsCard {...PROPS} useKm={false} weather={{condition: 'Rain', track: 'Wet'}} flagStats={{green: 2, red: 0, safetyCar: 2, fcy: 0}} />,
    );
    await findByText('Rain');
    expect(getByText('Track wet')).toBeTruthy();
    expect(getByText('Safety Car x2')).toBeTruthy();
  });

  it('shows a clean-session chip when no flags flew', async () => {
    const {findByText} = renderWithProviders(
      <SessionStatsCard {...PROPS} useKm={false} flagStats={{green: 1, red: 0, safetyCar: 0, fcy: 0}} />,
    );
    expect(await findByText('Green all the way - no flag incidents')).toBeTruthy();
  });

  it('credits a favourite who held the fastest lap', async () => {
    const {findByText} = renderWithProviders(
      <SessionStatsCard {...PROPS} useKm={false} isFavourite={n => n === 'Aiden MOFFAT'} />,
    );
    expect(await findByText("Set the session's fastest lap 2 times")).toBeTruthy();
  });

  it('tags qualifying group on merged qualifying history', async () => {
    fetchSessionAnalysis.mockResolvedValue({...FILE, sessionStats: {...FILE.sessionStats,
      fastestLapHistory: [{no: 16, driver: 'Aiden MOFFAT', time: '1:29.000', lap: 4, group: 2}]}});
    const {findByText} = renderWithProviders(<SessionStatsCard {...PROPS} session="Qualifying" useKm={false} />);
    expect(await findByText('G2 L4')).toBeTruthy();
  });
});
