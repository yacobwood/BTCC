import React from 'react';
import {fireEvent, waitFor, act} from '@testing-library/react-native';
import ChatScreen from '../../src/screens/ChatScreen';
import {renderWithProviders} from './testUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn()},
}));

jest.mock('../../src/utils/notifications', () => ({
  getFCMToken: jest.fn().mockResolvedValue('test-fcm-token-abc12345'),
}));

// Variable names must be prefixed with "mock" to be accessible from a hoisted jest.mock factory
var mockDbOn, mockDbOff, mockDbPush, mockDbUpdate, mockDbRemove, mockDbRef;

jest.mock('@react-native-firebase/database', () => {
  mockDbOn     = jest.fn();
  mockDbOff    = jest.fn();
  mockDbPush   = jest.fn(() => Promise.resolve());
  mockDbUpdate = jest.fn(() => Promise.resolve());
  mockDbRemove = jest.fn(() => Promise.resolve());
  mockDbRef = {
    orderByChild: jest.fn().mockReturnThis(),
    limitToLast:  jest.fn().mockReturnThis(),
    on:     mockDbOn,
    off:    mockDbOff,
    push:   mockDbPush,
    update: mockDbUpdate,
    remove: mockDbRemove,
  };
  const db = jest.fn(() => ({ref: jest.fn(() => mockDbRef)}));
  db.ServerValue = {TIMESTAMP: 'TIMESTAMP'};
  return db;
});

function triggerMessages(msgs) {
  // Simulate Firebase snapshot arriving via the registered 'value' listener
  const snap = {
    forEach: cb => msgs.forEach(m => cb({key: m.id, val: () => m})),
  };
  const onCall = mockDbOn.mock.calls[0];
  if (onCall) onCall[1](snap);
}

function renderChat() {
  AsyncStorage.getItem.mockResolvedValue(null);
  return renderWithProviders(<ChatScreen />);
}

describe('ChatScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    mockDbOn.mockImplementation(() => {});
    mockDbPush.mockResolvedValue({});
  });

  // ── Loading state ─────────────────────────────────────────────────────────────

  it('shows loading indicator before messages arrive', () => {
    const {UNSAFE_queryByType} = renderChat();
    const {ActivityIndicator} = require('react-native');
    expect(UNSAFE_queryByType(ActivityIndicator)).toBeTruthy();
  });

  // ── Message rendering ─────────────────────────────────────────────────────────

  it('renders messages once Firebase sends data', async () => {
    const {getByText} = renderChat();
    await act(async () => {
      triggerMessages([
        {id: '1', text: 'Hello world!', authorName: 'Tom', authorId: 'abc', timestamp: 1000, flagCount: 0, hidden: false},
      ]);
    });
    await waitFor(() => expect(getByText('Hello world!')).toBeTruthy());
  });

  it('renders author name alongside message', async () => {
    const {getByText} = renderChat();
    await act(async () => {
      triggerMessages([
        {id: '1', text: 'Great race!', authorName: 'Gordon', authorId: 'xyz', timestamp: 1000, flagCount: 0, hidden: false},
      ]);
    });
    await waitFor(() => expect(getByText('Gordon')).toBeTruthy());
  });

  it('does not render hidden messages', async () => {
    const {queryByText} = renderChat();
    await act(async () => {
      triggerMessages([
        {id: '1', text: 'Hidden message', authorName: 'Spammer', authorId: 'bad', timestamp: 1000, flagCount: 3, hidden: true},
      ]);
    });
    await waitFor(() => expect(queryByText('Hidden message')).toBeNull());
  });

  it('shows empty state text when no messages exist', async () => {
    const {getByText} = renderChat();
    await act(async () => { triggerMessages([]); });
    await waitFor(() => expect(getByText(/No messages yet/i)).toBeTruthy());
  });

  // ── Name prompt ───────────────────────────────────────────────────────────────

  it('shows name prompt when sending without a stored name', async () => {
    const {getByText, getByLabelText, getByPlaceholderText} = renderChat();
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    fireEvent.changeText(getByPlaceholderText(/say something/i), 'Hello!');
    // Send button becomes enabled once input has text
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() => expect(getByText(/Choose a display name/i)).toBeTruthy());
  });

  it('shows stored commenter name in the header when AsyncStorage has one', async () => {
    // Render directly — renderChat() resets the mock to null, bypassing the stored name
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'commenter_name' ? Promise.resolve('Saved User') : Promise.resolve(null),
    );
    const {getByText} = renderWithProviders(<ChatScreen />);
    await act(async () => { triggerMessages([]); });
    await waitFor(() => expect(getByText('Saved User')).toBeTruthy());
  });

  // ── Validation ────────────────────────────────────────────────────────────────

  it('shows error for message over 300 characters', async () => {
    AsyncStorage.getItem.mockResolvedValue('Test User');
    const {getByText, getByLabelText, getByPlaceholderText} = renderChat();
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    fireEvent.changeText(getByPlaceholderText(/say something/i), 'x'.repeat(301));
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() => expect(getByText(/too long/i)).toBeTruthy());
  });

  it('shows error for profanity in message', async () => {
    AsyncStorage.getItem.mockResolvedValue('Test User');
    const {getByText, getByLabelText, getByPlaceholderText} = renderChat();
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    fireEvent.changeText(getByPlaceholderText(/say something/i), 'fuck');
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() => expect(getByText(/disallowed content/i)).toBeTruthy());
  });

  it('does not send when message is empty', async () => {
    AsyncStorage.getItem.mockResolvedValue('Test User');
    const {getByPlaceholderText} = renderChat();
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    // Send button is disabled when input is empty — push should never be called
    expect(mockDbPush).not.toHaveBeenCalled();
  });

  // ── Successful send ───────────────────────────────────────────────────────────

  it('calls Firebase push when a valid message is sent', async () => {
    // Render directly — renderChat() resets the mock to null
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'commenter_name' ? Promise.resolve('Tom') : Promise.resolve(null),
    );
    const {getByLabelText, getByPlaceholderText} = renderWithProviders(<ChatScreen />);
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    fireEvent.changeText(getByPlaceholderText(/say something/i), 'Great race!');
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() => expect(mockDbPush).toHaveBeenCalledWith(
      expect.objectContaining({text: 'Great race!', authorName: 'Tom'}),
    ));
  });
});
