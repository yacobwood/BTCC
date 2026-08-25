import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import NudgeBanner from '../../src/components/NudgeBanner';

describe('NudgeBanner', () => {
  it('renders nothing when visible is false', () => {
    const {toJSON} = render(
      <NudgeBanner visible={false} message="Hello" onDismiss={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('shows the message when visible', () => {
    const {getByText} = render(
      <NudgeBanner visible={true} message="Welcome back!" onDismiss={jest.fn()} />,
    );
    expect(getByText('Welcome back!')).toBeTruthy();
  });

  it('calls onAction when the action label is pressed', () => {
    const onAction = jest.fn();
    const {getByLabelText} = render(
      <NudgeBanner visible={true} message="Hi" actionLabel="Season" onAction={onAction} onDismiss={jest.fn()} />,
    );
    fireEvent.press(getByLabelText('Season'));
    expect(onAction).toHaveBeenCalled();
  });

  it('calls onDismiss when the dismiss icon is pressed', () => {
    const onDismiss = jest.fn();
    const {getByLabelText} = render(
      <NudgeBanner visible={true} message="Hi" onDismiss={onDismiss} />,
    );
    fireEvent.press(getByLabelText('Dismiss'));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('does not render an action button when actionLabel is not provided', () => {
    const {queryByLabelText} = render(
      <NudgeBanner visible={true} message="Hi" onDismiss={jest.fn()} />,
    );
    expect(queryByLabelText('Season')).toBeNull();
  });
});
