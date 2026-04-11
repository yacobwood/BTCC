/**
 * @format
 */

// Stub out side-effect-heavy utils so this smoke test stays fast
jest.mock('../src/utils/backgroundPrefetch', () => ({runBackgroundPrefetch: jest.fn()}));
jest.mock('../src/utils/notifNavigation',    () => ({navigateFromData: jest.fn()}));

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
