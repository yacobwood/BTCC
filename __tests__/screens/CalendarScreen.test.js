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
});
