import React from 'react';
import {Text} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
import SessionAnalysisTabs from '../../src/components/SessionAnalysisTabs';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {
    sessionAnalysisTabChanged: jest.fn(),
  },
}));

function makeTab(key, label, hasData, text) {
  return {key, label, hasData, render: () => <Text>{text}</Text>};
}

describe('SessionAnalysisTabs', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when no tab has data', () => {
    const {toJSON} = render(
      <SessionAnalysisTabs roundNumber={1} session="Race 1" tabs={[makeTab('a', 'A', false, 'Panel A')]} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders the single available panel directly, with no tab bar chrome', () => {
    const {getByText, queryByLabelText} = render(
      <SessionAnalysisTabs roundNumber={1} session="Race 1" tabs={[makeTab('a', 'A', true, 'Panel A')]} />,
    );
    expect(getByText('Panel A')).toBeTruthy();
    expect(queryByLabelText('A tab')).toBeNull(); // a single always-selected pill has nothing to select
  });

  it('ignores tabs with no data and still renders the sole remaining one directly', () => {
    const {getByText, queryByLabelText} = render(
      <SessionAnalysisTabs
        roundNumber={1}
        session="Race 1"
        tabs={[makeTab('a', 'A', false, 'Panel A'), makeTab('b', 'B', true, 'Panel B')]}
      />,
    );
    expect(getByText('Panel B')).toBeTruthy();
    expect(queryByLabelText('B tab')).toBeNull();
  });

  it('shows a tab per available panel and defaults to the first', () => {
    const {getByText, getByLabelText} = render(
      <SessionAnalysisTabs
        roundNumber={1}
        session="Race 1"
        tabs={[makeTab('a', 'A', true, 'Panel A'), makeTab('b', 'B', true, 'Panel B')]}
      />,
    );
    expect(getByLabelText('A tab')).toBeTruthy();
    expect(getByLabelText('B tab')).toBeTruthy();
    expect(getByText('Panel A')).toBeTruthy();
  });

  it('switches panels on tab press and logs the change', () => {
    const {Analytics} = require('../../src/utils/analytics');
    const {getByText, getByLabelText, queryByText} = render(
      <SessionAnalysisTabs
        roundNumber={9}
        session="Race 3"
        tabs={[makeTab('a', 'A', true, 'Panel A'), makeTab('b', 'B', true, 'Panel B')]}
      />,
    );
    fireEvent.press(getByLabelText('B tab'));
    expect(getByText('Panel B')).toBeTruthy();
    expect(queryByText('Panel A')).toBeNull();
    expect(Analytics.sessionAnalysisTabChanged).toHaveBeenCalledWith(9, 'Race 3', 'b');
  });

  it('marks the active tab as selected for accessibility', () => {
    const {getByLabelText} = render(
      <SessionAnalysisTabs
        roundNumber={1}
        session="Race 1"
        tabs={[makeTab('a', 'A', true, 'Panel A'), makeTab('b', 'B', true, 'Panel B')]}
      />,
    );
    expect(getByLabelText('A tab').props.accessibilityState.selected).toBe(true);
    expect(getByLabelText('B tab').props.accessibilityState.selected).toBe(false);
  });
});
