import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import OnboardingDialog from '../../src/components/OnboardingDialog';

describe('OnboardingDialog', () => {
  it('shows the title and Allow/Maybe Later actions', () => {
    const {getByText, getByLabelText} = render(
      <OnboardingDialog visible={true} onAllow={jest.fn()} onSkip={jest.fn()} />,
    );
    expect(getByText('Stay in the loop')).toBeTruthy();
    expect(getByLabelText('Allow notifications')).toBeTruthy();
    expect(getByLabelText('Skip for now')).toBeTruthy();
  });

  it('calls onAllow when ALLOW NOTIFICATIONS is pressed', () => {
    const onAllow = jest.fn();
    const {getByLabelText} = render(
      <OnboardingDialog visible={true} onAllow={onAllow} onSkip={jest.fn()} />,
    );
    fireEvent.press(getByLabelText('Allow notifications'));
    expect(onAllow).toHaveBeenCalled();
  });

  it('calls onSkip when MAYBE LATER is pressed', () => {
    const onSkip = jest.fn();
    const {getByLabelText} = render(
      <OnboardingDialog visible={true} onAllow={jest.fn()} onSkip={onSkip} />,
    );
    fireEvent.press(getByLabelText('Skip for now'));
    expect(onSkip).toHaveBeenCalled();
  });

  it('does not show the "New to BTCC?" link when onLearnBasics is not provided', () => {
    const {queryByText} = render(
      <OnboardingDialog visible={true} onAllow={jest.fn()} onSkip={jest.fn()} />,
    );
    expect(queryByText(/New to BTCC/)).toBeNull();
  });

  it('shows and wires up the "New to BTCC?" link when onLearnBasics is provided', () => {
    const onLearnBasics = jest.fn();
    const {getByLabelText} = render(
      <OnboardingDialog
        visible={true}
        onAllow={jest.fn()}
        onSkip={jest.fn()}
        onLearnBasics={onLearnBasics}
      />,
    );
    fireEvent.press(getByLabelText('New to BTCC? Learn the basics'));
    expect(onLearnBasics).toHaveBeenCalled();
  });
});
