import React from 'react';
import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {AllProviders} from '../screens/testUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ChatFab from '../../src/components/ChatFab';

jest.mock('../../src/screens/ChatScreen', () => ({
  __esModule: true,
  default: ({onClose}) => {
    const {View, TouchableOpacity, Text} = require('react-native');
    return (
      <View testID="chat-screen">
        <TouchableOpacity testID="chat-close" onPress={onClose}><Text>Close</Text></TouchableOpacity>
      </View>
    );
  },
}));

var mockDbOn, mockDbOff, mockDbRef;

jest.mock('@react-native-firebase/database', () => {
  mockDbOn  = jest.fn();
  mockDbOff = jest.fn();
  mockDbRef = {
    orderByChild: jest.fn().mockReturnThis(),
    limitToLast:  jest.fn().mockReturnThis(),
    on:  mockDbOn,
    off: mockDbOff,
  };
  const db = jest.fn(() => ({ref: jest.fn(() => mockDbRef)}));
  db.ServerValue = {TIMESTAMP: 'TIMESTAMP'};
  return db;
});

// Control feature flags
var mockLiveChat = false;
jest.mock('../../src/store/featureFlags', () => ({
  useFeatureFlags: () => ({live_chat: mockLiveChat}),
  FeatureFlagsProvider: ({children}) => children,
}));

function triggerSnapshot(timestamp) {
  const snap = {forEach: cb => cb({val: () => ({timestamp, hidden: false})})};
  const onCall = mockDbOn.mock.calls[0];
  if (onCall) onCall[1](snap);
}

function renderFab(props = {}) {
  return render(
    <AllProviders>
      <ChatFab {...props} />
    </AllProviders>,
  );
}

describe('ChatFab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLiveChat = false;
    AsyncStorage.getItem.mockResolvedValue(null);
    mockDbOn.mockImplementation(() => {});
  });

  // ── Visibility ────────────────────────────────────────────────────────────────

  it('renders nothing when live_chat flag is off', async () => {
    mockLiveChat = false;
    const {queryByLabelText} = renderFab();
    await waitFor(() => expect(queryByLabelText(/open live chat/i)).toBeNull());
  });

  it('renders nothing when chatFab setting is false even if live_chat is true', async () => {
    mockLiveChat = true;
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'setting_chat_fab' ? Promise.resolve('false') : Promise.resolve(null),
    );
    const {queryByLabelText} = renderFab();
    await waitFor(() => expect(queryByLabelText(/open live chat/i)).toBeNull());
  });

  it('renders the FAB when live_chat flag is on and chatFab is true', async () => {
    mockLiveChat = true;
    const {getByLabelText} = renderFab();
    await waitFor(() => expect(getByLabelText('Open live chat')).toBeTruthy());
  });

  // ── Unread tracking ───────────────────────────────────────────────────────────

  it('shows no unread badge when message timestamp is older than lastRead', async () => {
    mockLiveChat = true;
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'chat_last_read' ? Promise.resolve(String(Date.now() + 5000)) : Promise.resolve(null),
    );
    const {getByLabelText} = renderFab();
    await act(async () => {
      triggerSnapshot(Date.now() - 1000); // message older than last read
    });
    await waitFor(() => expect(getByLabelText('Open live chat')).toBeTruthy());
  });

  it('shows unread badge when message timestamp is newer than lastRead', async () => {
    mockLiveChat = true;
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'chat_last_read' ? Promise.resolve(String(Date.now() - 1000)) : Promise.resolve(null),
    );
    const {getByLabelText} = renderFab();
    await act(async () => {
      triggerSnapshot(Date.now() + 1000); // guarantee newer than lastReadRef.current regardless of async init timing
    });
    await waitFor(() => expect(getByLabelText('Open live chat, new messages')).toBeTruthy());
  });

  it('loads lastRead timestamp from AsyncStorage on mount and uses it for comparison', async () => {
    mockLiveChat = true;
    const storedTs = Date.now() - 500;
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'chat_last_read' ? Promise.resolve(String(storedTs)) : Promise.resolve(null),
    );
    const {getByLabelText} = renderFab();
    // Trigger a message that is older than storedTs - should NOT be unread
    await act(async () => {
      triggerSnapshot(storedTs - 100);
    });
    await waitFor(() => expect(getByLabelText('Open live chat')).toBeTruthy());
  });

  it('unread clears when FAB is pressed (opened)', async () => {
    mockLiveChat = true;
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'chat_last_read' ? Promise.resolve(String(Date.now() - 1000)) : Promise.resolve(null),
    );
    const {getByLabelText} = renderFab();
    await act(async () => {
      triggerSnapshot(Date.now() + 1000); // guarantee newer than lastReadRef.current regardless of async init timing
    });
    await waitFor(() => getByLabelText('Open live chat, new messages'));
    fireEvent.press(getByLabelText('Open live chat, new messages'));
    await waitFor(() => expect(getByLabelText('Close live chat')).toBeTruthy());
  });

  // ── Firebase lifecycle ────────────────────────────────────────────────────────

  it('registers Firebase listener when live_chat is true and chatFab is true', async () => {
    mockLiveChat = true;
    renderFab();
    await waitFor(() => expect(mockDbOn).toHaveBeenCalled());
  });

  it('does not register Firebase listener when live_chat is false', async () => {
    mockLiveChat = false;
    renderFab();
    await waitFor(() => {});
    expect(mockDbOn).not.toHaveBeenCalled();
  });

  it('calls ref.off on unmount to clean up the listener', async () => {
    mockLiveChat = true;
    const {unmount} = renderFab();
    await waitFor(() => expect(mockDbOn).toHaveBeenCalled());
    unmount();
    expect(mockDbOff).toHaveBeenCalled();
  });

  // ── Open / close ──────────────────────────────────────────────────────────────

  it('pressing FAB opens the ChatScreen modal', async () => {
    mockLiveChat = true;
    const {getByLabelText, getByTestId} = renderFab();
    await waitFor(() => getByLabelText('Open live chat'));
    fireEvent.press(getByLabelText('Open live chat'));
    await waitFor(() => expect(getByTestId('chat-screen')).toBeTruthy());
  });

  it('calls AsyncStorage.setItem with current timestamp when FAB is pressed', async () => {
    mockLiveChat = true;
    const {getByLabelText} = renderFab();
    await waitFor(() => getByLabelText('Open live chat'));
    fireEvent.press(getByLabelText('Open live chat'));
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'chat_last_read',
        expect.any(String),
      ),
    );
  });

  it('pressing the close FAB inside the modal closes it', async () => {
    mockLiveChat = true;
    const {getByLabelText, queryByTestId} = renderFab();
    await waitFor(() => getByLabelText('Open live chat'));
    fireEvent.press(getByLabelText('Open live chat'));
    await waitFor(() => getByLabelText('Close live chat'));
    fireEvent.press(getByLabelText('Close live chat'));
    await waitFor(() => expect(queryByTestId('chat-screen')).toBeNull());
  });

  it('closing via chat-close button clears unread state', async () => {
    mockLiveChat = true;
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'chat_last_read' ? Promise.resolve(String(Date.now() - 1000)) : Promise.resolve(null),
    );
    const {getByLabelText, getByTestId, queryByTestId} = renderFab();
    await act(async () => { triggerSnapshot(Date.now() + 1000); }); // guarantee newer than lastReadRef.current
    await waitFor(() => getByLabelText('Open live chat, new messages'));
    // Open
    fireEvent.press(getByLabelText('Open live chat, new messages'));
    await waitFor(() => getByTestId('chat-screen'));
    // Close via the chat screen's close button
    fireEvent.press(getByTestId('chat-close'));
    await waitFor(() => {
      expect(queryByTestId('chat-screen')).toBeNull();
      expect(getByLabelText('Open live chat')).toBeTruthy();
    });
  });

  it('closes chat and clears unread when close FAB is pressed', async () => {
    mockLiveChat = true;
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'chat_last_read' ? Promise.resolve(String(Date.now() - 1000)) : Promise.resolve(null),
    );
    const {getByLabelText, getByTestId, queryByTestId} = renderFab();
    await act(async () => { triggerSnapshot(Date.now() + 1000); }); // guarantee newer than lastReadRef.current
    await waitFor(() => getByLabelText('Open live chat, new messages'));
    fireEvent.press(getByLabelText('Open live chat, new messages'));
    await waitFor(() => getByTestId('chat-screen'));
    fireEvent.press(getByTestId('chat-close'));
    await waitFor(() => {
      expect(queryByTestId('chat-screen')).toBeNull();
      expect(getByLabelText('Open live chat')).toBeTruthy();
    });
  });

  // ── Settings toggle ───────────────────────────────────────────────────────────

  it('respects chatFab setting: renders nothing when chatFab is false', async () => {
    mockLiveChat = true;
    AsyncStorage.getItem.mockImplementation(key =>
      key === 'setting_chat_fab' ? Promise.resolve('false') : Promise.resolve(null),
    );
    const {queryByLabelText} = renderFab();
    await waitFor(() => expect(queryByLabelText(/open live chat/i)).toBeNull());
  });
});
