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
import ProgressionChart from '../../src/components/ProgressionChart';
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
      <ProgressionChart series={SERIES} roundLabels={ROUND_LABELS} />,
    );
    await waitFor(() => {
      expect(getByText('Ingram')).toBeTruthy();
      expect(getByText('Shedden')).toBeTruthy();
      expect(getByText('Turkington')).toBeTruthy();
    });
  });

  it('renders points totals in legend', async () => {
    const {getByText} = renderWithProviders(
      <ProgressionChart series={SERIES} roundLabels={ROUND_LABELS} />,
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
      <ProgressionChart series={dupesSeries} roundLabels={['R1']} />,
    );
    // Only one "Ingram" entry should appear in the legend
    await waitFor(() => expect(getAllByText('Ingram').length).toBe(1));
  });

  // ── Show all / Hide all ───────────────────────────────────────────────────────

  it('shows "Show all" and "Hide all" buttons', async () => {
    const {getByText} = renderWithProviders(
      <ProgressionChart series={SERIES} roundLabels={ROUND_LABELS} />,
    );
    await waitFor(() => {
      expect(getByText('Show all')).toBeTruthy();
      expect(getByText('Hide all')).toBeTruthy();
    });
  });

  it('has accessible labels for Show all and Hide all', async () => {
    const {getByLabelText} = renderWithProviders(
      <ProgressionChart series={SERIES} roundLabels={ROUND_LABELS} />,
    );
    await waitFor(() => {
      expect(getByLabelText('Show all drivers')).toBeTruthy();
      expect(getByLabelText('Hide all drivers')).toBeTruthy();
    });
  });

  it('each legend item has a toggle accessibility label', async () => {
    const {getByLabelText} = renderWithProviders(
      <ProgressionChart series={SERIES} roundLabels={ROUND_LABELS} />,
    );
    await waitFor(() => {
      expect(getByLabelText('Toggle Tom Ingram on chart')).toBeTruthy();
      expect(getByLabelText('Toggle Gordon Shedden on chart')).toBeTruthy();
    });
  });

  // ── Toggle behaviour ──────────────────────────────────────────────────────────

  it('pressing Hide all does not crash', async () => {
    const {getByLabelText} = renderWithProviders(
      <ProgressionChart series={SERIES} roundLabels={ROUND_LABELS} />,
    );
    await waitFor(() => getByLabelText('Hide all drivers'));
    expect(() => fireEvent.press(getByLabelText('Hide all drivers'))).not.toThrow();
  });

  it('pressing Show all after Hide all restores all drivers', async () => {
    const {getByLabelText, getAllByText} = renderWithProviders(
      <ProgressionChart series={SERIES} roundLabels={ROUND_LABELS} />,
    );
    await waitFor(() => getByLabelText('Hide all drivers'));
    fireEvent.press(getByLabelText('Hide all drivers'));
    fireEvent.press(getByLabelText('Show all drivers'));
    // All surnames should still be visible in legend
    await waitFor(() => expect(getAllByText('Ingram').length).toBe(1));
  });

  it('pressing a driver legend item does not crash', async () => {
    const {getByLabelText} = renderWithProviders(
      <ProgressionChart series={SERIES} roundLabels={ROUND_LABELS} />,
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
      <ProgressionChart series={nullSeries} roundLabels={['R1','R2','R3','R4']} />,
    );
    await waitFor(() => expect(getByText('Joiner')).toBeTruthy());
  });

  // ── Empty / edge cases ────────────────────────────────────────────────────────

  it('renders with an empty series array', async () => {
    const {toJSON} = renderWithProviders(
      <ProgressionChart series={[]} roundLabels={[]} />,
    );
    await waitFor(() => expect(toJSON()).toBeTruthy());
  });

  it('renders hint text', async () => {
    const {getByText} = renderWithProviders(
      <ProgressionChart series={SERIES} roundLabels={ROUND_LABELS} />,
    );
    await waitFor(() => expect(getByText('Tap a driver to show or hide their line')).toBeTruthy());
  });
});
