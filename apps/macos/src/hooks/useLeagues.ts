import { useCallback, useEffect, useState } from 'react';
import type { League } from '@vaaluation/shared-types';
import { getTradeClient } from '../services/trade';

export interface LeaguesState {
  leagues: League[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Loads the current trade leagues. Results are cached by the client, so
 * remounting a screen does not re-request them.
 */
export function useLeagues(): LeaguesState {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    getTradeClient()
      .getLeagues()
      .then((result) => {
        setLeagues(result);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Could not load leagues.');
        setLoading(false);
      });
  }, []);

  useEffect(reload, [reload]);

  return { leagues, loading, error, reload };
}

/**
 * The default league is the first non-Standard entry the API returns, which
 * is the current challenge league. Never hard-coded to a league name.
 */
export function defaultLeagueId(leagues: readonly League[]): string | null {
  const permanent = new Set(['Standard', 'Hardcore', 'Ruthless', 'Hardcore Ruthless']);
  const challenge = leagues.find((league) => !permanent.has(league.id));
  return challenge?.id ?? leagues[0]?.id ?? null;
}
