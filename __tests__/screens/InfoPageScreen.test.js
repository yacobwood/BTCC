import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {fireEvent, waitFor} from '@testing-library/react-native';
import InfoPageScreen from '../../src/screens/InfoPageScreen';
import {renderWithProviders, makeNav, makeRoute} from './testUtils';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn(), infoPageViewed: jest.fn()},
}));

const nav = makeNav();

const PAGE = {
  id: 'about-btcc',
  title: 'About BTCC',
  sections: [
    {type: 'text', body: 'The British Touring Car Championship is the UK\'s premier motorsport series.'},
    {type: 'heading', body: 'History'},
    {type: 'text', body: 'Founded in 1958, it has grown significantly.'},
  ],
};

describe('InfoPageScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Header ────────────────────────────────────────────────────────────────────

  it('renders page title uppercased in header', async () => {
    const {getByText} = renderWithProviders(
      <InfoPageScreen route={makeRoute({page: PAGE})} navigation={nav} />,
    );
    await waitFor(() => expect(getByText('ABOUT BTCC')).toBeTruthy());
  });

  it('renders back button and navigates back when pressed', async () => {
    const {getByLabelText} = renderWithProviders(
      <InfoPageScreen route={makeRoute({page: PAGE})} navigation={nav} />,
    );
    await waitFor(() => getByLabelText('Go back'));
    fireEvent.press(getByLabelText('Go back'));
    expect(nav.goBack).toHaveBeenCalled();
  });

  // ── Content sections ──────────────────────────────────────────────────────────

  it('renders text section content', () => {
    const {getByText} = renderWithProviders(
      <InfoPageScreen route={makeRoute({page: PAGE})} navigation={nav} />,
    );
    expect(getByText('The British Touring Car Championship is the UK\'s premier motorsport series.')).toBeTruthy();
  });

  it('renders heading section', () => {
    const {getByText} = renderWithProviders(
      <InfoPageScreen route={makeRoute({page: PAGE})} navigation={nav} />,
    );
    expect(getByText('History')).toBeTruthy();
  });

  it('renders multiple text sections', () => {
    const {getByText} = renderWithProviders(
      <InfoPageScreen route={makeRoute({page: PAGE})} navigation={nav} />,
    );
    expect(getByText('Founded in 1958, it has grown significantly.')).toBeTruthy();
  });

  // ── Empty sections ────────────────────────────────────────────────────────────

  it('renders without crashing when sections is empty', async () => {
    const emptyPage = {...PAGE, sections: []};
    const {toJSON} = renderWithProviders(
      <InfoPageScreen route={makeRoute({page: emptyPage})} navigation={nav} />,
    );
    await waitFor(() => expect(toJSON()).toBeTruthy());
  });

  // ── Speed unit conversion (kph ↔ mph) ─────────────────────────────────────────

  const speedPage = (sections) => ({id: 'btcc-ttb', title: 'TTB', sections});

  it('converts kph to mph in text sections when units are set to mph', async () => {
    // Default AsyncStorage returns null → useKm=false (mph)
    AsyncStorage.getItem.mockResolvedValue(null);
    const {getByText} = renderWithProviders(
      <InfoPageScreen
        route={makeRoute({page: speedPage([{type: 'text', body: '1st: 140 kph, 1 sec/lap'}])})}
        navigation={nav}
      />,
    );
    // 140 / 1.60934 = 87.017… → Math.round → 87
    await waitFor(() => expect(getByText('1st: 87 mph, 1 sec/lap')).toBeTruthy());
  });

  it('leaves kph unchanged in text sections when units are set to km', async () => {
    AsyncStorage.getItem.mockImplementation((key) =>
      key === 'use_km' ? Promise.resolve('true') : Promise.resolve(null),
    );
    const {getByText} = renderWithProviders(
      <InfoPageScreen
        route={makeRoute({page: speedPage([{type: 'text', body: '1st: 140 kph, 1 sec/lap'}])})}
        navigation={nav}
      />,
    );
    await waitFor(() => expect(getByText('1st: 140 kph, 1 sec/lap')).toBeTruthy());
  });

  it('converts multiple kph values within the same text body', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    const {getByText} = renderWithProviders(
      <InfoPageScreen
        route={makeRoute({page: speedPage([{type: 'text', body: 'Min 140 kph, max 200 kph'}])})}
        navigation={nav}
      />,
    );
    // 140→87, 200→124
    await waitFor(() => expect(getByText('Min 87 mph, max 124 mph')).toBeTruthy());
  });

  it('converts kph in heading sections', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    const {getByText} = renderWithProviders(
      <InfoPageScreen
        route={makeRoute({page: speedPage([{type: 'heading', body: 'Deploy above 140 kph'}])})}
        navigation={nav}
      />,
    );
    await waitFor(() => expect(getByText('Deploy above 87 mph')).toBeTruthy());
  });

  it('converts kph in callout sections', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    const {getByText} = renderWithProviders(
      <InfoPageScreen
        route={makeRoute({page: speedPage([{type: 'callout', body: 'Must exceed 105 kph to deploy'}])})}
        navigation={nav}
      />,
    );
    // 105 / 1.60934 = 65.24… → 65
    await waitFor(() => expect(getByText('Must exceed 65 mph to deploy')).toBeTruthy());
  });

  it('leaves text without kph values unchanged', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    const body = 'No speed values here.';
    const {getByText} = renderWithProviders(
      <InfoPageScreen
        route={makeRoute({page: speedPage([{type: 'text', body}])})}
        navigation={nav}
      />,
    );
    await waitFor(() => expect(getByText(body)).toBeTruthy());
  });
});
