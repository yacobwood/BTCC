import React from 'react';
import {fireEvent, waitFor} from '@testing-library/react-native';
import BugReportScreen from '../../src/screens/BugReportScreen';
import {renderWithProviders, makeNav} from './testUtils';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn(), bugReportSubmitted: jest.fn()},
}));

const nav = makeNav();

describe('BugReportScreen', () => {
  beforeEach(() => {
    // jest.setup.js already calls clearAllMocks() and restores global.fetch in its own beforeEach.
    // Here we simply override the resolved value for this suite's tests.
    global.fetch.mockResolvedValue({ok: true});
  });

  // ── Header ────────────────────────────────────────────────────────────────────

  it('renders FEEDBACK & BUGS header', () => {
    const {getByText} = renderWithProviders(<BugReportScreen navigation={nav} />);
    expect(getByText('FEEDBACK & BUGS')).toBeTruthy();
  });

  it('navigates back when back button pressed', () => {
    const {getByLabelText} = renderWithProviders(<BugReportScreen navigation={nav} />);
    fireEvent.press(getByLabelText('Go back'));
    expect(nav.goBack).toHaveBeenCalled();
  });

  // ── Category chips ────────────────────────────────────────────────────────────

  it('renders Bug category chip as selected by default', () => {
    // Bug is categories[0] — it starts selected
    const {getByLabelText} = renderWithProviders(<BugReportScreen navigation={nav} />);
    expect(getByLabelText('Bug category, selected')).toBeTruthy();
  });

  it('renders all five category chips', () => {
    const {getByLabelText} = renderWithProviders(<BugReportScreen navigation={nav} />);
    expect(getByLabelText('Bug category, selected')).toBeTruthy(); // default
    expect(getByLabelText('Crash category, not selected')).toBeTruthy();
    expect(getByLabelText('UI Issue category, not selected')).toBeTruthy();
    expect(getByLabelText('Feature Request category, not selected')).toBeTruthy();
    expect(getByLabelText('Other category, not selected')).toBeTruthy();
  });

  it('selecting a different category marks it selected and deselects Bug', () => {
    const {getByLabelText} = renderWithProviders(<BugReportScreen navigation={nav} />);
    fireEvent.press(getByLabelText('Crash category, not selected'));
    expect(getByLabelText('Crash category, selected')).toBeTruthy();
    expect(getByLabelText('Bug category, not selected')).toBeTruthy();
  });

  // ── Form fields ───────────────────────────────────────────────────────────────

  it('renders title input', () => {
    const {getByLabelText} = renderWithProviders(<BugReportScreen navigation={nav} />);
    expect(getByLabelText('Title')).toBeTruthy();
  });

  it('renders description input', () => {
    const {getByLabelText} = renderWithProviders(<BugReportScreen navigation={nav} />);
    expect(getByLabelText('Description')).toBeTruthy();
  });

  it('renders steps to reproduce input', () => {
    const {getByLabelText} = renderWithProviders(<BugReportScreen navigation={nav} />);
    expect(getByLabelText('Steps to reproduce')).toBeTruthy();
  });

  it('renders Submit feedback button', () => {
    const {getByLabelText} = renderWithProviders(<BugReportScreen navigation={nav} />);
    expect(getByLabelText('Submit feedback')).toBeTruthy();
  });

  // ── Submission ────────────────────────────────────────────────────────────────

  it('shows success state after successful submission', async () => {
    const {getByLabelText, getByPlaceholderText, getByText} = renderWithProviders(<BugReportScreen navigation={nav} />);
    fireEvent.changeText(getByPlaceholderText('Brief description'), 'App crashes on launch');
    fireEvent.changeText(getByLabelText('Description'), 'It always crashes');
    fireEvent.press(getByLabelText('Submit feedback'));
    await waitFor(() => expect(getByText('Thanks!')).toBeTruthy());
  });

  it('shows error message when submission fails', async () => {
    global.fetch.mockResolvedValue({ok: false});
    const {getByLabelText, getByPlaceholderText, getByText} = renderWithProviders(<BugReportScreen navigation={nav} />);
    fireEvent.changeText(getByPlaceholderText('Brief description'), 'App crashes');
    fireEvent.press(getByLabelText('Submit feedback'));
    await waitFor(() => expect(getByText('Failed to submit. Please try again.')).toBeTruthy());
  });

  it('shows Back to More button in success state', async () => {
    const {getByLabelText, getByPlaceholderText, getByText} = renderWithProviders(<BugReportScreen navigation={nav} />);
    fireEvent.changeText(getByPlaceholderText('Brief description'), 'Crash on launch');
    fireEvent.press(getByLabelText('Submit feedback'));
    await waitFor(() => getByText('Thanks!'));
    expect(getByText('Back to More')).toBeTruthy();
  });
});
