// jest.setup.js globally stubs LapChartCard as () => null — override with the real component
jest.mock('../../src/components/LapChartCard', () => jest.requireActual('../../src/components/LapChartCard'));

// jest.setup.js SVG mock lacks a default export; add one so `import Svg from 'react-native-svg'` works
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Svg: 'Svg', Polyline: 'Polyline', Line: 'Line',
  Text: 'SvgText', Path: 'Path', Circle: 'Circle', G: 'G',
}));

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {lapChartShown: jest.fn()},
}));

import React from 'react';
import {fireEvent, waitFor, within} from '@testing-library/react-native';
import LapChartCard from '../../src/components/LapChartCard';
import {Analytics} from '../../src/utils/analytics';
import {renderWithProviders} from '../screens/testUtils';

// Shape matches scrape_tsl.py's parse_lap_chart()/_resolve_lap_chart() output
// (see src/api/parsers.js's mapLapChart): `order` is the real running
// position order for that lap, index 0 is the leader.
const LAP_CHART = [
  {lap: 1, timeOfDay: '15:14:06.496', order: [
    {no: 33, driver: 'Ashley Sutton', team: 'Team VERTU', gapSeconds: null, lapsDown: null, lapTimeSeconds: 99.0},
    {no: 32, driver: 'Tom Chilton', team: 'Team VERTU', gapSeconds: 0.4, lapsDown: null, lapTimeSeconds: 99.5},
    {no: 2, driver: 'Josh Cook', team: 'NAPA Racing', gapSeconds: 0.9, lapsDown: null, lapTimeSeconds: 100.0},
  ]},
  {lap: 2, timeOfDay: '15:15:47.175', order: [
    {no: 32, driver: 'Tom Chilton', team: 'Team VERTU', gapSeconds: null, lapsDown: null, lapTimeSeconds: 99.0},
    {no: 33, driver: 'Ashley Sutton', team: 'Team VERTU', gapSeconds: 0.2, lapsDown: null, lapTimeSeconds: 99.3},
    {no: 2, driver: 'Josh Cook', team: 'NAPA Racing', gapSeconds: 1.1, lapsDown: null, lapTimeSeconds: 100.1},
  ]},
];

const isFavourite = () => false;

// getByText can't see text rendered through the mocked SvgText host
// component at all (confirmed: it reports "unable to find" even though
// the rendered JSON tree shows the exact string right there as a
// <SvgText> child) - so axis-label assertions walk the raw tree instead.
function polylinePointLists(node) {
  if (!node) return [];
  let found = node.type === 'Polyline' && node.props?.points ? [node.props.points.split(' ')] : [];
  if (Array.isArray(node.children)) {
    node.children.forEach(child => {
      if (typeof child === 'object') found = found.concat(polylinePointLists(child));
    });
  }
  return found;
}

function svgTextLabels(node) {
  if (!node) return [];
  let labels = node.type === 'SvgText' && Array.isArray(node.children) ? [node.children.join('')] : [];
  if (Array.isArray(node.children)) {
    node.children.forEach(child => {
      if (typeof child === 'object') labels = labels.concat(svgTextLabels(child));
    });
  }
  return labels;
}

describe('LapChartCard', () => {
  it('renders nothing when lapChart has no data yet', () => {
    const {toJSON} = renderWithProviders(
      <LapChartCard lapChart={null} roundNumber={1} session="Race 1" isFavourite={isFavourite} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('shows each driver name in the legend', async () => {
    const {getByText} = renderWithProviders(
      <LapChartCard lapChart={LAP_CHART} roundNumber={1} session="Race 1" isFavourite={isFavourite} />,
    );
    await waitFor(() => {
      expect(getByText('Ashley SUTTON')).toBeTruthy();
      expect(getByText('Tom CHILTON')).toBeTruthy();
      expect(getByText('Josh COOK')).toBeTruthy();
    });
  });

  it('labels the Y-axis with each driver\'s 3-letter code at their starting position', async () => {
    const {toJSON} = renderWithProviders(
      <LapChartCard lapChart={LAP_CHART} roundNumber={1} session="Race 1" isFavourite={isFavourite} />,
    );
    await waitFor(() => {
      const labels = svgTextLabels(toJSON());
      expect(labels).toContain('SUT');
      expect(labels).toContain('CHI');
      expect(labels).toContain('COO');
    });
  });

  it('a short surname is not padded - the code is just its own letters', async () => {
    const shortSurname = [
      {lap: 1, timeOfDay: '15:14:06.496', order: [
        {no: 1, driver: 'Alex Oz', team: 'Team VERTU', gapSeconds: null, lapsDown: null, lapTimeSeconds: 90},
      ]},
    ];
    const {toJSON} = renderWithProviders(
      <LapChartCard lapChart={shortSurname} roundNumber={1} session="Race 1" isFavourite={isFavourite} />,
    );
    await waitFor(() => expect(svgTextLabels(toJSON())).toContain('OZ'));
  });

  it('labels the legend with each driver\'s finishing position, not their starting one', async () => {
    const {getByText} = renderWithProviders(
      <LapChartCard lapChart={LAP_CHART} roundNumber={1} session="Race 1" isFavourite={isFavourite} />,
    );
    // Chilton led lap 1 only - Sutton leads the final lap, so finishes P1.
    await waitFor(() => {
      expect(getByText('P1')).toBeTruthy();
      expect(getByText('P2')).toBeTruthy();
      expect(getByText('P3')).toBeTruthy();
    });
  });

  it('re-ranks a lapped car behind every car with fewer laps down, even when it literally crosses the line first', async () => {
    // Confirmed live (2026 Silverstone Race 1, car 27/Dan Cammish): TSL's
    // own Lap Chart reports literal start/finish-line crossing order, so
    // a car 2 laps down can cross the line ahead of cars on the lead lap
    // purely by track position - plotted as-is that reads as the lapped
    // car's line randomly jumping to the front. The chart shows "effective
    // race position" instead: every car with fewer laps down sorts ahead
    // of every car with more, regardless of that lap's own literal order.
    const lappedCrossesFirst = [
      {lap: 1, timeOfDay: '15:14:06.496', order: [
        {no: 2, driver: 'Josh Cook', team: 'NAPA Racing', gapSeconds: null, lapsDown: 2, lapTimeSeconds: 100.0},
        {no: 33, driver: 'Ashley Sutton', team: 'Team VERTU', gapSeconds: 0.4, lapsDown: null, lapTimeSeconds: 99.0},
        {no: 32, driver: 'Tom Chilton', team: 'Team VERTU', gapSeconds: 0.9, lapsDown: null, lapTimeSeconds: 99.5},
      ]},
    ];
    const {getByLabelText} = renderWithProviders(
      <LapChartCard lapChart={lappedCrossesFirst} roundNumber={1} session="Race 1" isFavourite={isFavourite} />,
    );
    await waitFor(() => {
      expect(within(getByLabelText('Toggle Ashley Sutton on chart')).getByText('P1')).toBeTruthy();
      expect(within(getByLabelText('Toggle Tom Chilton on chart')).getByText('P2')).toBeTruthy();
      expect(within(getByLabelText('Toggle Josh Cook on chart')).getByText('P3')).toBeTruthy();
    });
  });

  it('bridges a one-lap gap in the source data rather than breaking the line, for a car with real data before and after', async () => {
    // Confirmed live (2026 Silverstone Race 1): car 27/Dan Cammish has no
    // row at all for laps 17 and 20 in TSL's own source PDF, yet has a
    // normal row again the very next lap each time - still racing, just a
    // one-off gap in the source, not a retirement. The old behaviour (hard
    // break on every null) rendered this as disconnected floating
    // fragments; it should draw straight through instead.
    const withGap = [
      {lap: 1, timeOfDay: 't1', order: [
        {no: 33, driver: 'Ashley Sutton', team: 'Team VERTU', gapSeconds: null, lapsDown: null, lapTimeSeconds: 99.0},
        {no: 32, driver: 'Tom Chilton', team: 'Team VERTU', gapSeconds: 0.4, lapsDown: null, lapTimeSeconds: 99.5},
      ]},
      {lap: 2, timeOfDay: 't2', order: [
        // car 33 (Sutton) has no row this lap - the gap - but reappears next lap
        {no: 32, driver: 'Tom Chilton', team: 'Team VERTU', gapSeconds: null, lapsDown: null, lapTimeSeconds: 99.0},
      ]},
      {lap: 3, timeOfDay: 't3', order: [
        {no: 33, driver: 'Ashley Sutton', team: 'Team VERTU', gapSeconds: null, lapsDown: null, lapTimeSeconds: 99.0},
        {no: 32, driver: 'Tom Chilton', team: 'Team VERTU', gapSeconds: 0.3, lapsDown: null, lapTimeSeconds: 99.2},
      ]},
    ];
    const {toJSON} = renderWithProviders(
      <LapChartCard lapChart={withGap} roundNumber={1} session="Race 1" isFavourite={isFavourite} />,
    );
    await waitFor(() => {
      const lines = polylinePointLists(toJSON());
      // Chilton has all 3 laps (3-point line); Sutton has laps 1 and 3
      // bridged across the lap-2 gap - exactly 2 points, not split into
      // two separate 1-point fragments that would each get dropped
      // entirely (the old, broken behaviour would show no line at all).
      expect(lines.some(pts => pts.length === 2)).toBe(true);
      expect(lines.some(pts => pts.length === 3)).toBe(true);
    });
  });

  it('marks a car absent from the final lap as Retired rather than giving it a finishing position', async () => {
    const withRetirement = [
      LAP_CHART[0],
      {lap: 2, timeOfDay: '15:15:47.175', order: [
        {no: 33, driver: 'Ashley Sutton', team: 'Team VERTU', gapSeconds: null, lapsDown: null, lapTimeSeconds: 99.0},
        {no: 32, driver: 'Tom Chilton', team: 'Team VERTU', gapSeconds: 0.2, lapsDown: null, lapTimeSeconds: 99.3},
        // car 2 (Josh Cook) retired after lap 1 - absent from lap 2's order
      ]},
    ];
    const {getByText} = renderWithProviders(
      <LapChartCard lapChart={withRetirement} roundNumber={1} session="Race 1" isFavourite={isFavourite} />,
    );
    await waitFor(() => expect(getByText('Retired')).toBeTruthy());
  });

  it('fires lapChartShown with the driver count and lap count', async () => {
    renderWithProviders(
      <LapChartCard lapChart={LAP_CHART} roundNumber={7} session="Race 2" isFavourite={isFavourite} />,
    );
    await waitFor(() => expect(Analytics.lapChartShown).toHaveBeenCalledWith(7, 'Race 2', 3, 2));
  });

  it('does not fire lapChartShown when there is no data', () => {
    renderWithProviders(
      <LapChartCard lapChart={[]} roundNumber={1} session="Race 1" isFavourite={isFavourite} />,
    );
    expect(Analytics.lapChartShown).not.toHaveBeenCalled();
  });

  it('shows "Show all" and "Hide all" buttons', async () => {
    const {getByText} = renderWithProviders(
      <LapChartCard lapChart={LAP_CHART} roundNumber={1} session="Race 1" isFavourite={isFavourite} />,
    );
    await waitFor(() => {
      expect(getByText('Show all')).toBeTruthy();
      expect(getByText('Hide all')).toBeTruthy();
    });
  });

  it('pressing Hide all then Show all does not crash and restores the legend', async () => {
    const {getByLabelText, getAllByText} = renderWithProviders(
      <LapChartCard lapChart={LAP_CHART} roundNumber={1} session="Race 1" isFavourite={isFavourite} />,
    );
    await waitFor(() => getByLabelText('Hide all drivers'));
    expect(() => fireEvent.press(getByLabelText('Hide all drivers'))).not.toThrow();
    fireEvent.press(getByLabelText('Show all drivers'));
    await waitFor(() => expect(getAllByText('Ashley SUTTON').length).toBe(1));
  });

  it('each legend item has a toggle accessibility label', async () => {
    const {getByLabelText} = renderWithProviders(
      <LapChartCard lapChart={LAP_CHART} roundNumber={1} session="Race 1" isFavourite={isFavourite} />,
    );
    await waitFor(() => expect(getByLabelText('Toggle Ashley Sutton on chart')).toBeTruthy());
  });

  it('renders without crashing for a single-lap session', async () => {
    const {toJSON} = renderWithProviders(
      <LapChartCard lapChart={[LAP_CHART[0]]} roundNumber={1} session="Qualifying" isFavourite={isFavourite} />,
    );
    await waitFor(() => expect(toJSON()).toBeTruthy());
  });

  it('renders hint text', async () => {
    const {getByText} = renderWithProviders(
      <LapChartCard lapChart={LAP_CHART} roundNumber={1} session="Race 1" isFavourite={isFavourite} />,
    );
    await waitFor(() => expect(getByText('Tap a driver to show or hide their line')).toBeTruthy());
  });
});
