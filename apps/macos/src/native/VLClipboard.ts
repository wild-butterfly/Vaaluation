import { NativeModules } from 'react-native';

export type ClipboardErrorCode =
  'permission_denied' | 'game_not_running' | 'timeout' | 'not_an_item';

interface VLClipboardNative {
  readText(): Promise<string | null>;
  isGameRunning(): Promise<boolean>;
  triggerGameCopyAndRead(timeoutMs: number): Promise<string>;
}

const native = NativeModules.VLClipboard as VLClipboardNative;

export function readClipboardText(): Promise<string | null> {
  return native.readText();
}

export function isGameRunning(): Promise<boolean> {
  return native.isGameRunning();
}

/**
 * Posts the single item-copy keystroke to Path of Exile and resolves with the
 * copied item text. Rejects with a coded error (`ClipboardErrorCode` in
 * `error.code`) when the game isn't running, permission is missing, nothing
 * was copied, or the text is not an item.
 */
export function triggerGameCopyAndRead(timeoutMs = 600): Promise<string> {
  return native.triggerGameCopyAndRead(timeoutMs);
}
