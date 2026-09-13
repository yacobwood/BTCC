/**
 * @format
 */

// jest.setup.js mocks './App' as a virtual stub (for navigationRef usage).
// This test imports the real App component, so we must unmock it first.
jest.unmock('../App');

// Stub out side-effect-heavy utils so this smoke test stays fast
jest.mock('../src/utils/backgroundPrefetch', () => ({runBackgroundPrefetch: jest.fn()}));
jest.mock('../src/utils/notifNavigation',    () => ({navigateFromData: jest.fn(), handleNotificationOpen: jest.fn(), navigateToNewToBtcc: jest.fn()}));
jest.mock('@react-native-firebase/database', () => {
  const ref = {
    orderByChild: jest.fn().mockReturnThis(),
    limitToLast: jest.fn().mockReturnThis(),
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn(() => Promise.resolve({val: () => ({})})),
    push: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve()),
    remove: jest.fn(() => Promise.resolve()),
  };
  const db = jest.fn(() => ({ref: jest.fn(() => ref)}));
  db.ServerValue = {TIMESTAMP: 'TIMESTAMP'};
  return db;
});

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import App from '../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {navigateToNewToBtcc} from '../src/utils/notifNavigation';
import {logEvent} from '@react-native-firebase/analytics';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});

test('mounting with onboarding not yet shown logs an onboarding screen view', async () => {
  await act(async () => {
    ReactTestRenderer.create(<App />);
  });

  expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'screen_view', expect.objectContaining({screen_name: 'onboarding'}));
});

test('pressing "New to BTCC? Learn the basics" in onboarding dismisses it and navigates, without marking onboarding as shown', async () => {
  let root;
  await act(async () => {
    root = ReactTestRenderer.create(<App />);
  });

  const link = root.root.findByProps({accessibilityLabel: 'New to BTCC? Learn the basics'});
  await act(async () => {
    link.props.onPress();
  });

  expect(navigateToNewToBtcc).toHaveBeenCalled();
  // Regression: this used to also set onboarding_shown, which meant a
  // curious new user who tapped this link was never asked about
  // notifications at all, on this or any later launch. Leaving the flag
  // unset means the prompt asks again next cold start instead.
  expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('onboarding_shown', 'true');
  // The dialog itself is still dismissed immediately (doesn't block navigation)
  expect(root.root.findAllByProps({accessibilityLabel: 'New to BTCC? Learn the basics'}).length).toBe(0);
  expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'onboarding_choice_made', {choice: 'learn_basics'});
});

test('pressing "Allow notifications" in onboarding logs the allow choice', async () => {
  let root;
  await act(async () => {
    root = ReactTestRenderer.create(<App />);
  });

  const allowBtn = root.root.findByProps({accessibilityLabel: 'Allow notifications'});
  await act(async () => {
    allowBtn.props.onPress();
  });

  expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'onboarding_choice_made', {choice: 'allow'});
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('onboarding_shown', 'true');
});

test('pressing "Skip for now" in onboarding logs the skip choice', async () => {
  let root;
  await act(async () => {
    root = ReactTestRenderer.create(<App />);
  });

  const skipBtn = root.root.findByProps({accessibilityLabel: 'Skip for now'});
  await act(async () => {
    skipBtn.props.onPress();
  });

  expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'onboarding_choice_made', {choice: 'skip'});
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('onboarding_shown', 'true');
});

// ─── Spoiler-free auto-clear ────────────────────────────────────────────────
// Regression coverage for a real end-to-end mount, not just SettingsProvider
// or SpoilerClearedDialog in isolation - previously untested at this level,
// which is exactly why the auto-clear used to live in its own separate
// App.tsx effect that could race SettingsProvider's load (see project
// memory: spoiler_mode_audit_2026_09_13). These are last in the file: they
// set a custom AsyncStorage.getItem implementation that (unlike the rest of
// this file) isn't reset afterwards, matching jest.setup.js's clearAllMocks
// (not resetAllMocks) between tests.

test('spoiler-free mode still active (not yet expired) auto-clears on open and shows "No Spoilers Disabled"', async () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  AsyncStorage.getItem.mockImplementation((key) => {
    if (key === 'onboarding_shown') return Promise.resolve('true');
    if (key === 'setting_spoiler_free') return Promise.resolve('true');
    if (key === 'setting_spoiler_free_expiry') return Promise.resolve(future);
    return Promise.resolve(null);
  });

  let root;
  await act(async () => {
    root = ReactTestRenderer.create(<App />);
  });

  // Text-based presence check, not accessibilityLabel prop-matching:
  // TouchableOpacity forwards accessibilityLabel down through several
  // internal Animated.View/View layers, so findAllByProps over-counts a
  // single logical button (react-test-renderer has no built-in "not
  // found" query) - text content doesn't have that problem.
  expect(JSON.stringify(root.toJSON())).toContain('No Spoilers Disabled');
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('setting_spoiler_free', 'false');

  const gotIt = root.root.findByProps({accessibilityLabel: 'Got it'});
  await act(async () => {
    gotIt.props.onPress();
  });
  expect(JSON.stringify(root.toJSON())).not.toContain('No Spoilers Disabled');
});

test('spoiler-free mode already past its own expiry auto-clears silently, without the dialog', async () => {
  const past = new Date(Date.now() - 86400000).toISOString();
  AsyncStorage.getItem.mockImplementation((key) => {
    if (key === 'onboarding_shown') return Promise.resolve('true');
    if (key === 'setting_spoiler_free') return Promise.resolve('true');
    if (key === 'setting_spoiler_free_expiry') return Promise.resolve(past);
    return Promise.resolve(null);
  });

  let root;
  await act(async () => {
    root = ReactTestRenderer.create(<App />);
  });

  expect(JSON.stringify(root.toJSON())).not.toContain('No Spoilers Disabled');
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('setting_spoiler_free', 'false');
});
