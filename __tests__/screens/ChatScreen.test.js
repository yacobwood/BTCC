import React from 'react';
import {Alert} from 'react-native';
import {fireEvent, waitFor, act} from '@testing-library/react-native';
import ChatScreen from '../../src/screens/ChatScreen';
import {renderWithProviders} from './testUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn()},
}));

jest.mock('../../src/api/client', () => ({
  fetchBlacklist: jest.fn().mockResolvedValue(['fuck', 'shit', 'damn']),
}));

jest.mock('../../src/utils/notifications', () => ({
  getFCMToken: jest.fn().mockResolvedValue('test-fcm-token-abc12345'),
}));

jest.mock('../../src/utils/timeAgo', () => ({
  timeAgo: jest.fn(() => 'just now'),
}));

// Variable names must be prefixed with "mock" to be accessible from a hoisted jest.mock factory
var mockDbOn, mockDbOff, mockDbPush, mockDbUpdate, mockDbRemove, mockDbTransaction, mockDbRef;
var mockBanOn, mockBanOff, mockBanRef;

jest.mock('@react-native-firebase/database', () => {
  mockDbOn          = jest.fn();
  mockDbOff         = jest.fn();
  mockDbPush        = jest.fn(() => Promise.resolve());
  mockDbUpdate      = jest.fn(() => Promise.resolve());
  mockDbRemove      = jest.fn(() => Promise.resolve());
  mockDbTransaction = jest.fn(cb => {
    const currentMsg = {text: 'Great race!', authorId: 'other', authorName: 'Other', timestamp: 1000, flagCount: 0, hidden: false};
    cb(currentMsg);
    return Promise.resolve({committed: true});
  });
  mockDbRef = {
    orderByChild:  jest.fn().mockReturnThis(),
    limitToLast:   jest.fn().mockReturnThis(),
    on:            mockDbOn,
    off:           mockDbOff,
    push:          mockDbPush,
    update:        mockDbUpdate,
    remove:        mockDbRemove,
    transaction:   mockDbTransaction,
  };
  mockBanOn  = jest.fn();
  mockBanOff = jest.fn();
  mockBanRef = {on: mockBanOn, off: mockBanOff};
  const db = jest.fn(() => ({
    ref: jest.fn(path => {
      if (path && path.startsWith('/chat/bans/')) return mockBanRef;
      return mockDbRef;
    }),
  }));
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

function triggerBan(banData) {
  const snap = {val: () => banData};
  const onCall = mockBanOn.mock.calls[0];
  if (onCall) onCall[1](snap);
}

function renderChat() {
  AsyncStorage.getItem.mockResolvedValue(null);
  return renderWithProviders(<ChatScreen />);
}

describe('ChatScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockImplementation(() => Promise.resolve(null));
    const {getFCMToken} = require('../../src/utils/notifications');
    getFCMToken.mockResolvedValue('test-fcm-token-abc12345');
    mockDbOn.mockImplementation(() => {});
    mockBanOn.mockImplementation(() => {});
    mockBanOff.mockImplementation(() => {});
    mockDbPush.mockResolvedValue({});
    mockDbRemove.mockResolvedValue({});
    mockDbTransaction.mockImplementation(cb => {
      const currentMsg = {text: 'Great race!', authorId: 'other', authorName: 'Other', timestamp: 1000, flagCount: 0, hidden: false};
      cb(currentMsg);
      return Promise.resolve({committed: true});
    });
  });

  // ── Loading state ─────────────────────────────────────────────────────────────

  it('shows loading indicator before messages arrive', () => {
    const {UNSAFE_queryByType} = renderChat();
    const {ActivityIndicator} = require('react-native');
    expect(UNSAFE_queryByType(ActivityIndicator)).toBeTruthy();
  });

  it('hides loading indicator once messages arrive', async () => {
    const {UNSAFE_queryByType} = renderChat();
    await act(async () => { triggerMessages([]); });
    const {ActivityIndicator} = require('react-native');
    await waitFor(() => expect(UNSAFE_queryByType(ActivityIndicator)).toBeNull());
  });

  // ── Analytics and side-effects on mount ───────────────────────────────────────

  it('calls Analytics.screen("chat") on mount', async () => {
    const {Analytics} = require('../../src/utils/analytics');
    renderChat();
    await waitFor(() => expect(Analytics.screen).toHaveBeenCalledWith('chat'));
  });

  it('calls fetchBlacklist on mount', async () => {
    const {fetchBlacklist} = require('../../src/api/client');
    renderChat();
    await waitFor(() => expect(fetchBlacklist).toHaveBeenCalled());
  });

  it('loads commenter_name from AsyncStorage on mount', async () => {
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'commenter_name' ? Promise.resolve('Saved User') : Promise.resolve(null),
    );
    const {getByText} = renderWithProviders(<ChatScreen />);
    await act(async () => { triggerMessages([]); });
    await waitFor(() => expect(getByText('Saved User')).toBeTruthy());
  });

  it('derives authorId from first 8 chars of FCM token', async () => {
    const {getFCMToken} = require('../../src/utils/notifications');
    getFCMToken.mockResolvedValue('test-fcm-token-abc12345');
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'commenter_name' ? Promise.resolve('Tom') : Promise.resolve(null),
    );
    const {getByPlaceholderText, getByLabelText} = renderWithProviders(<ChatScreen />);
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    fireEvent.changeText(getByPlaceholderText(/say something/i), 'Hello!');
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() =>
      expect(mockDbPush).toHaveBeenCalledWith(
        expect.objectContaining({authorId: 'test-fcm'}),
      ),
    );
  });

  it('falls back to anon_xxxx authorId when getFCMToken throws', async () => {
    const {getFCMToken} = require('../../src/utils/notifications');
    getFCMToken.mockRejectedValue(new Error('no token'));
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'commenter_name' ? Promise.resolve('Tom') : Promise.resolve(null),
    );
    const {getByPlaceholderText, getByLabelText} = renderWithProviders(<ChatScreen />);
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    fireEvent.changeText(getByPlaceholderText(/say something/i), 'Hello!');
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() =>
      expect(mockDbPush).toHaveBeenCalledWith(
        expect.objectContaining({authorId: expect.stringMatching(/^anon_/)}),
      ),
    );
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
    await waitFor(() => expect(getByText(/Gordon/)).toBeTruthy());
  });

  it('renders the author ID suffix as last 4 chars', async () => {
    const {getByText} = renderChat();
    await act(async () => {
      triggerMessages([
        {id: '1', text: 'Hi!', authorName: 'Alice', authorId: 'abcd1234', timestamp: 1000, flagCount: 0, hidden: false},
      ]);
    });
    await waitFor(() => expect(getByText(' #1234')).toBeTruthy());
  });

  it('renders a relative timestamp for each message', async () => {
    const {getAllByText} = renderChat();
    await act(async () => {
      triggerMessages([
        {id: '1', text: 'Hi!', authorName: 'Alice', authorId: 'abcd1234', timestamp: 1000, flagCount: 0, hidden: false},
      ]);
    });
    await waitFor(() => expect(getAllByText('just now').length).toBeGreaterThan(0));
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

  it('renders multiple messages', async () => {
    const {getByText} = renderChat();
    await act(async () => {
      triggerMessages([
        {id: '1', text: 'First message', authorName: 'Alice', authorId: 'aaaa', timestamp: 1000, flagCount: 0, hidden: false},
        {id: '2', text: 'Second message', authorName: 'Bob', authorId: 'bbbb', timestamp: 2000, flagCount: 0, hidden: false},
      ]);
    });
    await waitFor(() => {
      expect(getByText('First message')).toBeTruthy();
      expect(getByText('Second message')).toBeTruthy();
    });
  });

  it('shows empty state text when no messages exist', async () => {
    const {getByText} = renderChat();
    await act(async () => { triggerMessages([]); });
    await waitFor(() => expect(getByText(/No messages yet/i)).toBeTruthy());
  });

  it('shows delete button (not flag) for own messages', async () => {
    // FCM token gives authorId 'test-fcm'
    const {queryByLabelText, getByLabelText} = renderChat();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); }); // flush init()
    await act(async () => {
      triggerMessages([
        {id: '1', text: 'My message', authorName: 'Me', authorId: 'test-fcm', timestamp: 1000, flagCount: 0, hidden: false},
      ]);
    });
    await waitFor(() => {
      expect(queryByLabelText('Flag message')).toBeNull();
      expect(getByLabelText('Delete message')).toBeTruthy();
    });
  });

  it('shows flag button (not delete) for other messages', async () => {
    const {queryByLabelText, getAllByLabelText} = renderChat();
    await act(async () => {
      triggerMessages([
        {id: '1', text: 'Other person', authorName: 'Other', authorId: 'other123', timestamp: 1000, flagCount: 0, hidden: false},
      ]);
    });
    await waitFor(() => expect(getAllByLabelText('Flag message').length).toBeGreaterThan(0));
    expect(queryByLabelText('Delete message')).toBeNull();
  });

  // ── Firebase lifecycle ────────────────────────────────────────────────────────

  it('registers Firebase listener on mount', () => {
    renderChat();
    expect(mockDbOn).toHaveBeenCalled();
  });

  it('calls ref.off when component unmounts', async () => {
    const {unmount} = renderChat();
    await act(async () => { triggerMessages([]); });
    unmount();
    expect(mockDbOff).toHaveBeenCalled();
  });

  // ── Sending ───────────────────────────────────────────────────────────────────

  it('calls Firebase push when a valid message is sent', async () => {
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

  it('pushes correct payload shape (flagCount:0, hidden:false, timestamp)', async () => {
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'commenter_name' ? Promise.resolve('Tom') : Promise.resolve(null),
    );
    const {getByLabelText, getByPlaceholderText} = renderWithProviders(<ChatScreen />);
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    fireEvent.changeText(getByPlaceholderText(/say something/i), 'Hello!');
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() =>
      expect(mockDbPush).toHaveBeenCalledWith(
        expect.objectContaining({
          flagCount: 0,
          hidden: false,
          timestamp: 'TIMESTAMP',
        }),
      ),
    );
  });

  it('clears the input after a successful send', async () => {
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'commenter_name' ? Promise.resolve('Tom') : Promise.resolve(null),
    );
    const {getByLabelText, getByPlaceholderText} = renderWithProviders(<ChatScreen />);
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    const input = getByPlaceholderText(/say something/i);
    fireEvent.changeText(input, 'Hello!');
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() => expect(input.props.value).toBe(''));
  });

  it('does nothing when send is pressed with empty input', async () => {
    AsyncStorage.getItem.mockResolvedValue('Test User');
    const {getByPlaceholderText} = renderChat();
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    // Input is empty - push should never be called
    expect(mockDbPush).not.toHaveBeenCalled();
  });

  it('does nothing when send is pressed with whitespace-only input', async () => {
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'commenter_name' ? Promise.resolve('Tom') : Promise.resolve(null),
    );
    const {getByPlaceholderText, getByLabelText} = renderWithProviders(<ChatScreen />);
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    fireEvent.changeText(getByPlaceholderText(/say something/i), '   ');
    // send button is disabled for whitespace-only
    expect(mockDbPush).not.toHaveBeenCalled();
  });

  it('accepts a message of exactly 300 characters', async () => {
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'commenter_name' ? Promise.resolve('Tom') : Promise.resolve(null),
    );
    const {getByLabelText, getByPlaceholderText, queryByText} = renderWithProviders(<ChatScreen />);
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    fireEvent.changeText(getByPlaceholderText(/say something/i), 'x'.repeat(300));
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() => expect(mockDbPush).toHaveBeenCalled());
    expect(queryByText(/too long/i)).toBeNull();
  });

  it('shows error for message over 300 characters', async () => {
    AsyncStorage.getItem.mockResolvedValue('Test User');
    const {getByText, getByLabelText, getByPlaceholderText} = renderChat();
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    fireEvent.changeText(getByPlaceholderText(/say something/i), 'x'.repeat(301));
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() => expect(getByText(/too long/i)).toBeTruthy());
  });

  it('does not call push when message is too long', async () => {
    AsyncStorage.getItem.mockResolvedValue('Test User');
    const {getByLabelText, getByPlaceholderText} = renderChat();
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    fireEvent.changeText(getByPlaceholderText(/say something/i), 'x'.repeat(301));
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() => {});
    expect(mockDbPush).not.toHaveBeenCalled();
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

  it('does not call push when message contains blacklisted word', async () => {
    AsyncStorage.getItem.mockResolvedValue('Test User');
    const {getByLabelText, getByPlaceholderText} = renderChat();
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    fireEvent.changeText(getByPlaceholderText(/say something/i), 'shit');
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() => {});
    expect(mockDbPush).not.toHaveBeenCalled();
  });

  it('clears error when user starts typing after an error', async () => {
    AsyncStorage.getItem.mockResolvedValue('Test User');
    const {getByLabelText, getByPlaceholderText, queryByText} = renderChat();
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    fireEvent.changeText(getByPlaceholderText(/say something/i), 'x'.repeat(301));
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() => queryByText(/too long/i));
    // Now type to clear the error
    fireEvent.changeText(getByPlaceholderText(/say something/i), 'a');
    await waitFor(() => expect(queryByText(/too long/i)).toBeNull());
  });

  it('shows "Failed to send" error and restores input when push fails', async () => {
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'commenter_name' ? Promise.resolve('Tom') : Promise.resolve(null),
    );
    mockDbPush.mockRejectedValueOnce(new Error('network error'));
    const {getByLabelText, getByPlaceholderText, getByText} = renderWithProviders(<ChatScreen />);
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    const input = getByPlaceholderText(/say something/i);
    fireEvent.changeText(input, 'Hello!');
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() => expect(getByText(/Failed to send/i)).toBeTruthy());
    expect(input.props.value).toBe('Hello!');
  });

  // ── Name prompt (first send) ──────────────────────────────────────────────────

  it('shows name prompt when no stored name and send pressed', async () => {
    const {getByText, getByLabelText, getByPlaceholderText} = renderChat();
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    fireEvent.changeText(getByPlaceholderText(/say something/i), 'Hello!');
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() => expect(getByText(/Choose a display name/i)).toBeTruthy());
  });

  it('setting name saves to AsyncStorage', async () => {
    const {getByLabelText, getByPlaceholderText, getByText} = renderChat();
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    fireEvent.changeText(getByPlaceholderText(/say something/i), 'Hello!');
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() => getByText(/Choose a display name/i));
    const nameInput = getByPlaceholderText(/Fan #/i);
    fireEvent.changeText(nameInput, 'Speedster');
    fireEvent.press(getByLabelText('Set name'));
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('commenter_name', 'Speedster'),
    );
  });

  it('setting name dismisses the name prompt', async () => {
    const {getByLabelText, getByPlaceholderText, getByText, queryByText} = renderChat();
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    fireEvent.changeText(getByPlaceholderText(/say something/i), 'Hello!');
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() => getByText(/Choose a display name/i));
    const nameInput = getByPlaceholderText(/Fan #/i);
    fireEvent.changeText(nameInput, 'Speedster');
    await act(async () => { fireEvent.press(getByLabelText('Set name')); });
    expect(queryByText(/Choose a display name/i)).toBeNull();
  });

  it('setting name then sends the pending message via push', async () => {
    const {getByLabelText, getByPlaceholderText, getByText} = renderChat();
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    fireEvent.changeText(getByPlaceholderText(/say something/i), 'Pending message!');
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() => getByText(/Choose a display name/i));
    fireEvent.changeText(getByPlaceholderText(/Fan #/i), 'Speedster');
    fireEvent.press(getByLabelText('Set name'));
    await waitFor(() =>
      expect(mockDbPush).toHaveBeenCalledWith(
        expect.objectContaining({text: 'Pending message!', authorName: 'Speedster'}),
      ),
    );
  });

  it('skipping name generates auto-name (Fan #xxxx) and sends pending message', async () => {
    const {getByLabelText, getByPlaceholderText, getByText} = renderChat();
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    fireEvent.changeText(getByPlaceholderText(/say something/i), 'Auto name test!');
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() => getByText(/Choose a display name/i));
    fireEvent.press(getByText('Skip'));
    await waitFor(() =>
      expect(mockDbPush).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Auto name test!',
          authorName: expect.stringMatching(/^Fan #/),
        }),
      ),
    );
  });

  it('skipping name saves the auto-name to AsyncStorage', async () => {
    const {getByLabelText, getByPlaceholderText, getByText} = renderChat();
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByPlaceholderText(/say something/i));
    fireEvent.changeText(getByPlaceholderText(/say something/i), 'Hello!');
    fireEvent.press(getByLabelText('Send message'));
    await waitFor(() => getByText(/Choose a display name/i));
    fireEvent.press(getByText('Skip'));
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'commenter_name',
        expect.stringMatching(/^Fan #/),
      ),
    );
  });

  // ── Name editing (header) ─────────────────────────────────────────────────────

  it('shows stored commenter name in the header when AsyncStorage has one', async () => {
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'commenter_name' ? Promise.resolve('Saved User') : Promise.resolve(null),
    );
    const {getByText} = renderWithProviders(<ChatScreen />);
    await act(async () => { triggerMessages([]); });
    await waitFor(() => expect(getByText('Saved User')).toBeTruthy());
  });

  it('pressing the edit icon opens inline name edit row', async () => {
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'commenter_name' ? Promise.resolve('Saved User') : Promise.resolve(null),
    );
    const {getByText, getByPlaceholderText} = renderWithProviders(<ChatScreen />);
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByText('Saved User'));
    fireEvent.press(getByText('Saved User'));
    await waitFor(() => expect(getByPlaceholderText('Your display name')).toBeTruthy());
  });

  it('pressing Save in edit row calls AsyncStorage.setItem with new name', async () => {
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'commenter_name' ? Promise.resolve('Old Name') : Promise.resolve(null),
    );
    const {getByText, getByPlaceholderText} = renderWithProviders(<ChatScreen />);
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByText('Old Name'));
    fireEvent.press(getByText('Old Name'));
    await waitFor(() => getByPlaceholderText('Your display name'));
    fireEvent.changeText(getByPlaceholderText('Your display name'), 'New Name');
    fireEvent.press(getByText('Save'));
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('commenter_name', 'New Name'),
    );
  });

  it('pressing Save dismisses the inline edit row', async () => {
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'commenter_name' ? Promise.resolve('Old Name') : Promise.resolve(null),
    );
    const {getByText, getByPlaceholderText, queryByPlaceholderText} = renderWithProviders(<ChatScreen />);
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByText('Old Name'));
    fireEvent.press(getByText('Old Name'));
    await waitFor(() => getByPlaceholderText('Your display name'));
    fireEvent.changeText(getByPlaceholderText('Your display name'), 'New Name');
    await act(async () => { fireEvent.press(getByText('Save')); });
    expect(queryByPlaceholderText('Your display name')).toBeNull();
  });

  it('empty name on Save defaults to Fan #xxxx', async () => {
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'commenter_name' ? Promise.resolve('Old Name') : Promise.resolve(null),
    );
    const {getByText, getByPlaceholderText} = renderWithProviders(<ChatScreen />);
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByText('Old Name'));
    fireEvent.press(getByText('Old Name'));
    await waitFor(() => getByPlaceholderText('Your display name'));
    // Clear the name input and save empty
    fireEvent.changeText(getByPlaceholderText('Your display name'), '');
    fireEvent.press(getByText('Save'));
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'commenter_name',
        expect.stringMatching(/^Fan #/),
      ),
    );
  });

  // ── Flagging ──────────────────────────────────────────────────────────────────

  it('calls transaction when flag button is pressed', async () => {
    const {getAllByLabelText} = renderWithProviders(<ChatScreen />);
    await act(async () => {
      triggerMessages([
        {id: 'msg1', text: 'Great race!', authorName: 'Other', authorId: 'other', timestamp: 1000, flagCount: 0, hidden: false},
      ]);
    });
    await waitFor(() => getAllByLabelText('Flag message'));
    fireEvent.press(getAllByLabelText('Flag message')[0]);
    await waitFor(() => expect(mockDbTransaction).toHaveBeenCalled());
  });

  it('transaction callback increments flagCount', async () => {
    const {getAllByLabelText} = renderWithProviders(<ChatScreen />);
    await act(async () => {
      triggerMessages([
        {id: 'msg1', text: 'Boo!', authorName: 'Other', authorId: 'other', timestamp: 1000, flagCount: 1, hidden: false},
      ]);
    });
    mockDbTransaction.mockImplementationOnce(cb => {
      const msg = {text: 'Boo!', authorId: 'other', authorName: 'Other', timestamp: 1000, flagCount: 1, hidden: false};
      const result = cb(msg);
      expect(result.flagCount).toBe(2);
      expect(result.hidden).toBe(false);
      return Promise.resolve({committed: true});
    });
    await waitFor(() => getAllByLabelText('Flag message'));
    fireEvent.press(getAllByLabelText('Flag message')[0]);
    await waitFor(() => expect(mockDbTransaction).toHaveBeenCalled());
  });

  it('transaction callback increments flagCount to 3 (hidden is enforced by database rules, not client)', async () => {
    const {getAllByLabelText} = renderWithProviders(<ChatScreen />);
    await act(async () => {
      triggerMessages([
        {id: 'msg1', text: 'Spam!', authorName: 'Other', authorId: 'other', timestamp: 1000, flagCount: 2, hidden: false},
      ]);
    });
    mockDbTransaction.mockImplementationOnce(cb => {
      const msg = {text: 'Spam!', authorId: 'other', authorName: 'Other', timestamp: 1000, flagCount: 2, hidden: false};
      const result = cb(msg);
      // Client only increments flagCount - hidden enforcement is a server-side database rule
      expect(result.flagCount).toBe(3);
      expect(result.hidden).toBe(false);
      return Promise.resolve({committed: true});
    });
    await waitFor(() => getAllByLabelText('Flag message'));
    fireEvent.press(getAllByLabelText('Flag message')[0]);
    await waitFor(() => expect(mockDbTransaction).toHaveBeenCalled());
  });

  it('transaction callback aborts if message is null (already deleted)', async () => {
    const {getAllByLabelText} = renderWithProviders(<ChatScreen />);
    await act(async () => {
      triggerMessages([
        {id: 'msg1', text: 'Gone!', authorName: 'Other', authorId: 'other', timestamp: 1000, flagCount: 0, hidden: false},
      ]);
    });
    mockDbTransaction.mockImplementationOnce(cb => {
      const result = cb(null);
      expect(result).toBeNull();
      return Promise.resolve({committed: false});
    });
    await waitFor(() => getAllByLabelText('Flag message'));
    fireEvent.press(getAllByLabelText('Flag message')[0]);
    await waitFor(() => expect(mockDbTransaction).toHaveBeenCalled());
  });

  it('flagging same message twice does not call transaction a second time', async () => {
    const {getAllByLabelText} = renderWithProviders(<ChatScreen />);
    await act(async () => {
      triggerMessages([
        {id: 'msg1', text: 'Bad!', authorName: 'Other', authorId: 'other', timestamp: 1000, flagCount: 0, hidden: false},
      ]);
    });
    await waitFor(() => getAllByLabelText('Flag message'));
    fireEvent.press(getAllByLabelText('Flag message')[0]);
    await waitFor(() => expect(mockDbTransaction).toHaveBeenCalledTimes(1));
    // Press a second time - should be idempotent
    fireEvent.press(getAllByLabelText('Flag message')[0]);
    await waitFor(() => expect(mockDbTransaction).toHaveBeenCalledTimes(1));
  });

  it('flag also pushes to /chat/reports', async () => {
    const database = require('@react-native-firebase/database');
    const {getAllByLabelText} = renderWithProviders(<ChatScreen />);
    await act(async () => {
      triggerMessages([
        {id: 'msg1', text: 'Report me!', authorName: 'Other', authorId: 'other', timestamp: 1000, flagCount: 0, hidden: false},
      ]);
    });
    await waitFor(() => getAllByLabelText('Flag message'));
    fireEvent.press(getAllByLabelText('Flag message')[0]);
    await waitFor(() =>
      expect(mockDbPush).toHaveBeenCalledWith(
        expect.objectContaining({flaggedMessage: expect.any(Object)}),
      ),
    );
  });

  // ── Deleting ──────────────────────────────────────────────────────────────────

  // Helper: render with an own message already shown
  async function renderWithOwnMessage() {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const result = renderWithProviders(<ChatScreen />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); }); // flush init()
    await act(async () => {
      triggerMessages([
        {id: 'own1', text: 'My message', authorName: 'Me', authorId: 'test-fcm', timestamp: 1000, flagCount: 0, hidden: false},
      ]);
    });
    await waitFor(() => {
      result.getByText('My message');
      result.getByLabelText('Delete message');
    });
    return {alertSpy, ...result};
  }

  it('pressing delete on own message shows Alert', async () => {
    const {alertSpy, getByLabelText} = await renderWithOwnMessage();
    fireEvent.press(getByLabelText('Delete message'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete message',
      expect.any(String),
      expect.any(Array),
    );
    alertSpy.mockRestore();
  });

  it('confirming delete calls ref.remove()', async () => {
    let deleteOnPress;
    jest.spyOn(Alert, 'alert').mockImplementation((title, msg, buttons) => {
      const btn = buttons.find(b => b.style === 'destructive');
      deleteOnPress = btn?.onPress;
    });
    const result = renderWithProviders(<ChatScreen />);
    await act(async () => {
      triggerMessages([
        {id: 'own1', text: 'My message', authorName: 'Me', authorId: 'test-fcm', timestamp: 1000, flagCount: 0, hidden: false},
      ]);
    });
    await waitFor(() => {
      result.getByText('My message');
      result.getByLabelText('Delete message');
    });
    fireEvent.press(result.getByLabelText('Delete message'));
    if (deleteOnPress) {
      await act(async () => { await deleteOnPress(); });
    }
    expect(mockDbRemove).toHaveBeenCalled();
    Alert.alert.mockRestore();
  });

  it('cancelling delete does NOT call ref.remove()', async () => {
    let cancelOnPress;
    jest.spyOn(Alert, 'alert').mockImplementation((title, msg, buttons) => {
      const btn = buttons.find(b => b.style === 'cancel');
      cancelOnPress = btn?.onPress;
    });
    const result = renderWithProviders(<ChatScreen />);
    await act(async () => {
      triggerMessages([
        {id: 'own1', text: 'My message', authorName: 'Me', authorId: 'test-fcm', timestamp: 1000, flagCount: 0, hidden: false},
      ]);
    });
    await waitFor(() => {
      result.getByText('My message');
      result.getByLabelText('Delete message');
    });
    fireEvent.press(result.getByLabelText('Delete message'));
    if (cancelOnPress) cancelOnPress();
    expect(mockDbRemove).not.toHaveBeenCalled();
    Alert.alert.mockRestore();
  });

  // ── Close button ──────────────────────────────────────────────────────────────

  it('pressing close button calls onClose prop', async () => {
    const onClose = jest.fn();
    const {getByLabelText} = renderWithProviders(<ChatScreen onClose={onClose} />);
    await act(async () => { triggerMessages([]); });
    await waitFor(() => getByLabelText('Close chat'));
    fireEvent.press(getByLabelText('Close chat'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render close button when onClose prop is not provided', async () => {
    const {queryByLabelText} = renderChat();
    await act(async () => { triggerMessages([]); });
    await waitFor(() => {});
    expect(queryByLabelText('Close chat')).toBeNull();
  });

  // ── Ban system ────────────────────────────────────────────────────────────────

  it('renders ban notice system message with red italic style (not a regular row)', async () => {
    const {getByText, queryByLabelText} = renderChat();
    await act(async () => {
      triggerMessages([
        {id: 'sys1', text: 'Test Fan has been banned for 24h.', authorId: 'system', authorName: 'BTCC Hub Admin', timestamp: 1000, flagCount: 0, hidden: false, type: 'ban_notice'},
      ]);
    });
    await waitFor(() => expect(getByText('Test Fan has been banned for 24h.')).toBeTruthy());
    // System message should not have flag or delete buttons
    expect(queryByLabelText('Flag message')).toBeNull();
    expect(queryByLabelText('Delete message')).toBeNull();
  });

  it('shows banned input row when an active ban exists', async () => {
    const {getByText, queryByPlaceholderText} = renderChat();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); }); // flush init()
    await act(async () => { triggerMessages([]); });
    await act(async () => {
      triggerBan({bannedAt: Date.now(), expiresAt: Date.now() + 3600000, duration: '1h', authorName: 'Test Fan'});
    });
    await waitFor(() => expect(getByText(/banned from this chat/i)).toBeTruthy());
    expect(queryByPlaceholderText(/say something/i)).toBeNull();
  });

  it('shows permanently banned message when duration is permanent', async () => {
    const {getByText} = renderChat();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { triggerMessages([]); });
    await act(async () => {
      triggerBan({bannedAt: Date.now(), expiresAt: null, duration: 'permanent', authorName: 'Test Fan'});
    });
    await waitFor(() => expect(getByText(/permanently banned/i)).toBeTruthy());
  });

  it('shows normal input when ban is expired', async () => {
    const {getByPlaceholderText, queryByText} = renderChat();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { triggerMessages([]); });
    await act(async () => {
      triggerBan({bannedAt: Date.now() - 7200000, expiresAt: Date.now() - 3600000, duration: '1h', authorName: 'Test Fan'});
    });
    await waitFor(() => expect(getByPlaceholderText(/say something/i)).toBeTruthy());
    expect(queryByText(/banned from this chat/i)).toBeNull();
  });

  it('shows normal input when no ban exists', async () => {
    const {getByPlaceholderText} = renderChat();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { triggerMessages([]); });
    await act(async () => {
      triggerBan(null);
    });
    await waitFor(() => expect(getByPlaceholderText(/say something/i)).toBeTruthy());
  });

  it('attaches ban listener when myAuthorId resolves from anonymous', async () => {
    renderChat();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await waitFor(() => expect(mockBanOn).toHaveBeenCalled());
  });

  it('cleans up ban listener on unmount', async () => {
    const {unmount} = renderChat();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { triggerMessages([]); });
    unmount();
    expect(mockBanOff).toHaveBeenCalled();
  });
});
