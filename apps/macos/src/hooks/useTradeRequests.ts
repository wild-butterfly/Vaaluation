import { useCallback, useEffect, useState } from 'react';
import type { TradeRequest } from '@vaaluation/trade-whispers';
import { describeRequest, parseTradeWhisper } from '@vaaluation/trade-whispers';
import { appendTradeHistory, drainPendingLogLines, onLogLines } from '../native/VLTrade';
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

  // Watching is owned natively and driven by the persisted setting, so this
  // hook only listens. Starting or stopping here would mean whichever window
  // unmounted first silently switched watching off for the other one too.
  useEffect(() => {
    if (!enabled) {
      setWatching(false);
      return;
    }
    setWatching(true);
    setError(null);

    const ingest = (lines: readonly string[]) => {
      const found: TrackedRequest[] = [];
      for (const line of lines) {
        const request = parseTradeWhisper(line);
        if (request === null) continue; // not a trade whisper — discarded
        found.push({
          // Derived from the whisper itself, so the same request arriving
          // twice — live and again from the retained buffer — collapses into
          // one entry instead of appearing duplicated.
          id: `${request.character}:${request.receivedAt}:${describeRequest(request)}`,
          request,
          done: false,
        });
      }
      if (found.length === 0) return;
      setRequests((current) => {
        const seen = new Set(current.map((entry) => entry.id));
        const fresh = found.filter((entry) => !seen.has(entry.id));
        if (fresh.length === 0) return current;
        log('info', 'trade', `${fresh.length} trade whisper(s) received`);
        return [...fresh.reverse(), ...current].slice(0, MAX_REQUESTS);
      });
    };

    // Anything that arrived before this root was ready, first.
    let cancelled = false;
    drainPendingLogLines()
      .then((lines) => {
        if (!cancelled && lines.length > 0) ingest(lines);
      })
      .catch(() => {});

    const unsubscribe = onLogLines(ingest);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [enabled]);

  /**
   * Completing a request records it and takes it off the incoming list.
   * Leaving handled requests in place made the list grow without bound and
   * gave no signal about what still needed attention.
   */
  const markDone = useCallback((id: string) => {
    setRequests((current) => {
      const entry = current.find((candidate) => candidate.id === id);
      if (entry !== undefined) {
        appendTradeHistory({
          id: entry.id,
          request: entry.request,
          completedAt: new Date().toISOString(),
        }).catch(() => {});
      }
      return current.filter((candidate) => candidate.id !== id);
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setRequests((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const clear = useCallback(() => setRequests([]), []);

  return { requests, error, watching, markDone, dismiss, clear };
}
