import React from 'react';
import {act, fireEvent, waitFor} from '@testing-library/react-native';
import {Platform, Linking, Share, ScrollView} from 'react-native';
import MoreScreen from '../../src/screens/MoreScreen';
import {renderWithProviders, makeNav} from './testUtils';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {
    screen: jest.fn(),
    moreItemClicked: jest.fn(),
    contentShared: jest.fn(),
    donorGateShown: jest.fn(),
    donorGateNameSaveResult: jest.fn(),
    donorGateSkipped: jest.fn(),
  },
}));

jest.mock('../../src/utils/chatIdentity', () => ({
  hasChatDisplayName: jest.fn(),
  saveChatDisplayName: jest.fn(),
}));

const {hasChatDisplayName, saveChatDisplayName} = require('../../src/utils/chatIdentity');
const {Analytics} = require('../../src/utils/analytics');
const mockAuthModule = require('@react-native-firebase/auth').default;

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
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: already has a chat display name, so existing coffee-card tests
    // exercise the no-interruption path unchanged. Tests for the name gate
    // itself override this to false.
    hasChatDisplayName.mockResolvedValue(true);
    mockAuthModule().currentUser = {uid: 'test-uid-123', isAnonymous: true};
  });

  // ── Static rows always present ───────────────────────────────────────────────

  it('shows the LISTEN row', async () => {
    const {getByLabelText} = renderMore();
    await waitFor(() => expect(getByLabelText('Listen')).toBeTruthy());
  });

  it('shows the On The Limit row', async () => {
    const {getByLabelText} = renderMore();
    await waitFor(() => expect(getByLabelText('On The Limit')).toBeTruthy());
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

  it('shows the Share BTCC Hub row', async () => {
    const {getByLabelText} = renderMore();
    await waitFor(() => expect(getByLabelText('Share BTCC Hub')).toBeTruthy());
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

  it('navigates to OnTheLimit screen when On The Limit is pressed', async () => {
    const {getByLabelText} = renderMore();
    await waitFor(() => getByLabelText('On The Limit'));
    fireEvent.press(getByLabelText('On The Limit'));
    expect(nav.navigate).toHaveBeenCalledWith('OnTheLimit');
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

  it('opens the native share sheet with an app link tagged more_menu when Share BTCC Hub is pressed', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({action: 'sharedAction'});
    const {getByLabelText} = renderMore();
    await waitFor(() => getByLabelText('Share BTCC Hub'));
    fireEvent.press(getByLabelText('Share BTCC Hub'));
    await waitFor(() => expect(shareSpy).toHaveBeenCalledWith({
      message: expect.stringContaining('https://btcchub.vercel.app?src=more_menu'),
    }));
    shareSpy.mockRestore();
  });

  // ── No donations (Google Play Payments policy) ──────────────────────────────
  // Play rejected the app (2026-10-12) for a Buy Me a Coffee donation link:
  // donations to a non-tax-exempt developer must use Play billing or not exist.
  // The card, its donor-name prompt and the chat supporter badge were removed.

  it.each(['android', 'ios'])('has no donation link on %s', async (os) => {
    Platform.OS = os;
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const {queryByLabelText, queryByText, getByText} = renderMore();
    await waitFor(() => getByText('Feedback & Bugs'));
    expect(queryByLabelText('Buy me a coffee')).toBeNull();
    expect(queryByText(/coffee|donat|support development/i)).toBeNull();
    expect(openURL).not.toHaveBeenCalledWith(expect.stringContaining('buymeacoffee'));
    openURL.mockRestore();
    Platform.OS = 'ios';
  });

  // Regression guard (2026-08-30): scroll-to-top used to fire on every focus,
  // including a plain back-pop from Settings/InfoPage/etc - fixed to fire
  // only when route.params.scrollToTopToken changes, which AppNavigator.js's
  // useResetStackOnTabPress sets solely on an actual More tab bar press.
  describe('scroll to top on tab press', () => {
    it('does not scroll on initial mount', () => {
      const spy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
      renderMore();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('scrolls to top when the More tab bar icon is pressed', async () => {
      const spy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
      renderMore();
      await act(async () => { nav.__fireTabPress(); });
      expect(spy).toHaveBeenCalledWith({y: 0, animated: false});
      spy.mockRestore();
    });
  });
});
