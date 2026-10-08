// jest.setup.js globally stubs ProgressionChart as () => null — override with the real component
jest.mock('../../src/components/ProgressionChart', () => jest.requireActual('../../src/components/ProgressionChart'));

// jest.setup.js SVG mock lacks a default export; add one so `import Svg from 'react-native-svg'` works
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Svg: 'Svg', Polyline: 'Polyline', Line: 'Line',
  Text: 'SvgText', Path: 'Path', Circle: 'Circle', G: 'G',
}));

import React from 'react';
import {fireEvent, waitFor} from '@testing-library/react-native';
import ProgressionChart, {alignSeriesToAxis} from '../../src/components/ProgressionChart';
import {renderWithProviders} from '../screens/testUtils';

const SERIES = [
  {name: 'Tom Ingram',     points: [0, 25, 50, 75]},
  {name: 'Gordon Shedden', points: [0, 18, 43, 68]},
  {name: 'Colin Turkington', points: [0, 12, 37, 62]},
];

const ROUND_LABELS = ['R1', 'R2', 'R3'];

describe('ProgressionChart', () => {
  // ── Legend rendering ─────────────────────────────────────────────────────────

  it('renders driver surnames in the legend', async () => {
    const {getByText} = renderWithProviders(
      <ProgressionChart series={SERIES} pointLabels={ROUND_LABELS} />,
    );
    await waitFor(() => {
      expect(getByText('INGRAM')).toBeTruthy();
      expect(getByText('SHEDDEN')).toBeTruthy();
      expect(getByText('TURKINGTON')).toBeTruthy();
    });
  });

  it('renders points totals in legend', async () => {
    const {getByText} = renderWithProviders(
      <ProgressionChart series={SERIES} pointLabels={ROUND_LABELS} />,
    );
    await waitFor(() => {
      expect(getByText('75 pts')).toBeTruthy();
      expect(getByText('68 pts')).toBeTruthy();
    });
  });

  it('deduplicates series with the same name', async () => {
    const dupesSeries = [
      {name: 'Tom Ingram', points: [0, 25]},
      {name: 'Tom Ingram', points: [0, 99]}, // duplicate — should be ignored
      {name: 'Gordon Shedden', points: [0, 18]},
    ];
    const {getAllByText} = renderWithProviders(
      <ProgressionChart series={dupesSeries} pointLabels={['R1']} />,
    );
    // Only one "Ingram" entry should appear in the legend
    await waitFor(() => expect(getAllByText('INGRAM').length).toBe(1));
  });

  // ── Show all / Hide all ───────────────────────────────────────────────────────

  it('shows "Show all" and "Hide all" buttons', async () => {
    const {getByText} = renderWithProviders(
      <ProgressionChart series={SERIES} pointLabels={ROUND_LABELS} />,
    );
    await waitFor(() => {
      expect(getByText('Show all')).toBeTruthy();
      expect(getByText('Hide all')).toBeTruthy();
    });
  });

  it('has accessible labels for Show all and Hide all', async () => {
    const {getByLabelText} = renderWithProviders(
      <ProgressionChart series={SERIES} pointLabels={ROUND_LABELS} />,
    );
    await waitFor(() => {
      expect(getByLabelText('Show all drivers')).toBeTruthy();
      expect(getByLabelText('Hide all drivers')).toBeTruthy();
    });
  });

  it('each legend item has a toggle accessibility label', async () => {
    const {getByLabelText} = renderWithProviders(
      <ProgressionChart series={SERIES} pointLabels={ROUND_LABELS} />,
    );
    await waitFor(() => {
      expect(getByLabelText('Toggle Tom Ingram on chart')).toBeTruthy();
      expect(getByLabelText('Toggle Gordon Shedden on chart')).toBeTruthy();
    });
  });

  // ── Toggle behaviour ──────────────────────────────────────────────────────────

  it('pressing Hide all does not crash', async () => {
    const {getByLabelText} = renderWithProviders(
      <ProgressionChart series={SERIES} pointLabels={ROUND_LABELS} />,
    );
    await waitFor(() => getByLabelText('Hide all drivers'));
    expect(() => fireEvent.press(getByLabelText('Hide all drivers'))).not.toThrow();
  });

  it('pressing Show all after Hide all restores all drivers', async () => {
    const {getByLabelText, getAllByText} = renderWithProviders(
      <ProgressionChart series={SERIES} pointLabels={ROUND_LABELS} />,
    );
    await waitFor(() => getByLabelText('Hide all drivers'));
    fireEvent.press(getByLabelText('Hide all drivers'));
    fireEvent.press(getByLabelText('Show all drivers'));
    // All surnames should still be visible in legend
    await waitFor(() => expect(getAllByText('INGRAM').length).toBe(1));
  });

  it('pressing a driver legend item does not crash', async () => {
    const {getByLabelText} = renderWithProviders(
      <ProgressionChart series={SERIES} pointLabels={ROUND_LABELS} />,
    );
    await waitFor(() => getByLabelText('Toggle Tom Ingram on chart'));
    expect(() => fireEvent.press(getByLabelText('Toggle Tom Ingram on chart'))).not.toThrow();
  });

  // ── Null gap handling ─────────────────────────────────────────────────────────

  it('renders without crashing when series contains null gaps', async () => {
    const nullSeries = [
      {name: 'Late Joiner', points: [null, null, 0, 18, 43]},
      {name: 'Tom Ingram',  points: [0, 25, 50, 75, 100]},
    ];
    const {getByText} = renderWithProviders(
      <ProgressionChart series={nullSeries} pointLabels={['R1','R2','R3','R4']} />,
    );
    await waitFor(() => expect(getByText('JOINER')).toBeTruthy());
  });

  // ── Empty / edge cases ────────────────────────────────────────────────────────

  it('renders with an empty series array', async () => {
    const {toJSON} = renderWithProviders(
      <ProgressionChart series={[]} pointLabels={[]} />,
    );
    await waitFor(() => expect(toJSON()).toBeTruthy());
  });

  it('renders hint text', async () => {
    const {getByText} = renderWithProviders(
      <ProgressionChart series={SERIES} pointLabels={ROUND_LABELS} />,
    );
    await waitFor(() => expect(getByText('Tap a driver to show or hide their line')).toBeTruthy());
  });
});

// ── Mid-season joiner alignment ───────────────────────────────────────────────
// A part-time driver's `points` array (from computeProgression) starts at their
// real first race, not race 1 - it carries a `start` offset (the pointLabels
// index of that first race). alignSeriesToAxis must place their line on the
// shared X axis using that offset, not left-shift it back to the origin.
describe('alignSeriesToAxis', () => {
  it('pads a mid-season joiner with leading nulls instead of left-shifting to race 1', () => {
    const rawSeries = [
      {name: 'Alice', points: [20, 37, 55], start: 0}, // full season
      {name: 'Bob', points: [20], start: 2}, // only entered the 3rd race
    ];
    const pointLabels = ['', '', 'R1'];
    const aligned = alignSeriesToAxis(rawSeries, pointLabels);

    const alice = aligned.find(s => s.name === 'Alice');
    const bob = aligned.find(s => s.name === 'Bob');
    // index 0 = R0 origin, indices 1..3 map onto pointLabels[0..2]
    expect(alice.points).toEqual([0, 20, 37, 55]);
    expect(bob.points).toEqual([null, null, null, 20]);
  });

  it('defaults a missing start to 0 for backward compatibility', () => {
    const aligned = alignSeriesToAxis([{name: 'Alice', points: [10, 20]}], ['R1', 'R2']);
    expect(aligned[0].points).toEqual([0, 10, 20]);
  });

  it('drops a mid-season joiner from the rendered line until their real first race', async () => {
    const rawSeries = [
      {name: 'Tom Ingram', points: [25, 50, 75], start: 0},
      {name: 'Part Timer', points: [18, 43], start: 1}, // missed race 1
    ];
    const {getByLabelText, toJSON} = renderWithProviders(
      <ProgressionChart series={rawSeries} pointLabels={['R1', 'R2', 'R3']} />,
    );
    await waitFor(() => getByLabelText('Toggle Part Timer on chart'));

    const polylines = [];
    const collect = (node) => {
      if (!node) return;
      if (node.type === 'Polyline') polylines.push(node);
      (node.children || []).forEach(collect);
    };
    collect(toJSON());

    // Part Timer only has 2 real points (start=1), so their line must be a
    // single 2-point segment - never one connecting back through race 1.
    const partTimerSegments = polylines.filter(p => p.props.points.split(' ').length === 2);
    expect(partTimerSegments.length).toBeGreaterThan(0);
    const [p1x] = partTimerSegments[0].props.points.split(' ')[0].split(',').map(Number);
    const [originX] = polylines[0].props.points.split(' ')[0].split(',').map(Number);
    // Their first plotted point must sit to the right of the shared R0 origin x,
    // not on top of it (which is what the left-shift bug produced).
    expect(p1x).toBeGreaterThan(originX);
  });
});
