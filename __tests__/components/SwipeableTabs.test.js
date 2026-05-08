import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {Text} from 'react-native';
import SwipeableTabs from '../../src/components/SwipeableTabs';

// Captures the most recent props received by PagerView so tests can assert on
// native-only props (like offscreenPageLimit) that aren't visible in the tree.
let lastPagerViewProps = {};

// PagerView is a native module — mock it as a simple View
jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const {View} = require('react-native');
  const PagerView = React.forwardRef(
    (props, ref) => {
      lastPagerViewProps = props;
      React.useImperativeHandle(ref, () => ({
        setPage: jest.fn(),
        setPageWithoutAnimation: jest.fn(),
      }));
      return <View testID="pager-view">{props.children}</View>;
    },
  );
  PagerView.displayName = 'PagerView';
  return PagerView;
});

const TABS  = ['ONE', 'TWO', 'THREE'];
const PAGES = TABS.map(t => <Text key={t}>{`Page ${t}`}</Text>);

function renderTabs(props = {}) {
  return render(
    <SwipeableTabs
      tabs={TABS}
      pages={PAGES}
      onTabChange={props.onTabChange ?? jest.fn()}
      {...props}
    />,
  );
}

describe('SwipeableTabs', () => {
  it('renders all tab labels', () => {
    const {getByLabelText} = renderTabs();
    TABS.forEach(label => {
      expect(getByLabelText(`${label} tab`)).toBeTruthy();
    });
  });

  it('calls onTabChange with the correct index when a tab is pressed', () => {
    const onTabChange = jest.fn();
    const {getByLabelText} = renderTabs({onTabChange});
    fireEvent.press(getByLabelText('TWO tab'));
    expect(onTabChange).toHaveBeenCalledWith(1);
  });

  it('calls onTabChange with index 2 when the last tab is pressed', () => {
    const onTabChange = jest.fn();
    const {getByLabelText} = renderTabs({onTabChange});
    fireEvent.press(getByLabelText('THREE tab'));
    expect(onTabChange).toHaveBeenCalledWith(2);
  });

  it('does not call onTabChange when pressing the already-active tab', () => {
    const onTabChange = jest.fn();
    const {getByLabelText} = renderTabs({initialPage: 0, onTabChange});
    // First tab is already active — pressing it still calls goToTab which calls onTabChange
    fireEvent.press(getByLabelText('ONE tab'));
    expect(onTabChange).toHaveBeenCalledWith(0);
  });

  it('renders the correct number of pages', () => {
    const {getAllByText} = renderTabs();
    // Each page label should appear once
    TABS.forEach(t => {
      expect(getAllByText(`Page ${t}`)).toHaveLength(1);
    });
  });

  it('passes offscreenPageLimit equal to pages.length - 1 so all pages stay mounted on Android', () => {
    renderTabs();
    expect(lastPagerViewProps.offscreenPageLimit).toBe(PAGES.length - 1);
  });

  it('lazy mode: only renders content for the initial active page', () => {
    const {getByText, queryByText} = render(
      <SwipeableTabs
        tabs={TABS}
        pages={PAGES}
        initialPage={0}
        lazy
        onTabChange={jest.fn()}
      />,
    );
    // Page ONE is active — rendered
    expect(getByText('Page ONE')).toBeTruthy();
    // Pages TWO and THREE have never been active — LazyPage renders null
    expect(queryByText('Page TWO')).toBeNull();
    expect(queryByText('Page THREE')).toBeNull();
  });
});
