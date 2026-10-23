import React from 'react';
import {Linking} from 'react-native';
import {fireEvent, waitFor} from '@testing-library/react-native';
import OnTheLimitScreen from '../../src/screens/OnTheLimitScreen';
import {renderWithProviders, makeNav} from './testUtils';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn(), moreItemClicked: jest.fn()},
}));

const nav = makeNav();

describe('OnTheLimitScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  it('calls Analytics.screen("on_the_limit") on mount', async () => {
    const {Analytics} = require('../../src/utils/analytics');
    renderWithProviders(<OnTheLimitScreen navigation={nav} />);
    await waitFor(() => expect(Analytics.screen).toHaveBeenCalledWith('on_the_limit'));
  });

  // ── Header ────────────────────────────────────────────────────────────────────

  it('renders ON THE LIMIT header', () => {
    const {getByText} = renderWithProviders(<OnTheLimitScreen navigation={nav} />);
    expect(getByText('ON THE LIMIT')).toBeTruthy();
  });

  it('renders back button and navigates back when pressed', () => {
    const {getByLabelText} = renderWithProviders(<OnTheLimitScreen navigation={nav} />);
    fireEvent.press(getByLabelText('Go back'));
    expect(nav.goBack).toHaveBeenCalled();
  });

  // ── Intro text ────────────────────────────────────────────────────────────────

  it('renders intro description text', () => {
    const {getByText} = renderWithProviders(<OnTheLimitScreen navigation={nav} />);
    expect(getByText(/end-of-season documentary series/)).toBeTruthy();
  });

  // ── Episode rows ──────────────────────────────────────────────────────────────

  it('renders all 6 episode years, 2020 through 2025', () => {
    const {getByText} = renderWithProviders(<OnTheLimitScreen navigation={nav} />);
    for (const year of [2020, 2021, 2022, 2023, 2024, 2025]) {
      expect(getByText(`On The Limit ${year}`)).toBeTruthy();
    }
  });

  it('renders a watch button for each episode', () => {
    const {getByLabelText} = renderWithProviders(<OnTheLimitScreen navigation={nav} />);
    for (const year of [2020, 2021, 2022, 2023, 2024, 2025]) {
      expect(getByLabelText(`Watch On The Limit ${year} on YouTube`)).toBeTruthy();
    }
  });

  it('pressing an episode opens its YouTube URL', () => {
    const {getByLabelText} = renderWithProviders(<OnTheLimitScreen navigation={nav} />);
    fireEvent.press(getByLabelText('Watch On The Limit 2025 on YouTube'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://youtu.be/zY5xrSfCs5I');
  });

  it('pressing an episode logs Analytics.moreItemClicked with the year', () => {
    const {Analytics} = require('../../src/utils/analytics');
    const {getByLabelText} = renderWithProviders(<OnTheLimitScreen navigation={nav} />);
    fireEvent.press(getByLabelText('Watch On The Limit 2022 on YouTube'));
    expect(Analytics.moreItemClicked).toHaveBeenCalledWith('on_the_limit_episode:2022');
  });

  it('every episode opens a bare youtu.be URL, never carrying a share tracking param', () => {
    // Guards against a future edit pasting a share link's `?si=...` param
    // back in, or a non-YouTube URL, by mistake.
    const {getByLabelText} = renderWithProviders(<OnTheLimitScreen navigation={nav} />);
    for (const year of [2020, 2021, 2022, 2023, 2024, 2025]) {
      fireEvent.press(getByLabelText(`Watch On The Limit ${year} on YouTube`));
    }
    for (const [url] of Linking.openURL.mock.calls) {
      expect(url).toMatch(/^https:\/\/youtu\.be\/[\w-]+$/);
    }
  });
});
