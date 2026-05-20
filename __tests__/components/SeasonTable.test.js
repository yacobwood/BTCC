import React from 'react';
import {waitFor, fireEvent} from '@testing-library/react-native';
import {InteractionManager} from 'react-native';
import SeasonTable from '../../src/components/SeasonTable';
import {renderWithProviders} from '../screens/testUtils';

// SeasonTable defers render via InteractionManager — run synchronously in tests
beforeEach(() => {
  jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation(cb => {
    cb();
    return {cancel: jest.fn()};
  });
});

const RESULTS = [
  {
    round: 1,
    venue: 'Donington Park',
    races: [
      {
        label: 'Race 1',
        results: [
          {driver: 'Tom Ingram',       position: 1, laps: 20, time: '30:01.0', points: 25, fastestLap: false, leadLap: false, pole: false, team: 'Team Ingram'},
          {driver: 'Gordon Shedden',   position: 2, laps: 20, time: '30:02.0', points: 18, fastestLap: true,  leadLap: false, pole: false, team: 'Laser Tools'},
          {driver: 'Colin Turkington', position: 0, laps:  5, time: 'DNF',     points:  0, fastestLap: false, leadLap: false, pole: false, team: 'WSR'},
        ],
      },
      {
        label: 'Race 2',
        results: [
          {driver: 'Gordon Shedden',   position: 1, laps: 20, time: '30:00.0', points: 25, fastestLap: false, leadLap: false, pole: true,  team: 'Laser Tools'},
          {driver: 'Tom Ingram',       position: 2, laps: 20, time: '30:01.5', points: 18, fastestLap: false, leadLap: true,  pole: false, team: 'Team Ingram'},
          {driver: 'Colin Turkington', position: 0, laps:  0, time: 'DNS',     points:  0, fastestLap: false, leadLap: false, pole: false, team: 'WSR'},
        ],
      },
    ],
  },
];

const RESULTS_QR = [
  {
    round: 1,
    venue: 'Brands Hatch',
    races: [
      {label: 'Qualifying Race', results: [{driver: 'Tom Ingram', position: 1, laps: 10, time: '20:00', points: 4, fastestLap: false, leadLap: false, pole: false, team: 'Team Ingram'}]},
      {label: 'Race 1',         results: [{driver: 'Tom Ingram', position: 1, laps: 20, time: '30:00', points: 25, fastestLap: false, leadLap: false, pole: false, team: 'Team Ingram'}]},
    ],
  },
];

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('SeasonTable', () => {
  it('shows loading indicator before InteractionManager fires', () => {
    jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation(() => ({cancel: jest.fn()}));
    const {UNSAFE_queryByType} = renderWithProviders(<SeasonTable results={RESULTS} />);
    const {ActivityIndicator} = require('react-native');
    expect(UNSAFE_queryByType(ActivityIndicator)).toBeTruthy();
  });

  it('shows empty state when no results provided', async () => {
    const {getByText} = renderWithProviders(<SeasonTable results={[]} />);
    await waitFor(() => expect(getByText('No race results available')).toBeTruthy());
  });

  it('renders driver names', async () => {
    const {getByText} = renderWithProviders(<SeasonTable results={RESULTS} />);
    // SeasonTable shows surname in uppercase
    await waitFor(() => {
      expect(getByText('INGRAM')).toBeTruthy();
      expect(getByText('SHEDDEN')).toBeTruthy();
      expect(getByText('TURKINGTON')).toBeTruthy();
    });
  });

  it('renders venue abbreviation in header', async () => {
    const {getByText} = renderWithProviders(<SeasonTable results={RESULTS} />);
    await waitFor(() => expect(getByText('DON')).toBeTruthy());
  });

  it('includes Qualifying Race column when QR data present', async () => {
    const {getByText} = renderWithProviders(<SeasonTable results={RESULTS_QR} />);
    await waitFor(() => expect(getByText('QR')).toBeTruthy());
  });

  it('omits Qualifying Race column when no QR data', async () => {
    const {queryByText} = renderWithProviders(<SeasonTable results={RESULTS} />);
    await waitFor(() => expect(queryByText('QR')).toBeNull());
  });

  it('sorts drivers by points descending', async () => {
    const {getAllByText} = renderWithProviders(<SeasonTable results={RESULTS} />);
    await waitFor(() => {
      // Tom: 25+18=43 pts, Gordon: 18+25=43 pts, Colin: 0 — tied first, Colin last
      // Rank labels 1 and 2 and 3 should all be present (coerce to string - RN renders numbers)
      const ranks = getAllByText(/^[123]$/).map(el => String(el.props.children));
      expect(ranks).toContain('1');
      expect(ranks).toContain('3'); // Colin is last
    });
  });

  it('overrides points from official standings when provided', async () => {
    const standings = {drivers: [{name: 'Tom Ingram', points: 999}]};
    const {getByText} = renderWithProviders(<SeasonTable results={RESULTS} standings={standings} />);
    await waitFor(() => expect(getByText('999')).toBeTruthy());
  });

  it('renders KEY toggle button', async () => {
    const {getByText} = renderWithProviders(<SeasonTable results={RESULTS} />);
    await waitFor(() => expect(getByText('KEY')).toBeTruthy());
  });

  it('renders BONUS POINTS section after expanding the key', async () => {
    const {getByText} = renderWithProviders(<SeasonTable results={RESULTS} />);
    await waitFor(() => getByText('KEY'));
    fireEvent.press(getByText('KEY'));
    await waitFor(() => expect(getByText('BONUS POINTS')).toBeTruthy());
  });
});

// ─── Badge logic via rendered output ─────────────────────────────────────────

describe('SeasonTable badge display', () => {
  // Note: badge labels also appear in the KEY legend, so use getAllByText

  it('shows DSQ label for disqualified entry', async () => {
    const dsqResults = [{
      round: 1, venue: 'Thruxton',
      races: [{label: 'Race 1', results: [{driver: 'Test Driver', position: 1, laps: 20, time: 'DSQ', points: 0, fastestLap: false, leadLap: false, pole: false, team: 'Test'}]}],
    }];
    const {getAllByText} = renderWithProviders(<SeasonTable results={dsqResults} />);
    await waitFor(() => expect(getAllByText('DSQ').length).toBeGreaterThan(0));
  });

  it('shows Ret label for retired entry (pos=0, laps>0)', async () => {
    const retResults = [{
      round: 1, venue: 'Thruxton',
      races: [{label: 'Race 1', results: [{driver: 'Test Driver', position: 0, laps: 5, time: 'DNF', points: 0, fastestLap: false, leadLap: false, pole: false, team: 'Test'}]}],
    }];
    const {getAllByText} = renderWithProviders(<SeasonTable results={retResults} />);
    await waitFor(() => expect(getAllByText('Ret').length).toBeGreaterThan(0));
  });

  it('shows DNS label for did-not-start entry (pos=0, laps=0)', async () => {
    const dnsResults = [{
      round: 1, venue: 'Thruxton',
      races: [{label: 'Race 1', results: [{driver: 'Test Driver', position: 0, laps: 0, time: 'DNS', points: 0, fastestLap: false, leadLap: false, pole: false, team: 'Test'}]}],
    }];
    const {getAllByText} = renderWithProviders(<SeasonTable results={dnsResults} />);
    await waitFor(() => expect(getAllByText('DNS').length).toBeGreaterThan(0));
  });

  it('shows FL bonus label for fastest lap', async () => {
    const flResults = [{
      round: 1, venue: 'Thruxton',
      races: [{label: 'Race 1', results: [{driver: 'Test Driver', position: 4, laps: 20, time: '30:00', points: 12, fastestLap: true, leadLap: false, pole: false, team: 'Test'}]}],
    }];
    const {getAllByText} = renderWithProviders(<SeasonTable results={flResults} />);
    // FL appears in both the badge bonus and the BONUS POINTS key
    await waitFor(() => expect(getAllByText('FL').length).toBeGreaterThan(0));
  });

  it('shows PP bonus label for pole position', async () => {
    const ppResults = [{
      round: 1, venue: 'Thruxton',
      races: [{label: 'Race 1', results: [{driver: 'Test Driver', position: 1, laps: 20, time: '30:00', points: 25, fastestLap: false, leadLap: false, pole: true, team: 'Test'}]}],
    }];
    const {getAllByText} = renderWithProviders(<SeasonTable results={ppResults} />);
    await waitFor(() => expect(getAllByText('PP').length).toBeGreaterThan(0));
  });

  it('shows no FL/LL/PP bonus badges on QR cells (reg 1.6.2.a — flags stripped by parsers)', async () => {
    // parsers.js strips fastestLap/leadLap/pole to false for QR results;
    // this test confirms SeasonTable renders no bonus badges when those flags are false.
    const qrResults = [{
      round: 1, venue: 'Brands Hatch',
      races: [{
        label: 'Qualifying Race',
        results: [{driver: 'Test Driver', position: 1, laps: 10, time: '20:00', points: 10,
          fastestLap: false, leadLap: false, pole: false, team: 'Test'}],
      }],
    }];
    const {queryAllByText} = renderWithProviders(<SeasonTable results={qrResults} />);
    await waitFor(() => {
      // KEY is collapsed by default, so FL/PP/LL appear 0 times — none in QR result cells
      expect(queryAllByText('FL')).toHaveLength(0);
      expect(queryAllByText('PP')).toHaveLength(0);
      expect(queryAllByText('LL')).toHaveLength(0);
    });
  });
});
