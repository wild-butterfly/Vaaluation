import { NativeEventEmitter, NativeModules } from 'react-native';

interface VLTradeNative {
  startWatching(): Promise<string | null>;
  stopWatching(): void;
  isWatching(): Promise<boolean>;
  sendChatCommand(command: string): Promise<void>;
  loadHistory(): Promise<string | null>;
  saveHistory(json: string): Promise<void>;
  clearHistory(): Promise<void>;
}

const native = NativeModules.VLTrade as VLTradeNative;
const emitter = new NativeEventEmitter(NativeModules.VLEvents);

/** Begins tailing the client log. Resolves with the log path in use. */
export function startWatchingLog(): Promise<string | null> {
  return native.startWatching();
}

export function stopWatchingLog(): void {
  native.stopWatching();
}

export function isWatchingLog(): Promise<boolean> {
  return native.isWatching();
}

/**
 * Sends exactly one chat command. Call this only from a direct user action —
 * one button press, one command.
 */
export function sendChatCommand(command: string): Promise<void> {
  return native.sendChatCommand(command);
}

/** Trade history, persisted locally and never uploaded. */
export function loadTradeHistory(): Promise<string | null> {
  return native.loadHistory();
}

export function saveTradeHistory(json: string): Promise<void> {
  return native.saveHistory(json);
}

export function clearTradeHistory(): Promise<void> {
  return native.clearHistory();
}

/** Raw appended log lines. Callers must discard anything not a trade whisper. */
export function onLogLines(handler: (lines: string[]) => void): () => void {
  const subscription = emitter.addListener('vl:log-lines', (payload: unknown) => {
    const lines = (payload as { lines?: unknown } | null)?.lines;
    if (Array.isArray(lines)) {
      handler(lines.filter((line): line is string => typeof line === 'string'));
    }
  });
  return () => subscription.remove();
}
