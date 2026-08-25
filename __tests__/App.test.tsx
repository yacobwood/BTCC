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

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});

test('pressing "New to BTCC? Learn the basics" in onboarding dismisses it and navigates', async () => {
  let root;
  await act(async () => {
    root = ReactTestRenderer.create(<App />);
  });

  const link = root.root.findByProps({accessibilityLabel: 'New to BTCC? Learn the basics'});
  await act(async () => {
    link.props.onPress();
  });

  expect(AsyncStorage.setItem).toHaveBeenCalledWith('onboarding_shown', 'true');
  expect(navigateToNewToBtcc).toHaveBeenCalled();
});
