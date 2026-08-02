import Foundation
import AppKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

/// Owns the single React Native instance for the whole app. Windows ask it
/// for root views by module name; all views share one bridge.
final class ReactHost: RCTDefaultReactNativeFactoryDelegate {
  private var factory: RCTReactNativeFactory!

  override init() {
    super.init()
    dependencyProvider = RCTAppDependencyProvider()
    factory = RCTReactNativeFactory(delegate: self)
  }

  // NSResponder conformance; never used.
  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  func makeRootView(moduleName: String, initialProps: [String: Any]) -> NSView {
    return factory.rootViewFactory.view(
      withModuleName: moduleName,
      initialProperties: initialProps
    )
  }

  // MARK: - RCTReactNativeFactoryDelegate

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    bundleURL()
  }

  override func bundleURL() -> URL? {
    #if DEBUG
      return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    #else
      return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    #endif
  }
}
