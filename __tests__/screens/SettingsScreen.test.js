import React from 'react';
import {act} from '@testing-library/react-native';
import {Switch} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SettingsScreen from '../../src/screens/SettingsScreen';
import {renderWithProviders, makeNav} from './testUtils';

const nav = makeNav();

async function renderSettings(storageOverrides = {}) {
  AsyncStorage.getItem.mockImplementation((key) => {
    if (key in storageOverrides) return Promise.resolve(String(storageOverrides[key]));
    return Promise.resolve(null);
  });
  const utils = renderWithProviders(<SettingsScreen navigation={nav} />);
  // Flush all provider useEffect async initializations so they don't
  // overwrite state changes made during the test.
  await act(async () => {});
  return utils;
}

// fireEvent targets the native RCTSwitch; after providers flush their async
// init, only direct onValueChange calls reliably update JS context state.
function toggleSwitch(UNSAFE_getAllByType, label, value) {
  const sw = UNSAFE_getAllByType(Switch).find(s => s.props.accessibilityLabel === label);
  if (!sw) throw new Error(`Switch with label "${label}" not found`);
  sw.props.onValueChange(value);
}

describe('SettingsScreen', () => {
  describe('structure', () => {
    it('renders the NOTIFICATIONS section heading', async () => {
      const {getByText} = await renderSettings();
      expect(getByText('NOTIFICATIONS')).toBeTruthy();
    });

    it('renders the UNIT DISPLAY section', async () => {
      const {getByText} = await renderSettings();
      expect(getByText('UNIT DISPLAY')).toBeTruthy();
    });

    it('renders top-level notification rows', async () => {
      const {getByText} = await renderSettings();
      expect(getByText('News alerts')).toBeTruthy();
      expect(getByText('Race weekend preview')).toBeTruthy();
      expect(getByText('Standings update')).toBeTruthy();
    });

    it('renders Pre-race alerts group', async () => {
      const {getByText} = await renderSettings();
      expect(getByText('Pre-race alerts')).toBeTruthy();
    });

    it('renders Results alerts group', async () => {
      const {getByText} = await renderSettings();
      expect(getByText('Results alerts')).toBeTruthy();
    });

    it('renders pre-race session children', async () => {
      const {getByLabelText} = await renderSettings();
      expect(getByLabelText('Pre-race Free Practice')).toBeTruthy();
      expect(getByLabelText('Pre-race Qualifying')).toBeTruthy();
      expect(getByLabelText('Pre-race Qualifying Race')).toBeTruthy();
    });

    it('renders Race sub-group with R1/R2/R3', async () => {
      const {getByLabelText} = await renderSettings();
      expect(getByLabelText('Pre-race Race 1')).toBeTruthy();
      expect(getByLabelText('Pre-race Race 2')).toBeTruthy();
      expect(getByLabelText('Pre-race Race 3')).toBeTruthy();
    });

    it('renders the km / miles unit toggles', async () => {
      const {getByText} = await renderSettings();
      expect(getByText('km')).toBeTruthy();
      expect(getByText('miles')).toBeTruthy();
    });
  });

  describe('Pre-race parent toggle', () => {
    it('all pre-race children are enabled by default', async () => {
      const {getByLabelText} = await renderSettings();
      expect(getByLabelText('Pre-race Free Practice')).toHaveProp('disabled', false);
      expect(getByLabelText('Pre-race Qualifying')).toHaveProp('disabled', false);
      expect(getByLabelText('Pre-race Qualifying Race')).toHaveProp('disabled', false);
      expect(getByLabelText('Pre-race Race 1')).toHaveProp('disabled', false);
    });

    it('disabling Pre-race alerts disables child switches', async () => {
      const {getByLabelText, UNSAFE_getAllByType} = await renderSettings();
      await act(async () => { toggleSwitch(UNSAFE_getAllByType, 'Pre-race alerts', false); });
      expect(getByLabelText('Pre-race Free Practice')).toHaveProp('disabled', true);
      expect(getByLabelText('Pre-race Qualifying')).toHaveProp('disabled', true);
      expect(getByLabelText('Pre-race Qualifying Race')).toHaveProp('disabled', true);
      expect(getByLabelText('Pre-race Race 1')).toHaveProp('disabled', true);
      expect(getByLabelText('Pre-race Race 2')).toHaveProp('disabled', true);
      expect(getByLabelText('Pre-race Race 3')).toHaveProp('disabled', true);
    });

    it('disabling Pre-race alerts sets child switch values to false', async () => {
      const {getByLabelText, UNSAFE_getAllByType} = await renderSettings();
      await act(async () => { toggleSwitch(UNSAFE_getAllByType, 'Pre-race alerts', false); });
      expect(getByLabelText('Pre-race Free Practice')).toHaveProp('value', false);
      expect(getByLabelText('Pre-race Race 1')).toHaveProp('value', false);
    });

    it('re-enabling Pre-race alerts re-enables children', async () => {
      const {getByLabelText, UNSAFE_getAllByType} = await renderSettings();
      await act(async () => { toggleSwitch(UNSAFE_getAllByType, 'Pre-race alerts', false); });
      await act(async () => { toggleSwitch(UNSAFE_getAllByType, 'Pre-race alerts', true); });
      expect(getByLabelText('Pre-race Free Practice')).toHaveProp('disabled', false);
      expect(getByLabelText('Pre-race Race 1')).toHaveProp('disabled', false);
    });
  });

  describe('Race sub-parent toggle (within Pre-race)', () => {
    it('disabling Race sub-parent disables R1/R2/R3 but not FP', async () => {
      const {getByLabelText, UNSAFE_getAllByType} = await renderSettings();
      await act(async () => { toggleSwitch(UNSAFE_getAllByType, 'Pre-race Race', false); });
      expect(getByLabelText('Pre-race Race 1')).toHaveProp('disabled', true);
      expect(getByLabelText('Pre-race Race 2')).toHaveProp('disabled', true);
      expect(getByLabelText('Pre-race Race 3')).toHaveProp('disabled', true);
      expect(getByLabelText('Pre-race Free Practice')).toHaveProp('disabled', false);
    });
  });

  describe('Results parent toggle', () => {
    it('disabling Results alerts disables its children', async () => {
      const {getByLabelText, UNSAFE_getAllByType} = await renderSettings();
      await act(async () => { toggleSwitch(UNSAFE_getAllByType, 'Results alerts', false); });
      expect(getByLabelText('Results Race 1')).toHaveProp('disabled', true);
      expect(getByLabelText('Results Race 2')).toHaveProp('disabled', true);
      expect(getByLabelText('Results Race 3')).toHaveProp('disabled', true);
    });
  });

  describe('individual toggles', () => {
    it('toggling News alerts off persists to AsyncStorage', async () => {
      const {UNSAFE_getAllByType} = await renderSettings();
      await act(async () => { toggleSwitch(UNSAFE_getAllByType, 'News alerts', false); });
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('setting_news_alerts', 'false');
    });

    it('toggling Pre-race Qualifying Race persists with a qrace key', async () => {
      const {UNSAFE_getAllByType} = await renderSettings();
      await act(async () => { toggleSwitch(UNSAFE_getAllByType, 'Pre-race Qualifying Race', false); });
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('qrace'), 'false',
      );
    });
  });

  describe('loaded from storage', () => {
    it('Pre-race parent starts off when stored as false', async () => {
      const {getByLabelText} = await renderSettings({'setting_pre_race': 'false'});
      expect(getByLabelText('Pre-race alerts')).toHaveProp('value', false);
      expect(getByLabelText('Pre-race Free Practice')).toHaveProp('disabled', true);
    });

    it('Race 2 starts off when stored as false', async () => {
      const {getByLabelText} = await renderSettings({'setting_pre_race_race2': 'false'});
      expect(getByLabelText('Pre-race Race 2')).toHaveProp('value', false);
    });
  });
});
