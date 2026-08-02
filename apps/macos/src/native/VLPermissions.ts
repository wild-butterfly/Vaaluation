import { NativeModules } from 'react-native';

export type PermissionState = 'granted' | 'denied' | 'notRequired';

export interface PermissionStatus {
  accessibility: PermissionState;
  inputMonitoring: PermissionState;
}

interface VLPermissionsNative {
  getStatus(): Promise<PermissionStatus>;
  requestAccessibility(): Promise<PermissionStatus>;
  openSystemSettings(pane: 'accessibility' | 'inputMonitoring' | 'privacy'): void;
}

const native = NativeModules.VLPermissions as VLPermissionsNative;

export function getPermissionStatus(): Promise<PermissionStatus> {
  return native.getStatus();
}

/**
 * Shows the system Accessibility prompt on first call; afterwards deep-links
 * to System Settings instead of prompting repeatedly.
 */
export function requestAccessibility(): Promise<PermissionStatus> {
  return native.requestAccessibility();
}

export function openSystemSettings(
  pane: 'accessibility' | 'inputMonitoring' | 'privacy',
): void {
  native.openSystemSettings(pane);
}
