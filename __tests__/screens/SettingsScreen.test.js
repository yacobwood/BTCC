import React from 'react';
import {act, fireEvent, waitFor} from '@testing-library/react-native';
import {Switch, Alert} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SettingsScreen from '../../src/screens/SettingsScreen';
import {renderWithProviders, makeNav} from './testUtils';

jest.mock('../../src/utils/broadcaster', () => ({
  useBroadcaster: jest.fn(() => 'uk'),
}));

jest.mock('../../src/store/auth', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = require('../../src/store/auth').useAuth;

const mockSendMagicLink = jest.fn(() => Promise.resolve());
const mockSignOut = jest.fn(() => Promise.resolve());

beforeEach(() => {
  mockSendMagicLink.mockResolvedValue(undefined);
  mockSignOut.mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({
    user: null,
    isAnonymous: true,
    providerIds: [],
    sendMagicLink: mockSendMagicLink,
    signOut: mockSignOut,
  });
});

const nav = makeNav();

async function renderSettings(storageOverrides = {}) {
  AsyncStorage.getItem.mockImplementation((key) => {
    if (key in storageOverrides) return Promise.resolve(String(storageOverrides[key]));
    return Promise.resolve(null);
  });
  const utils = renderWithProviders(<SettingsScreen navigation={nav} />);
  // Flush all provider useEffect async initializations so they don't
  // overwrite state changes made during the test.
  await act(async () => {});
  return utils;
}

// fireEvent targets the native RCTSwitch; after providers flush their async
// init, only direct onValueChange calls reliably update JS context state.
function toggleSwitch(UNSAFE_getAllByType, label, value) {
  const sw = UNSAFE_getAllByType(Switch).find(s => s.props.accessibilityLabel === label);
  if (!sw) throw new Error(`Switch with label "${label}" not found`);
  sw.props.onValueChange(value);
}

describe('SettingsScreen', () => {
  describe('structure', () => {
    it('renders the SPOILER-FREE MODE section heading', async () => {
      const {getByText} = await renderSettings();
      expect(getByText('SPOILER-FREE MODE')).toBeTruthy();
    });

    it('renders the No Spoilers toggle', async () => {
      const {getByLabelText} = await renderSettings();
      expect(getByLabelText('No Spoilers')).toBeTruthy();
    });

    it('renders the NOTIFICATIONS section heading', async () => {
      const {getByText} = await renderSettings();
      expect(getByText('NOTIFICATIONS')).toBeTruthy();
    });

    it('renders the DISPLAY section', async () => {
      const {getByText} = await renderSettings();
      expect(getByText('DISPLAY')).toBeTruthy();
    });

    it('renders top-level notification rows', async () => {
      const {getByText} = await renderSettings();
      expect(getByText('News alerts')).toBeTruthy();
      expect(getByText('Race weekend preview')).toBeTruthy();
      expect(getByText('Standings update')).toBeTruthy();
    });

    it('renders the Monday Roundup toggle', async () => {
      const {getByLabelText} = await renderSettings();
      expect(getByLabelText('Monday Roundup')).toBeTruthy();
    });

    it('renders Pre-race alerts group', async () => {
      const {getByText} = await renderSettings();
      expect(getByText('Pre-race alerts')).toBeTruthy();
    });

    it('renders Results alerts group', async () => {
      const {getByText} = await renderSettings();
      expect(getByText('Results alerts')).toBeTruthy();
    });

    it('renders pre-race session children', async () => {
      const {getByLabelText} = await renderSettings();
      expect(getByLabelText('Pre-race Free Practice')).toBeTruthy();
      expect(getByLabelText('Pre-race Qualifying')).toBeTruthy();
      expect(getByLabelText('Pre-race Qualifying Race')).toBeTruthy();
    });

    it('renders Race sub-group with R1/R2/R3', async () => {
      const {getByLabelText} = await renderSettings();
      expect(getByLabelText('Pre-race Race 1')).toBeTruthy();
      expect(getByLabelText('Pre-race Race 2')).toBeTruthy();
      expect(getByLabelText('Pre-race Race 3')).toBeTruthy();
    });

    it('renders the km / miles unit toggles', async () => {
      const {getByText} = await renderSettings();
      expect(getByText('km')).toBeTruthy();
      expect(getByText('miles')).toBeTruthy();
    });
  });

  describe('Pre-race parent toggle', () => {
    it('all pre-race children are enabled by default', async () => {
      const {getByLabelText} = await renderSettings();
      expect(getByLabelText('Pre-race Free Practice')).toHaveProp('disabled', false);
      expect(getByLabelText('Pre-race Qualifying')).toHaveProp('disabled', false);
      expect(getByLabelText('Pre-race Qualifying Race')).toHaveProp('disabled', false);
      expect(getByLabelText('Pre-race Race 1')).toHaveProp('disabled', false);
    });

    it('disabling Pre-race alerts disables child switches', async () => {
      const {getByLabelText, UNSAFE_getAllByType} = await renderSettings();
      await act(async () => { toggleSwitch(UNSAFE_getAllByType, 'Pre-race alerts', false); });
      expect(getByLabelText('Pre-race Free Practice')).toHaveProp('disabled', true);
      expect(getByLabelText('Pre-race Qualifying')).toHaveProp('disabled', true);
      expect(getByLabelText('Pre-race Qualifying Race')).toHaveProp('disabled', true);
      expect(getByLabelText('Pre-race Race 1')).toHaveProp('disabled', true);
      expect(getByLabelText('Pre-race Race 2')).toHaveProp('disabled', true);
      expect(getByLabelText('Pre-race Race 3')).toHaveProp('disabled', true);
    });

    it('disabling Pre-race alerts sets child switch values to false', async () => {
      const {getByLabelText, UNSAFE_getAllByType} = await renderSettings();
      await act(async () => { toggleSwitch(UNSAFE_getAllByType, 'Pre-race alerts', false); });
      expect(getByLabelText('Pre-race Free Practice')).toHaveProp('value', false);
      expect(getByLabelText('Pre-race Race 1')).toHaveProp('value', false);
    });

    it('re-enabling Pre-race alerts re-enables children', async () => {
      const {getByLabelText, UNSAFE_getAllByType} = await renderSettings();
      await act(async () => { toggleSwitch(UNSAFE_getAllByType, 'Pre-race alerts', false); });
      await act(async () => { toggleSwitch(UNSAFE_getAllByType, 'Pre-race alerts', true); });
      expect(getByLabelText('Pre-race Free Practice')).toHaveProp('disabled', false);
      expect(getByLabelText('Pre-race Race 1')).toHaveProp('disabled', false);
    });
  });

  describe('Race sub-parent toggle (within Pre-race)', () => {
    it('disabling Race sub-parent disables R1/R2/R3 but not FP', async () => {
      const {getByLabelText, UNSAFE_getAllByType} = await renderSettings();
      await act(async () => { toggleSwitch(UNSAFE_getAllByType, 'Pre-race Race', false); });
      expect(getByLabelText('Pre-race Race 1')).toHaveProp('disabled', true);
      expect(getByLabelText('Pre-race Race 2')).toHaveProp('disabled', true);
      expect(getByLabelText('Pre-race Race 3')).toHaveProp('disabled', true);
      expect(getByLabelText('Pre-race Free Practice')).toHaveProp('disabled', false);
    });
  });

  describe('Results parent toggle', () => {
    it('disabling Results alerts disables its children', async () => {
      const {getByLabelText, UNSAFE_getAllByType} = await renderSettings();
      await act(async () => { toggleSwitch(UNSAFE_getAllByType, 'Results alerts', false); });
      expect(getByLabelText('Results Race 1')).toHaveProp('disabled', true);
      expect(getByLabelText('Results Race 2')).toHaveProp('disabled', true);
      expect(getByLabelText('Results Race 3')).toHaveProp('disabled', true);
    });
  });

  describe('individual toggles', () => {
    it('toggling News alerts off persists to AsyncStorage', async () => {
      const {UNSAFE_getAllByType} = await renderSettings();
      await act(async () => { toggleSwitch(UNSAFE_getAllByType, 'News alerts', false); });
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('setting_news_alerts', 'false');
    });

    it('toggling Monday Roundup off persists to AsyncStorage', async () => {
      const {UNSAFE_getAllByType} = await renderSettings();
      await act(async () => { toggleSwitch(UNSAFE_getAllByType, 'Monday Roundup', false); });
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('setting_digest_alerts', 'false');
    });

    it('toggling No Spoilers on persists to AsyncStorage', async () => {
      const {UNSAFE_getAllByType} = await renderSettings();
      await act(async () => { toggleSwitch(UNSAFE_getAllByType, 'No Spoilers', true); });
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('setting_spoiler_free', 'true');
    });

    it('toggling Pre-race Qualifying Race persists with a qrace key', async () => {
      const {UNSAFE_getAllByType} = await renderSettings();
      await act(async () => { toggleSwitch(UNSAFE_getAllByType, 'Pre-race Qualifying Race', false); });
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('qrace'), 'false',
      );
    });
  });

  describe('loaded from storage', () => {
    it('Pre-race parent starts off when stored as false', async () => {
      const {getByLabelText} = await renderSettings({'setting_pre_race': 'false'});
      expect(getByLabelText('Pre-race alerts')).toHaveProp('value', false);
      expect(getByLabelText('Pre-race Free Practice')).toHaveProp('disabled', true);
    });

    it('Race 2 starts off when stored as false', async () => {
      const {getByLabelText} = await renderSettings({'setting_pre_race_race2': 'false'});
      expect(getByLabelText('Pre-race Race 2')).toHaveProp('value', false);
    });
  });

  describe('ACCOUNT section - anonymous user', () => {
    it('renders the ACCOUNT section heading', async () => {
      const {getByText} = await renderSettings();
      expect(getByText('ACCOUNT')).toBeTruthy();
    });

    it('shows "Register or Log in" button when anonymous', async () => {
      const {getByText} = await renderSettings();
      expect(getByText('Register or Log in')).toBeTruthy();
    });

    it('does not show User ID when user is null', async () => {
      const {queryByLabelText} = await renderSettings();
      expect(queryByLabelText('Copy user ID')).toBeNull();
    });

    describe('auth modal', () => {
      async function openModal() {
        const utils = await renderSettings();
        await act(async () => {
          fireEvent.press(utils.getByText('Register or Log in'));
        });
        return utils;
      }

      it('opens auth modal when "Register or Log in" is pressed', async () => {
        const {getByPlaceholderText} = await openModal();
        expect(getByPlaceholderText('Email')).toBeTruthy();
      });

      it('shows only email input - no password field', async () => {
        const {getByPlaceholderText, queryByPlaceholderText} = await openModal();
        expect(getByPlaceholderText('Email')).toBeTruthy();
        expect(queryByPlaceholderText('Password')).toBeNull();
      });

      it('shows "Send magic link" button', async () => {
        const {getByLabelText} = await openModal();
        expect(getByLabelText('Send magic link')).toBeTruthy();
      });

      it('shows error when email is blank on submit', async () => {
        const utils = await renderSettings();
        await act(async () => { fireEvent.press(utils.getByText('Register or Log in')); });
        await act(async () => { fireEvent.press(utils.getByLabelText('Send magic link')); });
        expect(utils.getByText('Please enter your email address.')).toBeTruthy();
      });

      it('calls sendMagicLink with trimmed email', async () => {
        const utils = await renderSettings();
        await act(async () => { fireEvent.press(utils.getByText('Register or Log in')); });
        await act(async () => {
          fireEvent.changeText(utils.getByPlaceholderText('Email'), '  user@test.com  ');
        });
        await act(async () => { fireEvent.press(utils.getByLabelText('Send magic link')); });
        expect(mockSendMagicLink).toHaveBeenCalledWith('user@test.com');
      });

      it('shows "Check your inbox" confirmation after link is sent', async () => {
        const utils = await renderSettings();
        await act(async () => { fireEvent.press(utils.getByText('Register or Log in')); });
        await act(async () => {
          fireEvent.changeText(utils.getByPlaceholderText('Email'), 'user@test.com');
        });
        await act(async () => { fireEvent.press(utils.getByLabelText('Send magic link')); });
        expect(utils.getByText('Check your inbox')).toBeTruthy();
      });

      it('shows the email address in the sent confirmation', async () => {
        const utils = await renderSettings();
        await act(async () => { fireEvent.press(utils.getByText('Register or Log in')); });
        await act(async () => {
          fireEvent.changeText(utils.getByPlaceholderText('Email'), 'user@test.com');
        });
        await act(async () => { fireEvent.press(utils.getByLabelText('Send magic link')); });
        expect(utils.getByText(/user@test\.com/)).toBeTruthy();
      });

      it('shows friendly error on auth/invalid-email', async () => {
        mockSendMagicLink.mockRejectedValueOnce({code: 'auth/invalid-email'});
        const utils = await renderSettings();
        await act(async () => { fireEvent.press(utils.getByText('Register or Log in')); });
        await act(async () => {
          fireEvent.changeText(utils.getByPlaceholderText('Email'), 'notanemail');
        });
        await act(async () => { fireEvent.press(utils.getByLabelText('Send magic link')); });
        expect(utils.getByText("That doesn't look like a valid email address.")).toBeTruthy();
      });

      it('shows generic error on unknown failure', async () => {
        mockSendMagicLink.mockRejectedValueOnce({code: 'auth/internal-error'});
        const utils = await renderSettings();
        await act(async () => { fireEvent.press(utils.getByText('Register or Log in')); });
        await act(async () => {
          fireEvent.changeText(utils.getByPlaceholderText('Email'), 'user@test.com');
        });
        await act(async () => { fireEvent.press(utils.getByLabelText('Send magic link')); });
        expect(utils.getByText('Something went wrong. Please try again.')).toBeTruthy();
      });

      it('closes modal when close button is pressed', async () => {
        const {getByLabelText, queryByPlaceholderText} = await openModal();
        await act(async () => {
          fireEvent.press(getByLabelText('Close'));
        });
        expect(queryByPlaceholderText('Email')).toBeNull();
      });

      it('auto-closes modal when sign-in completes and isAnonymous becomes false', async () => {
        const utils = await renderSettings();
        await act(async () => {
          fireEvent.press(utils.getByText('Register or Log in'));
        });
        expect(utils.getByPlaceholderText('Email')).toBeTruthy();

        mockUseAuth.mockReturnValue({
          user: {uid: 'linked-uid', isAnonymous: false, providerData: [{providerId: 'emailLink'}]},
          isAnonymous: false,
          providerIds: ['emailLink'],
          sendMagicLink: mockSendMagicLink,
          signOut: mockSignOut,
        });
        await act(async () => {
          utils.rerender(<SettingsScreen navigation={nav} />);
        });

        expect(utils.queryByPlaceholderText('Email')).toBeNull();
      });
    });
  });

  describe('ACCOUNT section - signed-in user', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {uid: 'real-uid-abcdefghijklmnopqrstuvwx', isAnonymous: false, email: 'jake@test.com', providerData: [{providerId: 'emailLink'}]},
        isAnonymous: false,
        providerIds: ['emailLink'],
        sendMagicLink: mockSendMagicLink,
        signOut: mockSignOut,
      });
    });

    it('shows email instead of "Register or Log in" when signed in', async () => {
      const {getByText, queryByText} = await renderSettings();
      expect(getByText('jake@test.com')).toBeTruthy();
      expect(queryByText('Register or Log in')).toBeNull();
    });

    it('shows "Sign out" button when signed in', async () => {
      const {getByText} = await renderSettings();
      expect(getByText('Sign out')).toBeTruthy();
    });

    it('shows truncated User ID', async () => {
      const {getByText} = await renderSettings();
      expect(getByText('User ID: real-uid-abcdefg…')).toBeTruthy();
    });

    it('pressing Sign out shows an Alert confirmation', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const {getByText} = await renderSettings();
      await act(async () => {
        fireEvent.press(getByText('Sign out'));
      });
      expect(alertSpy).toHaveBeenCalledWith(
        'Sign out',
        expect.any(String),
        expect.any(Array),
      );
      alertSpy.mockRestore();
    });

    it('confirms sign out when destructive button pressed in Alert', async () => {
      jest.spyOn(Alert, 'alert').mockImplementation((title, msg, buttons) => {
        const destructive = buttons.find(b => b.style === 'destructive');
        destructive?.onPress();
      });
      const {getByText} = await renderSettings();
      await act(async () => {
        fireEvent.press(getByText('Sign out'));
      });
      expect(mockSignOut).toHaveBeenCalled();
      Alert.alert.mockRestore();
    });
  });
});
