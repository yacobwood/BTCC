#import <React/RCTBridgeModule.h>

// Exposes WidgetSettingsModule.swift's setUse12HourTime: to RN. Xcode
// auto-generates the Swift-to-ObjC bridging header for this target, so no
// import of the Swift class is needed here - RCT_EXTERN_MODULE resolves it
// by its @objc(WidgetSettings) name at runtime.
@interface RCT_EXTERN_MODULE(WidgetSettings, NSObject)

RCT_EXTERN_METHOD(setUse12HourTime:(BOOL)use12Hour)

@end
