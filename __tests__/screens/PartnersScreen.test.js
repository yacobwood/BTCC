import React from 'react';
import {fireEvent, waitFor} from '@testing-library/react-native';
import PartnersScreen from '../../src/screens/PartnersScreen';
import {renderWithProviders, makeNav} from './testUtils';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn(), moreItemClicked: jest.fn()},
}));

const nav = makeNav();

describe('PartnersScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Header ────────────────────────────────────────────────────────────────────

  it('renders PARTNERS & SPONSORS header', () => {
    const {getByText} = renderWithProviders(<PartnersScreen navigation={nav} />);
    expect(getByText('PARTNERS & SPONSORS')).toBeTruthy();
  });

  it('renders back button and navigates back when pressed', () => {
    const {getByLabelText} = renderWithProviders(<PartnersScreen navigation={nav} />);
    fireEvent.press(getByLabelText('Go back'));
    expect(nav.goBack).toHaveBeenCalled();
  });

  // ── Intro text ────────────────────────────────────────────────────────────────

  it('renders intro description text', () => {
    const {getByText} = renderWithProviders(<PartnersScreen navigation={nav} />);
    expect(getByText(/The BTCC is supported by a range of partners/)).toBeTruthy();
  });

  // ── Partner cards ─────────────────────────────────────────────────────────────

  it('renders Kwik Fit partner', () => {
    const {getByText} = renderWithProviders(<PartnersScreen navigation={nav} />);
    expect(getByText('Kwik Fit')).toBeTruthy();
  });

  it('renders Goodyear partner', () => {
    const {getByText} = renderWithProviders(<PartnersScreen navigation={nav} />);
    expect(getByText('Goodyear')).toBeTruthy();
  });

  it('renders multiple partner names', () => {
    const {getByText} = renderWithProviders(<PartnersScreen navigation={nav} />);
    expect(getByText('Kwik Fit')).toBeTruthy();
    expect(getByText('Goodyear')).toBeTruthy();
    expect(getByText('Liqui Moly')).toBeTruthy();
  });

  it('renders Visit website button for Kwik Fit', () => {
    const {getByLabelText} = renderWithProviders(<PartnersScreen navigation={nav} />);
    expect(getByLabelText('Visit Kwik Fit website')).toBeTruthy();
  });

  it('renders Visit website button for Goodyear', () => {
    const {getByLabelText} = renderWithProviders(<PartnersScreen navigation={nav} />);
    expect(getByLabelText('Visit Goodyear website')).toBeTruthy();
  });

  it('pressing a Visit website button does not crash', () => {
    const {getByLabelText} = renderWithProviders(<PartnersScreen navigation={nav} />);
    expect(() => fireEvent.press(getByLabelText('Visit Kwik Fit website'))).not.toThrow();
  });
});
