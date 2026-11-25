#import <Foundation/Foundation.h>
static inline BOOL tryBlock(void (^NS_NOESCAPE block)(void), NSException * __autoreleasing *outException) {
  @try { block(); return YES; } @catch (NSException *e) { if (outException) *outException = e; return NO; }
}
