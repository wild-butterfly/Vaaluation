import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { colors, glass, radii, spacing, typography } from '@vaaluation/ui';
import { useSettings } from '../state/SettingsContext';
import { defaultLeagueId, useLeagues } from '../hooks/useLeagues';
import { getTradeClient } from '../services/trade';

interface RateRow {
  readonly id: string;
  readonly label: string;
  readonly rate: CurrencyRate | null;
  readonly error: string | null;
}

function formatRate(value: number): string {
  if (value >= 1000) return Math.round(value).toLocaleString();
  if (value >= 10) return value.toFixed(0);
  if (value >= 1) return value.toFixed(1);
  return value.toFixed(2);
}

export function CurrencyScreen() {
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

    // Requests go one at a time: the exchange endpoint is rate limited, and a
    // burst of parallel calls is exactly what gets an IP restricted.
    for (const entry of TRACKED_CURRENCIES) {
      try {
        const rate = await client.currencyRate(league, entry.id, 'chaos');
        setRows((current) =>
          current.map((row) =>
            row.id === entry.id ? { ...row, rate, error: null } : row,
          ),
        );
      } catch (cause: unknown) {
        const message = cause instanceof Error ? cause.message : 'Failed';
        setRows((current) =>
          current.map((row) => (row.id === entry.id ? { ...row, error: message } : row)),
        );
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
            <ActivityIndicator size="small" color={colors.textPrimary} />
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

const styles = StyleSheet.create({
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
    color: colors.textPrimary,
    fontSize: typography.sizeHeading,
    fontWeight: '700',
  },
  hint: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    marginTop: 2,
  },
  disclaimer: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    lineHeight: 16,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: glass.surface,
    borderColor: glass.border,
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
    borderTopColor: glass.hairline,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  currency: {
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
    flex: 1,
  },
  rateBlock: { alignItems: 'flex-end' },
  rate: {
    color: colors.goldBright,
    fontSize: typography.sizeTitle,
    fontWeight: '700',
  },
  rateUnit: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    fontWeight: '400',
  },
  spread: {
    color: colors.textDisabled,
    fontSize: typography.sizeCaption,
  },
  pending: {
    color: colors.textDisabled,
    fontSize: typography.sizeCaption,
  },
  error: {
    color: colors.warning,
    fontSize: typography.sizeCaption,
    maxWidth: 220,
    textAlign: 'right',
  },
  button: {
    backgroundColor: glass.fill,
    borderColor: glass.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minWidth: 74,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
  },
});
