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
