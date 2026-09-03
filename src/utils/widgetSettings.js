import {NativeModules} from 'react-native';

// Home-screen widgets run as a separate native process on both platforms and
// cannot read AsyncStorage, so the 12/24hr display preference has to be
// handed across explicitly via a tiny native module:
//   - Android: WidgetSettingsModule writes into the same SharedPreferences
//     file the widgets already read (WidgetPrefs.kt) and nudges them to redraw.
//   - iOS: WidgetSettingsModule writes into the shared App Group UserDefaults
//     the widget extension already reads, then reloads its timelines.
// Both are best-effort - a missing/older native build simply leaves the
// widget showing 24hr, which is the pre-existing behaviour, not a crash.
export function syncWidgetTimeFormat(use12Hour) {
  try {
    NativeModules.WidgetSettings?.setUse12HourTime?.(!!use12Hour);
  } catch {}
}
