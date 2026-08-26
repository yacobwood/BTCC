import React from 'react';
import {fireEvent, waitFor} from '@testing-library/react-native';
import {Platform, Linking, Share} from 'react-native';
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
    // Opening the link is now gated on an async hasChatDisplayName check (see
    // the "donor name gate" describe block below), so this resolves a tick later.
    await waitFor(() => expect(openURL).toHaveBeenCalledWith('https://www.buymeacoffee.com/btcchub'));
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

  // ── Donor name gate ────────────────────────────────────────────────────────────

  describe('donor name gate', () => {
    beforeEach(() => { Platform.OS = 'android'; });
    afterEach(() => { Platform.OS = 'ios'; });

    it('opens the coffee link directly, with no prompt, when a chat display name is already set', async () => {
      hasChatDisplayName.mockResolvedValue(true);
      const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      const {getByLabelText, queryByLabelText} = renderMore();
      await waitFor(() => getByLabelText('Buy me a coffee'));
      fireEvent.press(getByLabelText('Buy me a coffee'));
      await waitFor(() => expect(openURL).toHaveBeenCalledWith('https://www.buymeacoffee.com/btcchub'));
      expect(queryByLabelText('Chat display name')).toBeNull();
    });

    it('shows the name-gate prompt when no chat display name is set yet', async () => {
      hasChatDisplayName.mockResolvedValue(false);
      const {getByLabelText, getByText} = renderMore();
      await waitFor(() => getByLabelText('Buy me a coffee'));
      fireEvent.press(getByLabelText('Buy me a coffee'));
      await waitFor(() => expect(getByText('One quick thing')).toBeTruthy());
      expect(getByLabelText('Chat display name')).toBeTruthy();
      expect(Analytics.donorGateShown).toHaveBeenCalled();
    });

    it('shows a "sign in to make this permanent" link for an anonymous user', async () => {
      hasChatDisplayName.mockResolvedValue(false);
      mockAuthModule().currentUser = {uid: 'anon1', isAnonymous: true};
      const {getByLabelText} = renderMore();
      await waitFor(() => getByLabelText('Buy me a coffee'));
      fireEvent.press(getByLabelText('Buy me a coffee'));
      await waitFor(() => expect(getByLabelText('Sign in to make this permanent')).toBeTruthy());
    });

    it('does not show the sign-in link for an already signed-in user', async () => {
      hasChatDisplayName.mockResolvedValue(false);
      mockAuthModule().currentUser = {uid: 'uid1', isAnonymous: false};
      const {getByLabelText, getByText, queryByLabelText} = renderMore();
      await waitFor(() => getByLabelText('Buy me a coffee'));
      fireEvent.press(getByLabelText('Buy me a coffee'));
      await waitFor(() => getByText('One quick thing'));
      expect(queryByLabelText('Sign in to make this permanent')).toBeNull();
    });

    it('pressing the sign-in link navigates to Settings and closes the gate', async () => {
      hasChatDisplayName.mockResolvedValue(false);
      const {getByLabelText, queryByText} = renderMore();
      await waitFor(() => getByLabelText('Buy me a coffee'));
      fireEvent.press(getByLabelText('Buy me a coffee'));
      await waitFor(() => getByLabelText('Sign in to make this permanent'));
      fireEvent.press(getByLabelText('Sign in to make this permanent'));
      expect(nav.navigate).toHaveBeenCalledWith('Settings');
      expect(queryByText('One quick thing')).toBeNull();
    });

    it('Save & Continue saves the name via chatIdentity then opens the coffee link', async () => {
      hasChatDisplayName.mockResolvedValue(false);
      saveChatDisplayName.mockResolvedValue({status: 'ok', name: 'Speedy'});
      const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      const {getByLabelText, getByText, queryByText} = renderMore();
      await waitFor(() => getByLabelText('Buy me a coffee'));
      fireEvent.press(getByLabelText('Buy me a coffee'));
      await waitFor(() => getByText('One quick thing'));
      fireEvent.changeText(getByLabelText('Chat display name'), 'Speedy');
      fireEvent.press(getByLabelText('Save name and continue'));
      await waitFor(() => expect(saveChatDisplayName).toHaveBeenCalledWith(
        expect.objectContaining({name: 'Speedy'}),
      ));
      await waitFor(() => expect(openURL).toHaveBeenCalledWith('https://www.buymeacoffee.com/btcchub'));
      expect(queryByText('One quick thing')).toBeNull();
      expect(Analytics.donorGateNameSaveResult).toHaveBeenCalledWith('ok');
    });

    it('shows an error and keeps the gate open when the name cannot be saved', async () => {
      hasChatDisplayName.mockResolvedValue(false);
      saveChatDisplayName.mockResolvedValue({status: 'taken', message: 'That name is already taken'});
      const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      const {getByLabelText, getByText} = renderMore();
      await waitFor(() => getByLabelText('Buy me a coffee'));
      fireEvent.press(getByLabelText('Buy me a coffee'));
      await waitFor(() => getByText('One quick thing'));
      fireEvent.changeText(getByLabelText('Chat display name'), 'Gordon');
      fireEvent.press(getByLabelText('Save name and continue'));
      await waitFor(() => expect(getByText('That name is already taken')).toBeTruthy());
      expect(openURL).not.toHaveBeenCalled();
      expect(Analytics.donorGateNameSaveResult).toHaveBeenCalledWith('taken');
    });

    it('rejects an empty name instead of silently falling back to a generated "Fan #" name', async () => {
      hasChatDisplayName.mockResolvedValue(false);
      const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      const {getByLabelText, getByText} = renderMore();
      await waitFor(() => getByLabelText('Buy me a coffee'));
      fireEvent.press(getByLabelText('Buy me a coffee'));
      await waitFor(() => getByText('One quick thing'));
      // Leave the input blank - don't fireEvent.changeText at all
      fireEvent.press(getByLabelText('Save name and continue'));
      await waitFor(() => expect(getByText('Enter a display name, or tap Skip')).toBeTruthy());
      expect(saveChatDisplayName).not.toHaveBeenCalled();
      expect(openURL).not.toHaveBeenCalled();
      expect(Analytics.donorGateNameSaveResult).toHaveBeenCalledWith('empty');
    });

    it('rejects a whitespace-only name the same way', async () => {
      hasChatDisplayName.mockResolvedValue(false);
      const {getByLabelText, getByText} = renderMore();
      await waitFor(() => getByLabelText('Buy me a coffee'));
      fireEvent.press(getByLabelText('Buy me a coffee'));
      await waitFor(() => getByText('One quick thing'));
      fireEvent.changeText(getByLabelText('Chat display name'), '   ');
      fireEvent.press(getByLabelText('Save name and continue'));
      await waitFor(() => expect(getByText('Enter a display name, or tap Skip')).toBeTruthy());
      expect(saveChatDisplayName).not.toHaveBeenCalled();
    });

    it('Skip opens the coffee link directly without saving a name', async () => {
      hasChatDisplayName.mockResolvedValue(false);
      const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      const {getByLabelText, getByText, queryByText} = renderMore();
      await waitFor(() => getByLabelText('Buy me a coffee'));
      fireEvent.press(getByLabelText('Buy me a coffee'));
      await waitFor(() => getByText('One quick thing'));
      fireEvent.press(getByLabelText('Skip'));
      expect(saveChatDisplayName).not.toHaveBeenCalled();
      await waitFor(() => expect(openURL).toHaveBeenCalledWith('https://www.buymeacoffee.com/btcchub'));
      expect(queryByText('One quick thing')).toBeNull();
      expect(Analytics.donorGateSkipped).toHaveBeenCalled();
    });
  });
});
