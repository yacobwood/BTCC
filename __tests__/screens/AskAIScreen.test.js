import React from 'react';
import {fireEvent, waitFor, act} from '@testing-library/react-native';
import AskAIScreen from '../../src/screens/AskAIScreen';
import {renderWithProviders} from './testUtils';

const AI_URL = 'https://mock-functions.test/askBtccAi';

jest.mock('../../src/config/firebase', () => ({
  ASK_BTCC_AI_URL: 'https://mock-functions.test/askBtccAi',
}));

// Routes fetch calls: only the AI URL returns a meaningful payload.
// Provider fetches (flags.json, live_urls.json etc.) get an empty object.
function setupFetch({answer = null, error = null, networkFail = false} = {}) {
  global.fetch = jest.fn().mockImplementation((url) => {
    if (url === AI_URL) {
      if (networkFail) return Promise.reject(new Error('Network error'));
      if (error) return Promise.resolve({ok: false, status: 500, json: () => Promise.resolve({error})});
      return Promise.resolve({ok: true, json: () => Promise.resolve({answer})});
    }
    return Promise.resolve({ok: true, json: () => Promise.resolve({})});
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AskAIScreen', () => {
  it('renders empty state with prompt text', () => {
    const {getByText} = renderWithProviders(<AskAIScreen />);
    expect(getByText('Ask Colin')).toBeTruthy();
    expect(getByText('Ask anything about the BTCC')).toBeTruthy();
  });

  it('does not submit when input is empty', async () => {
    setupFetch();
    const {getByLabelText} = renderWithProviders(<AskAIScreen />);
    fireEvent.press(getByLabelText('Send question'));
    const aiCalls = global.fetch.mock.calls.filter(([url]) => url === AI_URL);
    expect(aiCalls).toHaveLength(0);
  });

  it('send button is disabled when input is empty', () => {
    const {getByLabelText} = renderWithProviders(<AskAIScreen />);
    expect(getByLabelText('Send question').props.accessibilityState?.disabled).toBe(true);
  });

  it('appends user message immediately on submit', async () => {
    setupFetch({answer: 'Colin Turkington has won four titles.'});
    const {getByPlaceholderText, getByLabelText, getByText} = renderWithProviders(<AskAIScreen />);

    fireEvent.changeText(getByPlaceholderText('Ask a BTCC question...'), 'How many titles has Turkington won?');
    fireEvent.press(getByLabelText('Send question'));

    await waitFor(() => {
      expect(getByText('How many titles has Turkington won?')).toBeTruthy();
    });
  });

  it('renders Colin response after successful fetch', async () => {
    const answer = 'Colin Turkington has won four BTCC titles.';
    setupFetch({answer});
    const {getByPlaceholderText, getByLabelText, getByText, getAllByText} = renderWithProviders(<AskAIScreen />);

    fireEvent.changeText(getByPlaceholderText('Ask a BTCC question...'), 'How many titles has Turkington won?');
    fireEvent.press(getByLabelText('Send question'));

    await waitFor(() => {
      expect(getByText(answer)).toBeTruthy();
    });
    expect(getAllByText('Colin').length).toBeGreaterThan(0);
  });

  it('clears the input after sending', async () => {
    setupFetch({answer: 'Donington Park is in Leicestershire.'});
    const {getByPlaceholderText, getByLabelText} = renderWithProviders(<AskAIScreen />);
    const input = getByPlaceholderText('Ask a BTCC question...');

    fireEvent.changeText(input, 'Where is Donington Park?');
    fireEvent.press(getByLabelText('Send question'));

    await waitFor(() => {
      expect(input.props.value).toBe('');
    });
  });

  it('shows error message when fetch returns an error response', async () => {
    setupFetch({error: 'Internal error'});
    const {getByPlaceholderText, getByLabelText, getByText} = renderWithProviders(<AskAIScreen />);

    fireEvent.changeText(getByPlaceholderText('Ask a BTCC question...'), 'What is BTCC?');
    fireEvent.press(getByLabelText('Send question'));

    await waitFor(() => {
      expect(getByText('Something went wrong. Please try again.')).toBeTruthy();
    });
  });

  it('shows error message on network failure', async () => {
    setupFetch({networkFail: true});
    const {getByPlaceholderText, getByLabelText, getByText} = renderWithProviders(<AskAIScreen />);

    fireEvent.changeText(getByPlaceholderText('Ask a BTCC question...'), 'What is BTCC?');
    fireEvent.press(getByLabelText('Send question'));

    await waitFor(() => {
      expect(getByText('Something went wrong. Please try again.')).toBeTruthy();
    });
  });

  it('posts to the correct URL with the question in the body', async () => {
    setupFetch({answer: 'The BTCC races at circuits across the UK.'});
    const {getByPlaceholderText, getByLabelText} = renderWithProviders(<AskAIScreen />);

    fireEvent.changeText(getByPlaceholderText('Ask a BTCC question...'), 'Where does BTCC race?');
    await act(async () => {
      fireEvent.press(getByLabelText('Send question'));
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        AI_URL,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({question: 'Where does BTCC race?'}),
        }),
      );
    });
  });
});
