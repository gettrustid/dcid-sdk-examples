#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>
#import <MetaKeep/MetaKeep.h>

@implementation AppDelegate

// MetaKeep SDK callback URL handler
- (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)url
            options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options
{
  // DEBUG: Log all incoming URLs to verify callback is being received
  NSLog(@"[AppDelegate] ========================================");
  NSLog(@"[AppDelegate] openURL called!");
  NSLog(@"[AppDelegate] URL: %@", url.absoluteString);
  NSLog(@"[AppDelegate] Scheme: %@", url.scheme);
  NSLog(@"[AppDelegate] Host: %@", url.host);
  NSLog(@"[AppDelegate] Path: %@", url.path);
  NSLog(@"[AppDelegate] Query: %@", url.query);
  NSLog(@"[AppDelegate] ========================================");

  // CRITICAL: Pass callback URL to MetaKeep SDK to complete pending operations
  NSLog(@"[AppDelegate] Calling MetaKeep resumeUrl...");
  [[MetaKeepMetaKeep companion] resumeUrl:url.absoluteString];
  NSLog(@"[AppDelegate] MetaKeep resumeUrl completed");

  return [RCTLinkingManager application:application openURL:url options:options];
}

// Universal Links handler (for ASWebAuthenticationSession callbacks)
- (BOOL)application:(UIApplication *)application
    continueUserActivity:(NSUserActivity *)userActivity
      restorationHandler:(void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler
{
  NSLog(@"[AppDelegate] ========================================");
  NSLog(@"[AppDelegate] continueUserActivity called!");
  NSLog(@"[AppDelegate] Activity type: %@", userActivity.activityType);

  if ([userActivity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb]) {
    NSURL *url = userActivity.webpageURL;
    NSLog(@"[AppDelegate] Universal Link URL: %@", url.absoluteString);

    // Pass to MetaKeep SDK
    NSLog(@"[AppDelegate] Calling MetaKeep resumeUrl for Universal Link...");
    [[MetaKeepMetaKeep companion] resumeUrl:url.absoluteString];
    NSLog(@"[AppDelegate] MetaKeep resumeUrl completed for Universal Link");
  }
  NSLog(@"[AppDelegate] ========================================");

  return [RCTLinkingManager application:application
                   continueUserActivity:userActivity
                     restorationHandler:restorationHandler];
}

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"DCIDMobile";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
