import React from 'react';
import {waitFor} from '@testing-library/react-native';
import TeamDetailScreen from '../../src/screens/TeamDetailScreen';
import {renderWithProviders, makeNav, makeRoute} from './testUtils';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn()},
}));

const nav = makeNav();

function makeTeam(overrides = {}) {
  return {
    name: 'NAPA Racing UK',
    car: 'Ford Focus Titanium',
    entries: 2,
    drivers: [],
    ...overrides,
  };
}

function renderTeam(team) {
  return renderWithProviders(
    <TeamDetailScreen navigation={nav} route={makeRoute({team})} />,
  );
}

describe('TeamDetailScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the team name', async () => {
    const {getByText} = renderTeam(makeTeam());
    await waitFor(() => expect(getByText('NAPA Racing UK')).toBeTruthy());
  });

  // ── Season history ───────────────────────────────────────────────────────────

  it('shows a SEASON HISTORY section when the team has history', async () => {
    const {findByText} = renderTeam(makeTeam({
      history: [{year: 2015, pos: 7, points: 223}, {year: 2016, pos: 3, points: 538}],
    }));
    expect(await findByText('SEASON HISTORY')).toBeTruthy();
  });

  it('shows no SEASON HISTORY section when the team has no history', async () => {
    const {findByText, queryByText} = renderTeam(makeTeam({history: []}));
    await findByText('NAPA Racing UK');
    expect(queryByText('SEASON HISTORY')).toBeNull();
  });

  it('renders each season year, position and points', async () => {
    const {findByText} = renderTeam(makeTeam({
      history: [{year: 2015, pos: 7, points: 223}, {year: 2016, pos: 3, points: 538}],
    }));
    expect(await findByText('2016')).toBeTruthy();
    expect(await findByText('P3')).toBeTruthy();
    expect(await findByText('538 pts')).toBeTruthy();
    expect(await findByText('2015')).toBeTruthy();
    expect(await findByText('P7')).toBeTruthy();
    expect(await findByText('223 pts')).toBeTruthy();
  });

  it('sorts seasons most recent first', async () => {
    const {findByText, getAllByText} = renderTeam(makeTeam({
      history: [{year: 2015, pos: 7, points: 223}, {year: 2018, pos: 1, points: 700}, {year: 2016, pos: 3, points: 538}],
    }));
    await findByText('SEASON HISTORY');
    const years = getAllByText(/^20\d\d$/).map(el => el.props.children);
    expect(years).toEqual([2018, 2016, 2015]);
  });

  it('does not crash on a team with only one season of history (below CareerTimeline minimum)', async () => {
    const {findByText} = renderTeam(makeTeam({
      history: [{year: 2016, pos: 3, points: 538}],
    }));
    // CareerTimeline itself renders nothing for <2 seasons, but the year-list still should
    expect(await findByText('2016')).toBeTruthy();
  });
});
