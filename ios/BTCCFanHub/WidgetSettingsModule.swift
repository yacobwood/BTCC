import Foundation
import WidgetKit

// Bridges the RN "12/24hr time" setting into the shared App Group UserDefaults
// the widget extension reads from - widget extensions can't read AsyncStorage
// or call back into the RN bridge, so this is a one-way handoff triggered
// whenever the setting changes or is restored from the user's Firestore
// profile on login (see src/store/settings.js / src/utils/widgetSettings.js).
@objc(WidgetSettings)
class WidgetSettingsModule: NSObject {
  private let defaults = UserDefaults(suiteName: "group.com.btccfanhub.widget") ?? .standard

  @objc(setUse12HourTime:)
  func setUse12HourTime(_ use12Hour: Bool) {
    defaults.set(use12Hour, forKey: "use12HourTime")
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
