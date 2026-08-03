import { useCallback, useEffect, useRef, useState } from 'react';
import type { TradeRequest } from '@vaaluation/trade-whispers';
import { clearTradeHistory, loadTradeHistory, saveTradeHistory } from '../native/VLTrade';

export interface HistoryEntry {
  readonly id: string;
  readonly request: TradeRequest;
  /** When the user marked the trade handled. */
  readonly completedAt: string;
}

const MAX_HISTORY = 300;

/**
 * Trade history, persisted locally.
 *
 * Only requests the user explicitly marked done are recorded — the app does
 * not keep a record of every whisper received, and nothing leaves the machine.
 */
export function useTradeHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadTradeHistory()
      .then((json) => {
        if (cancelled) return;
        if (json !== null && json !== '') {
          try {
            const parsed: unknown = JSON.parse(json);
            if (Array.isArray(parsed)) setEntries(parsed as HistoryEntry[]);
          } catch {
            // A corrupt file should not break the screen; start fresh.
          }
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist after changes, never on the initial load.
  useEffect(() => {
    if (!loaded || !dirty.current) return;
    saveTradeHistory(JSON.stringify(entries)).catch(() => {});
  }, [entries, loaded]);

  const record = useCallback((request: TradeRequest) => {
    dirty.current = true;
    setEntries((current) => {
      const entry: HistoryEntry = {
        id: `${request.character}:${request.receivedAt}`,
        request,
        completedAt: new Date().toISOString(),
      };
      if (current.some((existing) => existing.id === entry.id)) return current;
      return [entry, ...current].slice(0, MAX_HISTORY);
    });
  }, []);

  const clear = useCallback(() => {
    dirty.current = true;
    setEntries([]);
    clearTradeHistory().catch(() => {});
  }, []);

  return { entries, loaded, record, clear };
}
