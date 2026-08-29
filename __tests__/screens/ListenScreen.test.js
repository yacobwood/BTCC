import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import ListenScreen from '../../src/screens/ListenScreen';
import * as featureFlags from '../../src/store/featureFlags';
import {makeNav} from './testUtils';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn(), moreItemClicked: jest.fn()},
}));

const nav = makeNav();

function renderListen(flags = {}) {
  jest.spyOn(featureFlags, 'useFeatureFlags').mockReturnValue(flags);
  return render(<ListenScreen navigation={nav} />);
}

describe('ListenScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('logs Analytics.screen("listen") on mount', () => {
    const {Analytics} = require('../../src/utils/analytics');
    renderListen();
    expect(Analytics.screen).toHaveBeenCalledWith('listen');
  });

  it('always shows TOCA Live Radio regardless of flags', () => {
    const {getByLabelText} = renderListen({});
    expect(getByLabelText('TOCA Live Radio')).toBeTruthy();
  });

  it('hides Online Radio and Podcasts when their flags are off', () => {
    const {queryByLabelText} = renderListen({radio_tab: false, podcasts_enabled: false});
    expect(queryByLabelText('Online Radio')).toBeNull();
    expect(queryByLabelText('Podcasts & Interviews')).toBeNull();
  });

  it('shows Online Radio only when radio_tab is on', () => {
    const {getByLabelText, queryByLabelText} = renderListen({radio_tab: true, podcasts_enabled: false});
    expect(getByLabelText('Online Radio')).toBeTruthy();
    expect(queryByLabelText('Podcasts & Interviews')).toBeNull();
  });

  it('shows Podcasts only when podcasts_enabled is on', () => {
    const {getByLabelText, queryByLabelText} = renderListen({radio_tab: false, podcasts_enabled: true});
    expect(getByLabelText('Podcasts & Interviews')).toBeTruthy();
    expect(queryByLabelText('Online Radio')).toBeNull();
  });

  it('pressing TOCA Live Radio logs the click and navigates to TocaRadio', () => {
    const {Analytics} = require('../../src/utils/analytics');
    const {getByLabelText} = renderListen({});
    fireEvent.press(getByLabelText('TOCA Live Radio'));
    expect(Analytics.moreItemClicked).toHaveBeenCalledWith('toca');
    expect(nav.navigate).toHaveBeenCalledWith('TocaRadio');
  });

  it('pressing Online Radio navigates to Radio', () => {
    const {getByLabelText} = renderListen({radio_tab: true});
    fireEvent.press(getByLabelText('Online Radio'));
    expect(nav.navigate).toHaveBeenCalledWith('Radio');
  });

  it('pressing Podcasts navigates to Podcasts', () => {
    const {getByLabelText} = renderListen({podcasts_enabled: true});
    fireEvent.press(getByLabelText('Podcasts & Interviews'));
    expect(nav.navigate).toHaveBeenCalledWith('Podcasts');
  });

  it('back button calls navigation.goBack()', () => {
    const {getByLabelText} = renderListen();
    fireEvent.press(getByLabelText('Go back'));
    expect(nav.goBack).toHaveBeenCalled();
  });
});
