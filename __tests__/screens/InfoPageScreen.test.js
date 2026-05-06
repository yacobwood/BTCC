import React from 'react';
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
});
