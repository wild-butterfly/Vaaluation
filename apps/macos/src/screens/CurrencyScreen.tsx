import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { CurrencyRate } from '@vaaluation/trade-client';
import { TRACKED_CURRENCIES } from '@vaaluation/trade-client';
import {
  alpha,
  borders,
  fonts,
  radii,
  spacing,
  surfaces,
  text as palette,
  type as scale,
  useTheme,
} from '@vaaluation/ui';
import type { Theme } from '@vaaluation/ui';
import { useSettings } from '../state/SettingsContext';
import { defaultLeagueId, useLeagues } from '../hooks/useLeagues';
import { getTradeClient } from '../services/trade';

interface RateRow {
  readonly id: string;
  readonly label: string;
  readonly rate: CurrencyRate | null;
  readonly error: string | null;
}

/** Spacing between exchange calls, comfortably inside the observed policy. */
const REQUEST_SPACING_MS = 1100;
const MAX_BACKOFF_MS = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatRate(value: number): string {
  if (value >= 1000) return Math.round(value).toLocaleString();
  if (value >= 10) return value.toFixed(0);
  if (value >= 1) return value.toFixed(1);
  return value.toFixed(2);
}

export function CurrencyScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { settings } = useSettings();
  const { leagues } = useLeagues();
  const league = settings.leagueId ?? defaultLeagueId(leagues);

  const [rows, setRows] = useState<RateRow[]>(
    TRACKED_CURRENCIES.map((entry) => ({ ...entry, rate: null, error: null })),
  );
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    if (league === null || loading) return;
    setLoading(true);
    const client = getTradeClient();

    // The exchange endpoint is metered per IP, and eight back-to-back
    // requests trip it. Each call is spaced out, and a rate-limited response
    // is retried once after the delay the API itself asks for.
    for (const [index, entry] of TRACKED_CURRENCIES.entries()) {
      if (index > 0) await sleep(REQUEST_SPACING_MS);

      let attempt = 0;
      for (;;) {
        try {
          const rate = await client.currencyRate(league, entry.id, 'chaos');
          setRows((current) =>
            current.map((row) =>
              row.id === entry.id ? { ...row, rate, error: null } : row,
            ),
          );
          break;
        } catch (cause: unknown) {
          const retryAfterMs = (cause as { retryAfterMs?: number } | null)?.retryAfterMs;
          if (retryAfterMs !== undefined && attempt === 0) {
            attempt += 1;
            await sleep(Math.min(retryAfterMs + 250, MAX_BACKOFF_MS));
            continue;
          }
          const message = cause instanceof Error ? cause.message : 'Failed';
          setRows((current) =>
            current.map((row) =>
              row.id === entry.id ? { ...row, error: message } : row,
            ),
          );
          break;
        }
      }
    }
    setUpdatedAt(new Date());
    setLoading(false);
  }, [league, loading]);

  // Load once per league. `refresh` is intentionally not a dependency: it
  // changes on every render and would re-fetch in a loop.
  const loadedLeague = useRef<string | null>(null);
  useEffect(() => {
    if (league === null || loadedLeague.current === league) return;
    loadedLeague.current = league;
    void refresh();
  }, [league, refresh]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>Currency</Text>
          <Text style={styles.hint}>
            {league ?? 'No league'}
            {updatedAt !== null ? ` · updated ${updatedAt.toLocaleTimeString()}` : ''}
          </Text>
        </View>
        <Pressable
          style={styles.button}
          onPress={() => void refresh()}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <Text style={styles.buttonText}>Refresh</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.disclaimer}>
        Median asking rate across the cheapest live bulk offers, in Chaos Orbs. The trade
        site publishes what sellers ask, not what items sold for, so treat these as the
        going rate rather than a settled price.
      </Text>

      <View style={styles.card}>
        {rows.map((row, index) => (
          <View key={row.id} style={[styles.row, index > 0 && styles.rowDivided]}>
            <Text style={styles.currency}>{row.label}</Text>
            {row.rate !== null ? (
              <View style={styles.rateBlock}>
                <Text style={styles.rate}>
                  {formatRate(row.rate.median)}
                  <Text style={styles.rateUnit}> chaos</Text>
                </Text>
                <Text style={styles.spread}>
                  {formatRate(row.rate.low)}–{formatRate(row.rate.high)} · n=
                  {row.rate.sampleSize}
                </Text>
              </View>
            ) : row.error !== null ? (
              <Text style={styles.error} numberOfLines={1}>
                {row.error}
              </Text>
            ) : (
              <Text style={styles.pending}>{loading ? '…' : 'no offers'}</Text>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1 },
    content: { padding: spacing.xl },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    headerText: { flex: 1 },
    heading: {
      color: palette.primary,
      fontSize: scale.lg,
      fontWeight: '700',
    },
    hint: {
      color: palette.secondary,
      fontSize: scale.mono,
      marginTop: 2,
    },
    disclaimer: {
      color: palette.secondary,
      fontSize: scale.mono,
      lineHeight: 16,
      marginBottom: spacing.lg,
    },
    card: {
      backgroundColor: surfaces.card,
      borderColor: borders.standard,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    rowDivided: {
      borderTopColor: borders.hairline,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    currency: {
      color: palette.primary,
      fontSize: scale.body,
      flex: 1,
    },
    rateBlock: { alignItems: 'flex-end' },
    rate: {
      color: theme.accentText,
      fontSize: scale.price,
      fontWeight: '700',
    },
    rateUnit: {
      color: palette.secondary,
      fontSize: scale.mono,
      fontWeight: '400',
    },
    spread: {
      color: palette.faint,
      fontSize: scale.mono,
    },
    pending: {
      color: palette.faint,
      fontSize: scale.mono,
    },
    error: {
      color: theme.accentText,
      fontSize: scale.mono,
      maxWidth: 220,
      textAlign: 'right',
    },
    button: {
      backgroundColor: alpha(theme.accent, 0.14),
      borderColor: borders.standard,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      minWidth: 74,
      alignItems: 'center',
    },
    buttonText: {
      fontFamily: fonts.sans,
      fontSize: scale.ui,
      color: theme.accentText,
      fontWeight: '600',
    },
  });
}
