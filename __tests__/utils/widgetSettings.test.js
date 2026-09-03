import {NativeModules} from 'react-native';
import {syncWidgetTimeFormat} from '../../src/utils/widgetSettings';

describe('syncWidgetTimeFormat', () => {
  afterEach(() => {
    delete NativeModules.WidgetSettings;
  });

  it('does not throw when the native module is unavailable (e.g. older build)', () => {
    expect(() => syncWidgetTimeFormat(true)).not.toThrow();
  });

  it('calls the native bridge with a coerced boolean when available', () => {
    const setUse12HourTime = jest.fn();
    NativeModules.WidgetSettings = {setUse12HourTime};

    syncWidgetTimeFormat(true);

    expect(setUse12HourTime).toHaveBeenCalledWith(true);
  });

  it('coerces a falsy/undefined value to false rather than passing it through', () => {
    const setUse12HourTime = jest.fn();
    NativeModules.WidgetSettings = {setUse12HourTime};

    syncWidgetTimeFormat(undefined);

    expect(setUse12HourTime).toHaveBeenCalledWith(false);
  });

  it('swallows errors thrown by the native module rather than crashing the caller', () => {
    NativeModules.WidgetSettings = {
      setUse12HourTime: () => { throw new Error('native crash'); },
    };

    expect(() => syncWidgetTimeFormat(true)).not.toThrow();
  });
});
