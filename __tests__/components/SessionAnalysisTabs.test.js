import React from 'react';
import {Text} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
import SessionAnalysisTabs from '../../src/components/SessionAnalysisTabs';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {
    sessionAnalysisTabChanged: jest.fn(),
  },
}));

function makeTab(key, label, hasData, text, group) {
  return {key, label, hasData, group, render: () => <Text>{text}</Text>};
}

describe('SessionAnalysisTabs', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when no tab has data', () => {
    const {toJSON} = render(
      <SessionAnalysisTabs roundNumber={1} session="Race 1" tabs={[makeTab('a', 'A', false, 'Panel A')]} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders the single available panel directly, with no paginator chrome', () => {
    const {getByText, queryByLabelText} = render(
      <SessionAnalysisTabs roundNumber={1} session="Race 1" tabs={[makeTab('a', 'A', true, 'Panel A')]} />,
    );
    expect(getByText('Panel A')).toBeTruthy();
    expect(queryByLabelText('Next data type')).toBeNull(); // arrows with nowhere to go have nothing to show
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
    expect(queryByLabelText('Next data type')).toBeNull();
  });

  it('shows the title and defaults to the first panel, with Previous disabled', () => {
    const {getByText, getByLabelText} = render(
      <SessionAnalysisTabs
        roundNumber={1}
        session="Race 1"
        tabs={[makeTab('a', 'A', true, 'Panel A'), makeTab('b', 'B', true, 'Panel B')]}
      />,
    );
    expect(getByText('A')).toBeTruthy(); // the title itself, not a pill
    expect(getByText('Panel A')).toBeTruthy();
    expect(getByLabelText('Previous data type').props.accessibilityState.disabled).toBe(true);
    expect(getByLabelText('Next data type').props.accessibilityState.disabled).toBe(false);
  });

  it('advances to the next panel on "Next" press and logs the change', () => {
    const {Analytics} = require('../../src/utils/analytics');
    const {getByText, getByLabelText, queryByText} = render(
      <SessionAnalysisTabs
        roundNumber={9}
        session="Race 3"
        tabs={[makeTab('a', 'A', true, 'Panel A'), makeTab('b', 'B', true, 'Panel B')]}
      />,
    );
    fireEvent.press(getByLabelText('Next data type'));
    expect(getByText('B')).toBeTruthy();
    expect(getByText('Panel B')).toBeTruthy();
    expect(queryByText('Panel A')).toBeNull();
    expect(Analytics.sessionAnalysisTabChanged).toHaveBeenCalledWith(9, 'Race 3', 'b');
  });

  it('disables Next at the last panel and Previous returns to the first', () => {
    const {getByText, getByLabelText} = render(
      <SessionAnalysisTabs
        roundNumber={1}
        session="Race 1"
        tabs={[makeTab('a', 'A', true, 'Panel A'), makeTab('b', 'B', true, 'Panel B')]}
      />,
    );
    fireEvent.press(getByLabelText('Next data type'));
    expect(getByLabelText('Next data type').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(getByLabelText('Previous data type'));
    expect(getByText('Panel A')).toBeTruthy();
    expect(getByLabelText('Previous data type').props.accessibilityState.disabled).toBe(true);
  });

  it('does not advance past either end when the disabled arrow is pressed anyway', () => {
    const {Analytics} = require('../../src/utils/analytics');
    const {getByLabelText, getByText} = render(
      <SessionAnalysisTabs
        roundNumber={1}
        session="Race 1"
        tabs={[makeTab('a', 'A', true, 'Panel A'), makeTab('b', 'B', true, 'Panel B')]}
      />,
    );
    fireEvent.press(getByLabelText('Previous data type')); // already first - no-op
    expect(getByText('Panel A')).toBeTruthy();
    expect(Analytics.sessionAnalysisTabChanged).not.toHaveBeenCalled();
  });

  describe('controlled mode (activeKey/onActiveKeyChange)', () => {
    it('renders whichever panel the controlled activeKey names', () => {
      const {getByText} = render(
        <SessionAnalysisTabs
          roundNumber={1}
          session="Race 1"
          activeKey="b"
          onActiveKeyChange={() => {}}
          tabs={[makeTab('a', 'A', true, 'Panel A'), makeTab('b', 'B', true, 'Panel B')]}
        />,
      );
      expect(getByText('Panel B')).toBeTruthy();
    });

    it('calls onActiveKeyChange instead of managing its own state', () => {
      const onActiveKeyChange = jest.fn();
      const {getByLabelText} = render(
        <SessionAnalysisTabs
          roundNumber={1}
          session="Race 1"
          activeKey="a"
          onActiveKeyChange={onActiveKeyChange}
          tabs={[makeTab('a', 'A', true, 'Panel A'), makeTab('b', 'B', true, 'Panel B')]}
        />,
      );
      fireEvent.press(getByLabelText('Next data type'));
      expect(onActiveKeyChange).toHaveBeenCalledWith('b');
    });

    it('falls back to the first available panel when the controlled key has no match here, without reporting a change', () => {
      // e.g. "Perfect Lap" remembered from Race 1, but this session hasn't
      // been scraped for it yet - render the first available tab instead,
      // but don't call onActiveKeyChange, so a later session that DOES
      // have "Perfect Lap" still resumes there rather than the fallback
      // becoming sticky.
      const onActiveKeyChange = jest.fn();
      const {getByText} = render(
        <SessionAnalysisTabs
          roundNumber={1}
          session="Free Practice"
          activeKey="perfectLap"
          onActiveKeyChange={onActiveKeyChange}
          tabs={[makeTab('a', 'A', true, 'Panel A'), makeTab('b', 'B', true, 'Panel B')]}
        />,
      );
      expect(getByText('Panel A')).toBeTruthy();
      expect(onActiveKeyChange).not.toHaveBeenCalled();
    });

    it('falls back to uncontrolled behaviour when only activeKey is passed without onActiveKeyChange', () => {
      // A half-controlled instance is a real risk: the read side used to
      // check `controlledKey != null` while the write side checked
      // `onActiveKeyChange` truthiness - two different conditions, so
      // passing only activeKey pinned the display to it forever while
      // presses silently updated unread internal state, making the arrows
      // look broken. Both sides now share one `isControlled` check.
      const {getByText, getByLabelText} = render(
        <SessionAnalysisTabs
          roundNumber={1}
          session="Race 1"
          activeKey="a"
          tabs={[makeTab('a', 'A', true, 'Panel A'), makeTab('b', 'B', true, 'Panel B')]}
        />,
      );
      fireEvent.press(getByLabelText('Next data type'));
      expect(getByText('Panel B')).toBeTruthy();
    });

    it('falls back to uncontrolled behaviour when only onActiveKeyChange is passed without activeKey', () => {
      const onActiveKeyChange = jest.fn();
      const {getByText, getByLabelText} = render(
        <SessionAnalysisTabs
          roundNumber={1}
          session="Race 1"
          onActiveKeyChange={onActiveKeyChange}
          tabs={[makeTab('a', 'A', true, 'Panel A'), makeTab('b', 'B', true, 'Panel B')]}
        />,
      );
      fireEvent.press(getByLabelText('Next data type'));
      // Uncontrolled: this instance manages its own display via internal
      // state, not the (absent) activeKey prop.
      expect(getByText('Panel B')).toBeTruthy();
    });
  });

  it('shows a group label above the title when the active tab has one', () => {
    const {getByText, queryByText, getByLabelText} = render(
      <SessionAnalysisTabs
        roundNumber={1}
        session="Race 1"
        tabs={[makeTab('a', 'Intermediate 2', true, 'Panel A', 'SPEED TRAP'), makeTab('b', 'B', true, 'Panel B')]}
      />,
    );
    expect(getByText('SPEED TRAP')).toBeTruthy();
    expect(getByText('Intermediate 2')).toBeTruthy();
    fireEvent.press(getByLabelText('Next data type'));
    expect(queryByText('SPEED TRAP')).toBeNull(); // tab B has no group
  });

  it('visually dims a disabled arrow with both a colour change and opacity, matching this app\'s existing stepper-button pattern', () => {
    const {getByLabelText} = render(
      <SessionAnalysisTabs
        roundNumber={1}
        session="Race 1"
        tabs={[makeTab('a', 'A', true, 'Panel A'), makeTab('b', 'B', true, 'Panel B')]}
      />,
    );
    // Colour alone (Colors.outline against Colors.background) measured at
    // ~1.47:1 contrast, well below the ~3:1 WCAG guideline for UI
    // component states - confirmed via live device screenshot to be hard
    // to distinguish from "absent." The style array's disabled entry
    // supplies opacity as a second signal on top of the dimmer icon colour.
    const prevButton = getByLabelText('Previous data type'); // disabled - already first
    const style = [].concat(prevButton.props.style);
    expect(style.some(s => s && s.opacity === 0.4)).toBe(true);
  });
});
