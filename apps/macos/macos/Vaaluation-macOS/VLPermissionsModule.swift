import Foundation
import React

@objc(VLPermissions)
final class VLPermissionsModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc(getStatus:rejecter:)
  func getStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      resolve(PermissionService.statusDictionary())
    }
  }

  @objc(requestAccessibility:rejecter:)
  func requestAccessibility(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      PermissionService.requestAccessibility()
      resolve(PermissionService.statusDictionary())
    }
  }

  @objc(openSystemSettings:)
  func openSystemSettings(_ pane: String) {
    DispatchQueue.main.async {
      PermissionService.openSystemSettings(pane: pane)
    }
  }
}
