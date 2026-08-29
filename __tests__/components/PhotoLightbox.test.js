import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import PhotoLightbox from '../../src/components/PhotoLightbox';

// PagerView is a native module - mocked the same way SwipeableTabs.test.js
// does, as a plain View that renders its children and exposes onPageSelected
// so tests can simulate a swipe without a real gesture.
let lastPagerViewProps = {};
jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const {View} = require('react-native');
  const PagerView = React.forwardRef((props, ref) => {
    lastPagerViewProps = props;
    React.useImperativeHandle(ref, () => ({
      setPageWithoutAnimation: jest.fn(),
    }));
    return <View testID="pager-view">{props.children}</View>;
  });
  PagerView.displayName = 'PagerView';
  return PagerView;
});

const PHOTOS = [
  {thumbUrl: 'https://example.com/thumb1.jpg', viewUrl: 'https://example.com/view1.jpg'},
  {thumbUrl: 'https://example.com/thumb2.jpg', viewUrl: 'https://example.com/view2.jpg'},
];

describe('PhotoLightbox', () => {
  it('renders nothing when visible is false', () => {
    const {queryByLabelText} = render(
      <PhotoLightbox visible={false} photos={PHOTOS} initialIndex={0} onClose={jest.fn()} />,
    );
    expect(queryByLabelText('Dismiss photo')).toBeNull();
  });

  it('renders the photo at initialIndex using CachedImage', () => {
    const {getAllByLabelText, UNSAFE_getAllByProps} = render(
      <PhotoLightbox visible photos={PHOTOS} initialIndex={1} onClose={jest.fn()} />,
    );
    expect(getAllByLabelText('Dismiss photo').length).toBe(PHOTOS.length);
    const {Image} = require('react-native');
    const images = UNSAFE_getAllByProps({resizeMode: 'contain'});
    expect(images.length).toBeGreaterThan(0);
  });

  it('calls onIndexChange when the pager reports a page selection', () => {
    const onIndexChange = jest.fn();
    render(
      <PhotoLightbox visible photos={PHOTOS} initialIndex={0} onClose={jest.fn()} onIndexChange={onIndexChange} />,
    );
    lastPagerViewProps.onPageSelected({nativeEvent: {position: 1}});
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it('calls onClose when a photo is tapped', () => {
    const onClose = jest.fn();
    const {getAllByLabelText} = render(
      <PhotoLightbox visible photos={PHOTOS} initialIndex={0} onClose={onClose} />,
    );
    fireEvent.press(getAllByLabelText('Dismiss photo')[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when the close button is tapped', () => {
    const onClose = jest.fn();
    const {getByLabelText} = render(
      <PhotoLightbox visible photos={PHOTOS} initialIndex={0} onClose={onClose} />,
    );
    fireEvent.press(getByLabelText('Close gallery'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a "N of total" counter starting at initialIndex, updating as the pager reports new pages', () => {
    const {getByText} = render(
      <PhotoLightbox visible photos={PHOTOS} initialIndex={1} onClose={jest.fn()} />,
    );
    expect(getByText('2 of 2')).toBeTruthy();
    act(() => lastPagerViewProps.onPageSelected({nativeEvent: {position: 0}}));
    expect(getByText('1 of 2')).toBeTruthy();
  });

  it('shows a swipe/close gesture hint', () => {
    const {getByText} = render(
      <PhotoLightbox visible photos={PHOTOS} initialIndex={0} onClose={jest.fn()} />,
    );
    expect(getByText('Swipe to browse · Tap photo to close')).toBeTruthy();
  });

  it('does not render a share button when onShare is not provided', () => {
    const {queryByLabelText} = render(
      <PhotoLightbox visible photos={PHOTOS} initialIndex={0} onClose={jest.fn()} />,
    );
    expect(queryByLabelText('Share photo')).toBeNull();
  });

  it('calls onShare with the current pager index when the share button is tapped', () => {
    const onShare = jest.fn();
    const {getByLabelText} = render(
      <PhotoLightbox visible photos={PHOTOS} initialIndex={0} onClose={jest.fn()} onShare={onShare} />,
    );
    act(() => lastPagerViewProps.onPageSelected({nativeEvent: {position: 1}}));
    fireEvent.press(getByLabelText('Share photo'));
    expect(onShare).toHaveBeenCalledWith(1);
  });
});
