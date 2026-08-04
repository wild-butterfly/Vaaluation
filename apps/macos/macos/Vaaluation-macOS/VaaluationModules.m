#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE (VLSettings, NSObject)

RCT_EXTERN_METHOD(getSettings : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setSettings : (NSString *)json
                  resolver : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

@end

@interface RCT_EXTERN_MODULE (VLLog, NSObject)

RCT_EXTERN_METHOD(log : (NSString *)level
                  scope : (NSString *)scope
                  message : (NSString *)message)

RCT_EXTERN_METHOD(getRecent : (nonnull NSNumber *)limit
                  resolver : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clear : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getLogFilePath : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

@end

@interface RCT_EXTERN_MODULE (VLEvents, RCTEventEmitter)
@end

@interface RCT_EXTERN_MODULE (VLPermissions, NSObject)

RCT_EXTERN_METHOD(getStatus : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(requestAccessibility : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(openSystemSettings : (NSString *)pane)

@end

@interface RCT_EXTERN_MODULE (VLHotkeys, NSObject)

RCT_EXTERN_METHOD(applyFromSettings : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getRegistrations : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(captureNextKeyCombo : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(cancelCapture)

@end

@interface RCT_EXTERN_MODULE (VLTrade, NSObject)

RCT_EXTERN_METHOD(startWatching : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopWatching)

RCT_EXTERN_METHOD(isWatching : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(sendChatCommand : (NSString *)command
                  resolver : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(drainPendingLines : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(consumePendingShowTrades : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(loadHistory : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(saveHistory : (NSString *)json
                  resolver : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearHistory : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

@end

@interface RCT_EXTERN_MODULE (VLClipboard, NSObject)

RCT_EXTERN_METHOD(readText : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isGameRunning : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(triggerGameCopyAndRead : (nonnull NSNumber *)timeoutMs
                  resolver : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject)

@end
