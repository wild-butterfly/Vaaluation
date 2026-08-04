import { NativeEventEmitter, NativeModules } from 'react-native';

interface VLTradeNative {
  startWatching(): Promise<string | null>;
  stopWatching(): void;
  isWatching(): Promise<boolean>;
  sendChatCommand(command: string): Promise<void>;
  simulateWhisper(line: string): Promise<void>;
  drainPendingLines(): Promise<string[]>;
  consumePendingShowTrades(): Promise<boolean>;
  loadHistory(): Promise<string | null>;
  saveHistory(json: string): Promise<void>;
  appendHistory(json: string): Promise<void>;
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

/**
 * Injects a synthetic whisper through the same path a real one takes, for
 * testing without a second player. Writes nothing to the game's log.
 */
export function simulateWhisper(line: string): Promise<void> {
  return native.simulateWhisper(line);
}

/**
 * Log lines that arrived before this React root was listening. Draining is
 * explicit so delivery does not depend on subscription timing.
 */
export function drainPendingLogLines(): Promise<string[]> {
  return native.drainPendingLines();
}

/** Whether a buy request asked for the Trades view while it was not mounted. */
export function consumePendingShowTrades(): Promise<boolean> {
  return native.consumePendingShowTrades();
}

/** Trade history, persisted locally and never uploaded. */
export function loadTradeHistory(): Promise<string | null> {
  return native.loadHistory();
}

export function saveTradeHistory(json: string): Promise<void> {
  return native.saveHistory(json);
}

/** Records one completed request. Ignored if already recorded. */
export function appendTradeHistory(entry: unknown): Promise<void> {
  return native.appendHistory(JSON.stringify(entry));
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
