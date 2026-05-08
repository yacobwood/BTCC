import React from 'react';
import {waitFor} from '@testing-library/react-native';
import CalendarScreen from '../../src/screens/CalendarScreen';
import {renderWithProviders, makeNav} from './testUtils';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn(), pullToRefresh: jest.fn()},
}));

// fetchCalendar returns the bundled calendar JSON synchronously
jest.mock('../../src/api/client', () => ({
  fetchCalendar: jest.fn(),
}));
jest.mock('../../src/api/parsers', () => ({
  parseCalendar: jest.fn(),
}));

const {fetchCalendar} = require('../../src/api/client');
const {parseCalendar} = require('../../src/api/parsers');

const MOCK_ROUNDS = [
  {round: 1, venue: 'Donington Park', startDate: '2025-04-19', endDate: '2025-04-20', date: '19–20 Apr 2025', sessions: []},
  {round: 2, venue: 'Brands Hatch',   startDate: '2025-05-10', endDate: '2025-05-11', date: '10–11 May 2025', sessions: []},
  {round: 3, venue: 'Thruxton',       startDate: '2026-06-14', endDate: '2026-06-15', date: '14–15 Jun 2026', sessions: []},
];

function setupCalendar(rounds = MOCK_ROUNDS) {
  fetchCalendar.mockReturnValue({rounds});
  parseCalendar.mockReturnValue({rounds});
}

const nav = makeNav();

describe('CalendarScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupCalendar();
  });

  it('renders round venue names', async () => {
    const {getByText} = renderWithProviders(<CalendarScreen navigation={nav} />);
    await waitFor(() => {
      expect(getByText('Donington Park')).toBeTruthy();
      expect(getByText('Brands Hatch')).toBeTruthy();
    });
  });

  it('renders all rounds from the calendar', async () => {
    const {getByText} = renderWithProviders(<CalendarScreen navigation={nav} />);
    await waitFor(() => {
      expect(getByText('Thruxton')).toBeTruthy();
    });
  });

  it('shows empty state when calendar has no rounds', async () => {
    setupCalendar([]);
    const {queryByText} = renderWithProviders(<CalendarScreen navigation={nav} />);
    // No round venues should appear
    await waitFor(() => {
      expect(queryByText('Donington Park')).toBeNull();
    });
  });

  it('calls fetchCalendar on mount', async () => {
    renderWithProviders(<CalendarScreen navigation={nav} />);
    await waitFor(() => {
      expect(fetchCalendar).toHaveBeenCalled();
    });
  });

  it('calls parseCalendar with the fetched data', async () => {
    const rawData = {rounds: MOCK_ROUNDS};
    fetchCalendar.mockReturnValue(rawData);
    renderWithProviders(<CalendarScreen navigation={nav} />);
    await waitFor(() => {
      expect(parseCalendar).toHaveBeenCalledWith(rawData);
    });
  });

  // ── Countdown label (next upcoming round) ─────────────────────────────────────
  // daysUntil() uses new Date() internally, so we pin the clock to make these
  // deterministic regardless of when the test suite runs.

  describe('countdown label', () => {
    // Pin to 2026-05-07 midnight UTC. Rounds must have startDate > '2026-05-07'
    // to be treated as the next upcoming round (not active or past).
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-05-07T00:00:00Z'));
    });

    afterEach(() => jest.useRealTimers());

    it('shows 1 and DAY when the next round starts tomorrow', async () => {
      setupCalendar([
        {round: 1, venue: 'Brands Hatch', startDate: '2026-05-08', endDate: '2026-05-09', date: '8–9 May 2026', sessions: []},
      ]);
      const {getByText, queryByText} = renderWithProviders(<CalendarScreen navigation={nav} />);
      await waitFor(() => {
        expect(getByText('1')).toBeTruthy();
        expect(getByText('DAY')).toBeTruthy();
      });
      // Confirm the old "TMW" label is gone
      expect(queryByText('TMW')).toBeNull();
    });

    it('shows the day count and DAYS when the next round starts in multiple days', async () => {
      setupCalendar([
        {round: 1, venue: 'Thruxton', startDate: '2026-05-10', endDate: '2026-05-11', date: '10–11 May 2026', sessions: []},
      ]);
      const {getByText} = renderWithProviders(<CalendarScreen navigation={nav} />);
      // 2026-05-07 → 2026-05-10 = 3 days
      await waitFor(() => {
        expect(getByText('3')).toBeTruthy();
        expect(getByText('DAYS')).toBeTruthy();
      });
    });

    it('uses singular DAY for exactly 1 day and plural DAYS for 2+', async () => {
      // 1-day round
      setupCalendar([
        {round: 1, venue: 'Round A', startDate: '2026-05-08', endDate: '2026-05-09', date: '8–9 May 2026', sessions: []},
        {round: 2, venue: 'Round B', startDate: '2026-05-14', endDate: '2026-05-15', date: '14–15 May 2026', sessions: []},
      ]);
      const {getByText, queryByText} = renderWithProviders(<CalendarScreen navigation={nav} />);
      await waitFor(() => {
        // Only the next round (Round A, 1 day away) shows the countdown
        expect(getByText('DAY')).toBeTruthy();
        expect(queryByText('DAYS')).toBeNull();
      });
    });
  });
});
