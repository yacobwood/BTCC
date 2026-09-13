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

  it('calls Analytics.screen("partners") on mount', async () => {
    const {Analytics} = require('../../src/utils/analytics');
    renderWithProviders(<PartnersScreen navigation={nav} />);
    await waitFor(() => expect(Analytics.screen).toHaveBeenCalledWith('partners'));
  });

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

  // ── Logo URLs ─────────────────────────────────────────────────────────────────
  //
  // Confirmed live 2026-09-12: every logo in this file hotlinked
  // btcc.net's old WordPress /wp-content/uploads/ path, dead since the
  // 2026-07-31 Vercel migration - the whole Partners screen rendered blank
  // white boxes. Fixed by mirroring each logo into data/media/partners/
  // (same pattern as every other image this app displays); this guards
  // against a future partner being added with a raw btcc.net hotlink again,
  // since partners.json has no scraper of its own to catch a stale URL.

  it('never hotlinks a partner logo directly to btcc.net', () => {
    const partners = require('../../data/partners.json');
    for (const p of partners) {
      expect(p.logo).not.toMatch(/^https:\/\/(www\.)?btcc\.net\//);
    }
  });

  it('mirrors every partner logo via raw.githubusercontent.com', () => {
    const partners = require('../../data/partners.json');
    for (const p of partners) {
      expect(p.logo).toMatch(/^https:\/\/raw\.githubusercontent\.com\/yacobwood\/BTCC\/main\/data\/media\/partners\//);
    }
  });
});
