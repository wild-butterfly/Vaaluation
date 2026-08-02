import { NativeModules } from 'react-native';
import type { HotkeyAction, KeyCombo } from '@vaaluation/shared-types';

export interface HotkeyError {
  code: 'no_modifier' | 'system_conflict' | 'internal_conflict';
  message: string;
}

export type HotkeyErrors = Partial<Record<HotkeyAction, HotkeyError>>;

interface VLHotkeysNative {
  applyFromSettings(): Promise<HotkeyErrors>;
  getRegistrations(): Promise<Partial<Record<HotkeyAction, KeyCombo>>>;
  captureNextKeyCombo(): Promise<KeyCombo | null>;
  cancelCapture(): void;
}

const native = NativeModules.VLHotkeys as VLHotkeysNative;

/**
 * Re-syncs native hotkey registrations with the persisted settings. Returns
 * per-action errors (conflicts, missing modifier) for the UI to surface.
 */
export function applyHotkeysFromSettings(): Promise<HotkeyErrors> {
  return native.applyFromSettings();
}

export function getHotkeyRegistrations(): Promise<
  Partial<Record<HotkeyAction, KeyCombo>>
> {
  return native.getRegistrations();
}

/**
 * Records the next key press inside Vaaluation (Escape cancels → null).
 * Never observes keystrokes in other applications.
 */
export function captureNextKeyCombo(): Promise<KeyCombo | null> {
  return native.captureNextKeyCombo();
}

export function cancelCapture(): void {
  native.cancelCapture();
}
