import Foundation
import React

@objc(VLLog)
final class VLLogModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }

  private let allowedLevels: Set<String> = ["debug", "info", "warn", "error"]

  @objc(log:scope:message:)
  func log(_ level: String, scope: String, message: String) {
    let safeLevel = allowedLevels.contains(level) ? level : "info"
    LogStore.shared.append(level: safeLevel, scope: scope, message: message)
  }

  @objc(getRecent:resolver:rejecter:)
  func getRecent(
    _ limit: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    resolve(LogStore.shared.recent(limit: limit.intValue))
  }

  @objc(clear:rejecter:)
  func clear(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    LogStore.shared.clear()
    resolve(nil)
  }

  @objc(getLogFilePath:rejecter:)
  func getLogFilePath(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    resolve(LogStore.shared.logFilePath)
  }
}
