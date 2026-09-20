import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {Linking} from 'react-native';
import CrossPromoDialog from '../../src/components/CrossPromoDialog';

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.ticketstackapp';

beforeEach(() => {
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('CrossPromoDialog', () => {
  it('renders nothing when not visible', () => {
    const {queryByText} = render(<CrossPromoDialog visible={false} onDismiss={jest.fn()} />);
    expect(queryByText('TicketStack')).toBeNull();
  });

  it('shows the app name and the same-developer framing, never a sponsorship claim', () => {
    const {getByText, queryByText} = render(<CrossPromoDialog visible={true} onDismiss={jest.fn()} />);
    expect(getByText('TicketStack')).toBeTruthy();
    expect(getByText('ALSO BY THE SAME DEVELOPER')).toBeTruthy();
    // The whole point of this component is to never claim a sponsorship or
    // formal partnership that doesn't exist - guard against that wording
    // creeping back in.
    expect(queryByText(/sponsor/i)).toBeNull();
    expect(queryByText(/in association with/i)).toBeNull();
  });

  it('pressing CHECK IT OUT opens the Play Store URL and dismisses', () => {
    const onDismiss = jest.fn();
    const {getByText} = render(<CrossPromoDialog visible={true} onDismiss={onDismiss} />);
    fireEvent.press(getByText('CHECK IT OUT'));
    expect(Linking.openURL).toHaveBeenCalledWith(PLAY_URL);
    expect(onDismiss).toHaveBeenCalled();
  });

  it('pressing MAYBE LATER dismisses without opening a URL', () => {
    const onDismiss = jest.fn();
    const {getByText} = render(<CrossPromoDialog visible={true} onDismiss={onDismiss} />);
    fireEvent.press(getByText('MAYBE LATER'));
    expect(onDismiss).toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});
