import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {Linking, Platform} from 'react-native';
import UpdateDialog from '../../src/components/UpdateDialog';

// storeUrl/storeName are computed inside the render function (not module-level
// constants), so setting Platform.OS before rendering gives the correct value.

const IOS_URL     = 'https://apps.apple.com/gb/app/btcc-hub/id6762619368';
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.btccfanhub';

beforeEach(() => {
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
  Platform.OS = 'ios';
});

describe('UpdateDialog — iOS', () => {
  beforeEach(() => { Platform.OS = 'ios'; });

  it('pressing UPDATE NOW opens the App Store URL', () => {
    const {getByText} = render(<UpdateDialog visible={true} onDismiss={jest.fn()} />);
    fireEvent.press(getByText('UPDATE NOW'));
    expect(Linking.openURL).toHaveBeenCalledWith(IOS_URL);
  });

  it('does not open the Play Store URL', () => {
    const {getByText} = render(<UpdateDialog visible={true} onDismiss={jest.fn()} />);
    fireEvent.press(getByText('UPDATE NOW'));
    expect(Linking.openURL).not.toHaveBeenCalledWith(
      expect.stringContaining('play.google.com'),
    );
  });

  it('shows "App Store" in the dialog body', () => {
    const {getByText} = render(<UpdateDialog visible={true} onDismiss={jest.fn()} />);
    expect(getByText(/App Store/)).toBeTruthy();
  });
});

describe('UpdateDialog — Android', () => {
  beforeEach(() => { Platform.OS = 'android'; });

  it('pressing UPDATE NOW opens the Play Store URL', () => {
    const {getByText} = render(<UpdateDialog visible={true} onDismiss={jest.fn()} />);
    fireEvent.press(getByText('UPDATE NOW'));
    expect(Linking.openURL).toHaveBeenCalledWith(ANDROID_URL);
  });

  it('does not open the App Store URL', () => {
    const {getByText} = render(<UpdateDialog visible={true} onDismiss={jest.fn()} />);
    fireEvent.press(getByText('UPDATE NOW'));
    expect(Linking.openURL).not.toHaveBeenCalledWith(
      expect.stringContaining('apps.apple.com'),
    );
  });

  it('shows "Play Store" in the dialog body', () => {
    const {getByText} = render(<UpdateDialog visible={true} onDismiss={jest.fn()} />);
    expect(getByText(/Play Store/)).toBeTruthy();
  });
});

describe('UpdateDialog — dismiss', () => {
  it('pressing NOT NOW calls onDismiss without opening a URL', () => {
    const onDismiss = jest.fn();
    const {getByText} = render(<UpdateDialog visible={true} onDismiss={onDismiss} />);
    fireEvent.press(getByText('NOT NOW'));
    expect(onDismiss).toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});
