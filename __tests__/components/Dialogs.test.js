import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import OnboardingDialog from '../../src/components/OnboardingDialog';
import SpoilerClearedDialog from '../../src/components/SpoilerClearedDialog';

// ─── OnboardingDialog ─────────────────────────────────────────────────────────

describe('OnboardingDialog', () => {
  const onAllow = jest.fn();
  const onSkip  = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders nothing meaningful when not visible', () => {
    const {queryByText} = render(
      <OnboardingDialog visible={false} onAllow={onAllow} onSkip={onSkip} />,
    );
    expect(queryByText('Stay in the loop')).toBeNull();
  });

  it('shows title and body when visible', () => {
    const {getByText} = render(
      <OnboardingDialog visible={true} onAllow={onAllow} onSkip={onSkip} />,
    );
    expect(getByText('Stay in the loop')).toBeTruthy();
    expect(getByText(/You can customise these anytime in Settings/)).toBeTruthy();
  });

  it('calls onAllow when allow button is pressed', () => {
    const {getByLabelText} = render(
      <OnboardingDialog visible={true} onAllow={onAllow} onSkip={onSkip} />,
    );
    fireEvent.press(getByLabelText('Allow notifications'));
    expect(onAllow).toHaveBeenCalledTimes(1);
  });

  it('calls onSkip when skip button is pressed', () => {
    const {getByLabelText} = render(
      <OnboardingDialog visible={true} onAllow={onAllow} onSkip={onSkip} />,
    );
    fireEvent.press(getByLabelText('Skip for now'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('does not call onAllow when skip is pressed', () => {
    const {getByLabelText} = render(
      <OnboardingDialog visible={true} onAllow={onAllow} onSkip={onSkip} />,
    );
    fireEvent.press(getByLabelText('Skip for now'));
    expect(onAllow).not.toHaveBeenCalled();
  });
});

// ─── SpoilerClearedDialog ─────────────────────────────────────────────────────

describe('SpoilerClearedDialog', () => {
  const onDismiss = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders nothing meaningful when not visible', () => {
    const {queryByText} = render(
      <SpoilerClearedDialog visible={false} onDismiss={onDismiss} />,
    );
    expect(queryByText('No Spoilers Disabled')).toBeNull();
  });

  it('shows title and body when visible', () => {
    const {getByText} = render(
      <SpoilerClearedDialog visible={true} onDismiss={onDismiss} />,
    );
    expect(getByText('No Spoilers Disabled')).toBeTruthy();
    expect(getByText(/Result notifications have been re-enabled/)).toBeTruthy();
  });

  it('calls onDismiss when GOT IT is pressed', () => {
    const {getByLabelText} = render(
      <SpoilerClearedDialog visible={true} onDismiss={onDismiss} />,
    );
    fireEvent.press(getByLabelText('Got it'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
