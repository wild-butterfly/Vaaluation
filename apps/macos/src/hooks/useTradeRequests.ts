import { useCallback, useEffect, useState } from 'react';
import type { TradeRequest } from '@vaaluation/trade-whispers';
import { parseTradeWhisper } from '@vaaluation/trade-whispers';
import { onLogLines, startWatchingLog, stopWatchingLog } from '../native/VLTrade';
import { log } from '../native/VLLog';

export interface TrackedRequest {
  readonly id: string;
  readonly request: TradeRequest;
  /** Set once the user marks the trade done; kept briefly for undo clarity. */
  readonly done: boolean;
}

const MAX_REQUESTS = 40;

/**
 * Watches the client log for trade whispers.
 *
 * Only lines the whisper parser recognizes as trade requests are retained;
 * every other line — ordinary conversation included — is dropped immediately
 * and never stored or logged.
 */
export function useTradeRequests(enabled: boolean) {
  const [requests, setRequests] = useState<TrackedRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    if (!enabled) {
      stopWatchingLog();
      setWatching(false);
      return;
    }

    let cancelled = false;
    startWatchingLog()
      .then(() => {
        if (!cancelled) {
          setWatching(true);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setWatching(false);
          setError(
            cause instanceof Error ? cause.message : 'Could not watch the client log.',
          );
        }
      });

    const unsubscribe = onLogLines((lines) => {
      const found: TrackedRequest[] = [];
      for (const line of lines) {
        const request = parseTradeWhisper(line);
        if (request === null) continue; // not a trade whisper — discarded
        found.push({
          id: `${request.character}:${request.receivedAt}:${found.length}`,
          request,
          done: false,
        });
      }
      if (found.length === 0) return;
      log('info', 'trade', `${found.length} trade whisper(s) received`);
      setRequests((current) => [...found.reverse(), ...current].slice(0, MAX_REQUESTS));
    });

    return () => {
      cancelled = true;
      unsubscribe();
      stopWatchingLog();
    };
  }, [enabled]);

  const markDone = useCallback((id: string) => {
    setRequests((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, done: true } : entry)),
    );
  }, []);

  const dismiss = useCallback((id: string) => {
    setRequests((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const clear = useCallback(() => setRequests([]), []);

  return { requests, error, watching, markDone, dismiss, clear };
}
