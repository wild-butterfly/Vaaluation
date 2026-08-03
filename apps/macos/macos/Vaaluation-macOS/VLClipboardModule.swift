import Foundation
import React

@objc(VLClipboard)
final class VLClipboardModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc(readText:rejecter:)
  func readText(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      resolve(ClipboardService.shared.readText())
    }
  }

  @objc(isGameRunning:rejecter:)
  func isGameRunning(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      resolve(GameLocator.isGameRunning)
    }
  }

  @objc(triggerGameCopyAndRead:resolver:rejecter:)
  func triggerGameCopyAndRead(
    _ timeoutMs: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      ClipboardService.shared.triggerGameCopyAndRead(timeoutMs: timeoutMs.intValue) {
        result in
        switch result {
        case .success(let text):
          resolve(text)
        case .failure(let error):
          reject(error.code, error.message, nil)
        }
      }
    }
  }
}
