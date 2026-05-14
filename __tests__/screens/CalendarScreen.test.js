import React from 'react';
import {act, fireEvent, waitFor} from '@testing-library/react-native';
import CalendarScreen from '../../src/screens/CalendarScreen';
import {renderWithProviders, makeNav} from './testUtils';
import * as liveUrlsStore from '../../src/store/liveUrls';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn(), pullToRefresh: jest.fn()},
}));

jest.mock('../../src/api/client', () => ({
  fetchCalendar: jest.fn(),
  fetchLiveStatus: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../../src/utils/broadcaster', () => ({
  BROADCASTERS: {
    uk:            {label: 'ITV4 / ITVX',   sub: 'Free · UK',        url: 'https://www.itv.com/hub/itv4'},
    international: {label: 'Official BTCC', sub: 'Free · Worldwide', url: 'https://www.youtube.com/@OfficialBTCC/streams'},
  },
  detectBroadcaster: jest.fn(() => 'uk'),
  useBroadcaster: jest.fn(() => 'uk'),
}));
jest.mock('../../src/api/parsers', () => ({
  parseCalendar: jest.fn(),
}));

const {fetchCalendar, fetchLiveStatus} = require('../../src/api/client');
const {parseCalendar} = require('../../src/api/parsers');
const {useBroadcaster} = require('../../src/utils/broadcaster');

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

  it('calls fetchCalendar with 2026 on mount', async () => {
    renderWithProviders(<CalendarScreen navigation={nav} />);
    await waitFor(() => {
      expect(fetchCalendar).toHaveBeenCalledWith(2026);
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

  // ── Year selector ─────────────────────────────────────────────────────────────

  describe('year selector', () => {
    const MOCK_ROUNDS_2027 = [
      {round: 1, venue: 'Donington Park', startDate: '2027-04-10', endDate: '2027-04-11', sessions: []},
      {round: 2, venue: 'Brands Hatch Indy', startDate: '2027-05-08', endDate: '2027-05-09', sessions: []},
    ];

    it('renders both year pills', async () => {
      const {getByText} = renderWithProviders(<CalendarScreen navigation={nav} />);
      await waitFor(() => {
        expect(getByText('2026')).toBeTruthy();
        expect(getByText('2027')).toBeTruthy();
      });
    });

    it('tapping 2027 calls fetchCalendar with 2027', async () => {
      fetchCalendar.mockReturnValue({rounds: MOCK_ROUNDS_2027});
      parseCalendar.mockReturnValue({rounds: MOCK_ROUNDS_2027});
      const {getByText} = renderWithProviders(<CalendarScreen navigation={nav} />);
      await waitFor(() => getByText('2027'));

      await act(async () => {
        fireEvent.press(getByText('2027'));
      });

      await waitFor(() => {
        expect(fetchCalendar).toHaveBeenCalledWith(2027);
      });
    });

    it('switching to 2027 renders 2027 venue names', async () => {
      const {getByText, queryByText} = renderWithProviders(<CalendarScreen navigation={nav} />);
      await waitFor(() => getByText('Donington Park'));

      fetchCalendar.mockReturnValue({rounds: MOCK_ROUNDS_2027});
      parseCalendar.mockReturnValue({rounds: MOCK_ROUNDS_2027});

      await act(async () => {
        fireEvent.press(getByText('2027'));
      });

      await waitFor(() => {
        expect(getByText('Brands Hatch Indy')).toBeTruthy();
      });
    });

    it('switching back to 2026 re-loads 2026 data', async () => {
      fetchCalendar.mockReturnValue({rounds: MOCK_ROUNDS_2027});
      parseCalendar.mockReturnValue({rounds: MOCK_ROUNDS_2027});
      const {getByText} = renderWithProviders(<CalendarScreen navigation={nav} />);
      await waitFor(() => getByText('2027'));

      await act(async () => {
        fireEvent.press(getByText('2027'));
      });

      fetchCalendar.mockReturnValue({rounds: MOCK_ROUNDS});
      parseCalendar.mockReturnValue({rounds: MOCK_ROUNDS});

      await act(async () => {
        fireEvent.press(getByText('2026'));
      });

      await waitFor(() => {
        expect(fetchCalendar).toHaveBeenCalledWith(2026);
        expect(getByText('Thruxton')).toBeTruthy();
      });
    });

    it('2027 rounds with empty sessions do not show session times', async () => {
      fetchCalendar.mockReturnValue({rounds: MOCK_ROUNDS_2027});
      parseCalendar.mockReturnValue({rounds: MOCK_ROUNDS_2027});
      const {getByText, queryByText} = renderWithProviders(<CalendarScreen navigation={nav} />);
      await waitFor(() => getByText('2027'));

      await act(async () => {
        fireEvent.press(getByText('2027'));
      });

      await waitFor(() => {
        expect(queryByText('10:35')).toBeNull();
        expect(queryByText('11:30')).toBeNull();
      });
    });
  });

  // ── Watch Live button ─────────────────────────────────────────────────────────
  // ACTIVE_ROUND spans 2026-05-09 (Sat) to 2026-05-10 (Sun).
  // Sunday tests use liveUrls sunday entries; Saturday tests require a saturday uk url.

  describe('Watch Live button', () => {
    const ACTIVE_ROUND = {
      round: 2,
      venue: 'Brands Hatch Indy',
      startDate: '2026-05-09',
      endDate: '2026-05-10',
      sessions: [],
    };

    let liveUrlsSpy;

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-05-10T12:00:00Z')); // Sunday by default
      useBroadcaster.mockReturnValue('uk');
      liveUrlsSpy = jest.spyOn(liveUrlsStore, 'useLiveUrls').mockReturnValue({
        saturday: {uk: null, international: null, us: null},
        sunday: {uk: {url: 'https://www.itv.com/hub/itv4', label: 'ITV4 / ITVX'}, international: {url: 'https://www.youtube.com/@OfficialBTCC/streams', label: 'Official BTCC'}, us: null},
      });
    });

    afterEach(() => { jest.useRealTimers(); liveUrlsSpy.mockRestore(); });

    it('shows WATCH LIVE on Sunday during an active race weekend', async () => {
      setupCalendar([ACTIVE_ROUND]);
      const {findByText} = renderWithProviders(<CalendarScreen navigation={nav} />);
      expect(await findByText('WATCH LIVE')).toBeTruthy();
    });

    it('shows ITV4 / ITVX label for UK users on Sunday', async () => {
      useBroadcaster.mockReturnValue('uk');
      setupCalendar([ACTIVE_ROUND]);
      const {findByText} = renderWithProviders(<CalendarScreen navigation={nav} />);
      expect(await findByText(/ITV4/)).toBeTruthy();
    });

    it('does not show WATCH LIVE for US users on Sunday (no broadcaster configured)', async () => {
      useBroadcaster.mockReturnValue('us');
      setupCalendar([ACTIVE_ROUND]);
      const {queryByText} = renderWithProviders(<CalendarScreen navigation={nav} />);
      await waitFor(() => expect(queryByText('WATCH LIVE')).toBeNull());
    });

    it('shows Official BTCC label for international users on Sunday', async () => {
      useBroadcaster.mockReturnValue('international');
      setupCalendar([ACTIVE_ROUND]);
      const {findByText} = renderWithProviders(<CalendarScreen navigation={nav} />);
      expect(await findByText(/Official BTCC/)).toBeTruthy();
    });

    it('does not show WATCH LIVE on Saturday when saturday url is null', async () => {
      jest.setSystemTime(new Date('2026-05-09T12:00:00Z')); // Saturday
      setupCalendar([ACTIVE_ROUND]);
      const {queryByText} = renderWithProviders(<CalendarScreen navigation={nav} />);
      await waitFor(() => expect(queryByText('WATCH LIVE')).toBeNull());
    });

    it('does not show WATCH LIVE on Saturday for international users (UK-only stream)', async () => {
      jest.setSystemTime(new Date('2026-05-09T12:00:00Z')); // Saturday
      useBroadcaster.mockReturnValue('international');
      liveUrlsSpy.mockReturnValue({
        saturday: {uk: {url: 'https://www.youtube.com/@ITVSport/streams', label: 'YouTube'}, international: null, us: null},
        sunday: {uk: null, international: null, us: null},
      });
      setupCalendar([ACTIVE_ROUND]);
      const {queryByText} = renderWithProviders(<CalendarScreen navigation={nav} />);
      await waitFor(() => expect(queryByText('WATCH LIVE')).toBeNull());
    });

    it('shows WATCH LIVE on Saturday when saturday uk url is set', async () => {
      jest.setSystemTime(new Date('2026-05-09T12:00:00Z')); // Saturday
      liveUrlsSpy.mockReturnValue({
        saturday: {uk: {url: 'https://www.youtube.com/@ITVSport/streams', label: 'YouTube'}, international: null, us: null},
        sunday: {uk: null, international: null, us: null},
      });
      setupCalendar([ACTIVE_ROUND]);
      const {findByText} = renderWithProviders(<CalendarScreen navigation={nav} />);
      expect(await findByText('WATCH LIVE')).toBeTruthy();
      expect(await findByText(/YouTube/)).toBeTruthy();
    });

    it('does not show WATCH LIVE when no round is active', async () => {
      setupCalendar([{...ACTIVE_ROUND, startDate: '2026-04-05', endDate: '2026-04-06'}]);
      const {queryByText} = renderWithProviders(<CalendarScreen navigation={nav} />);
      await waitFor(() => expect(queryByText('WATCH LIVE')).toBeNull());
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
