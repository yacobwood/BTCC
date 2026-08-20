import React from 'react';
import {fireEvent, waitFor} from '@testing-library/react-native';
import {Platform, Linking} from 'react-native';
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

  it('shows the LISTEN row', async () => {
    const {getByLabelText} = renderMore();
    await waitFor(() => expect(getByLabelText('Listen')).toBeTruthy());
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

  // ── Navigation ────────────────────────────────────────────────────────────────

  it('navigates to Listen screen when Listen is pressed', async () => {
    const {getByLabelText} = renderMore();
    await waitFor(() => getByLabelText('Listen'));
    fireEvent.press(getByLabelText('Listen'));
    expect(nav.navigate).toHaveBeenCalledWith('Listen');
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

  // ── Support buttons (Android only) ────────────────────────────────────────────

  it('shows Buy Me a Coffee button on Android', async () => {
    Platform.OS = 'android';
    const {getByLabelText} = renderMore();
    await waitFor(() => {
      expect(getByLabelText('Buy me a coffee')).toBeTruthy();
    });
    Platform.OS = 'ios';
  });

  it('opens buymeacoffee URL when Buy Me a Coffee is pressed', async () => {
    Platform.OS = 'android';
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const {getByLabelText} = renderMore();
    await waitFor(() => getByLabelText('Buy me a coffee'));
    fireEvent.press(getByLabelText('Buy me a coffee'));
    expect(openURL).toHaveBeenCalledWith('https://www.buymeacoffee.com/btcchub');
    Platform.OS = 'ios';
  });

  it('hides support buttons on iOS', async () => {
    Platform.OS = 'ios';
    const {queryByLabelText} = renderMore();
    await waitFor(() => expect(queryByLabelText('Buy me a coffee')).toBeNull());
  });

  it('shows the restyled card title and supporting copy', async () => {
    // Regression: this used to be a bare buymeacoffee.com badge image with no
    // in-app text at all - promoting it also means it should read like an
    // app-native CTA, not a stamped-in web badge.
    Platform.OS = 'android';
    const {getByText} = renderMore();
    await waitFor(() => {
      expect(getByText('Buy me a coffee')).toBeTruthy();
      expect(getByText('Enjoying the app? Consider supporting development.')).toBeTruthy();
    });
    Platform.OS = 'ios';
  });

  it('renders Buy Me a Coffee as the very first thing on the screen', async () => {
    // Regression: it used to render below Feedback & Bugs, at the very
    // bottom of the screen - it should now appear before every other
    // section, including "NEW HERE?" (the first section title otherwise).
    Platform.OS = 'android';
    const {getByLabelText, toJSON} = renderMore();
    await waitFor(() => getByLabelText('Buy me a coffee'));
    const rendered = JSON.stringify(toJSON());
    const coffeeIndex = rendered.indexOf('Buy me a coffee');
    const newHereIndex = rendered.indexOf('NEW HERE?');
    const feedbackIndex = rendered.indexOf('Feedback & Bugs');
    expect(coffeeIndex).toBeGreaterThan(-1);
    expect(coffeeIndex).toBeLessThan(newHereIndex);
    expect(coffeeIndex).toBeLessThan(feedbackIndex);
    Platform.OS = 'ios';
  });
});
