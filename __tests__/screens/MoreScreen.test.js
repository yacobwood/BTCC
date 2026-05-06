import React from 'react';
import {fireEvent, waitFor} from '@testing-library/react-native';
import MoreScreen from '../../src/screens/MoreScreen';
import {renderWithProviders, makeNav} from './testUtils';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn(), moreItemClicked: jest.fn()},
}));

const nav = makeNav();

function renderMore(flagOverrides = {}) {
  // FeatureFlagsProvider reads from fetch — stub it so flags are defaults (false)
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: () => Promise.resolve({}),
  });
  return renderWithProviders(<MoreScreen navigation={nav} />);
}

describe('MoreScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Static rows always present ───────────────────────────────────────────────

  it('shows the ALL-TIME RECORDS row', async () => {
    const {getByLabelText} = renderMore();
    await waitFor(() => expect(getByLabelText('All-Time Records')).toBeTruthy());
  });

  it('shows the SETTINGS row', async () => {
    const {getByLabelText} = renderMore();
    await waitFor(() => expect(getByLabelText('Settings')).toBeTruthy());
  });

  it('shows the PARTNERS & SPONSORS row', async () => {
    const {getByLabelText} = renderMore();
    await waitFor(() => expect(getByLabelText('Partners & Sponsors')).toBeTruthy());
  });

  it('shows ROADMAP row', async () => {
    const {getByLabelText} = renderMore();
    await waitFor(() => expect(getByLabelText('Roadmap & Ideas')).toBeTruthy());
  });

  it('shows FEEDBACK row', async () => {
    const {getByLabelText} = renderMore();
    await waitFor(() => expect(getByLabelText('Feedback & Bugs')).toBeTruthy());
  });

  // ── Feature-flag-controlled rows ─────────────────────────────────────────────

  it('does NOT show Radio row when radio_tab flag is off (default)', async () => {
    const {queryByLabelText} = renderMore();
    // Give flags time to load (they won't — fetch fails, so flags stay default false)
    await waitFor(() => expect(queryByLabelText('Radio')).toBeNull());
  });

  it('does NOT show Podcasts row when podcasts_enabled flag is off (default)', async () => {
    const {queryByLabelText} = renderMore();
    await waitFor(() => expect(queryByLabelText('Podcasts & Interviews')).toBeNull());
  });

  // ── Navigation ────────────────────────────────────────────────────────────────

  it('navigates to Records screen when All-Time Records is pressed', async () => {
    const {getByLabelText} = renderMore();
    await waitFor(() => getByLabelText('All-Time Records'));
    fireEvent.press(getByLabelText('All-Time Records'));
    expect(nav.navigate).toHaveBeenCalledWith('Records');
  });

  it('navigates to Settings screen when Settings is pressed', async () => {
    const {getByLabelText} = renderMore();
    await waitFor(() => getByLabelText('Settings'));
    fireEvent.press(getByLabelText('Settings'));
    expect(nav.navigate).toHaveBeenCalledWith('Settings');
  });

  it('navigates to Roadmap screen when Roadmap & Ideas is pressed', async () => {
    const {getByLabelText} = renderMore();
    await waitFor(() => getByLabelText('Roadmap & Ideas'));
    fireEvent.press(getByLabelText('Roadmap & Ideas'));
    expect(nav.navigate).toHaveBeenCalledWith('Roadmap');
  });

  it('navigates to BugReport screen when Feedback & Bugs is pressed', async () => {
    const {getByLabelText} = renderMore();
    await waitFor(() => getByLabelText('Feedback & Bugs'));
    fireEvent.press(getByLabelText('Feedback & Bugs'));
    expect(nav.navigate).toHaveBeenCalledWith('BugReport');
  });

  it('navigates to Partners screen when Partners & Sponsors is pressed', async () => {
    const {getByLabelText} = renderMore();
    await waitFor(() => getByLabelText('Partners & Sponsors'));
    fireEvent.press(getByLabelText('Partners & Sponsors'));
    expect(nav.navigate).toHaveBeenCalledWith('Partners');
  });
});
