#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE (FileExport, NSObject)

RCT_EXTERN_METHOD(iCloudSignedIn : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(sweep : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(saveText : (NSString *)filename contents : (NSString *)contents resolver : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)

@end
