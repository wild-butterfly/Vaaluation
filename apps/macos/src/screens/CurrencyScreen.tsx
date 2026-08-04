import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { CurrencyRate } from '@vaaluation/trade-client';
import {
  DENOMINATIONS,
  TRACKED_CURRENCIES,
  convertRate,
  currencyBatches,
} from '@vaaluation/trade-client';
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

/** Below this many sampled offers, the median is worth a caveat. */
const THIN_SAMPLE = 8;

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

  const [denomination, setDenomination] = useState('chaos');
  const [pickerOpen, setPickerOpen] = useState(false);
  /**
   * Icon URLs from GGG's own static catalogue. The art is theirs, so it is
   * loaded from their CDN rather than bundled with the app.
   */
  const [icons, setIcons] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    getTradeClient()
      .getCurrencyIcons()
      .then((loaded) => {
        if (!cancelled) setIcons(loaded);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const [rows, setRows] = useState<RateRow[]>(
    TRACKED_CURRENCIES.filter((entry) => entry.id !== 'chaos').map((entry) => ({
      ...entry,
      rate: null,
      error: null,
    })),
  );

  const denominationLabel =
    DENOMINATIONS.find((entry) => entry.id === denomination)?.short ?? 'Chaos';

  /** Chaos-denominated measurements, kept so denominations can be derived. */
  const chaosRates = useRef<Map<string, CurrencyRate | null>>(new Map());

  // Pricing a currency in itself is meaningless, so it drops out of the list.
  const shown = useMemo(() => {
    const divisor = chaosRates.current.get(denomination) ?? null;
    return rows
      .filter((row) => row.id !== denomination)
      .map((row) => ({
        ...row,
        rate: row.rate === null ? null : convertRate(row.rate, divisor, denomination),
      }));
  }, [rows, denomination]);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    if (league === null || loading) return;
    setLoading(true);
    const client = getTradeClient();

    setRows(TRACKED_CURRENCIES.map((entry) => ({ ...entry, rate: null, error: null })));

    // Everything is measured against chaos exactly once. Other denominations
    // are derived from those numbers, so switching costs no requests against
    // a tightly metered endpoint and thin pairs still resolve.
    //
    // Currencies go up in value-banded batches rather than one at a time: the
    // endpoint prices several currencies per request, which is what keeps a
    // list this long inside the 5-per-15s budget. The client still paces
    // itself from the API's own headers, waiting rather than failing a batch.
    const measured = new Map<string, CurrencyRate | null>();
    for (const batch of currencyBatches()) {
      try {
        const rates = await client.currencyRates(league, batch, 'chaos', {
          waitForCapacity: true,
        });
        for (const id of batch) measured.set(id, rates.get(id) ?? null);
        setRows((current) =>
          current.map((row) =>
            batch.includes(row.id)
              ? { ...row, rate: rates.get(row.id) ?? null, error: null }
              : row,
          ),
        );
      } catch (cause: unknown) {
        const message = cause instanceof Error ? cause.message : 'Failed';
        setRows((current) =>
          current.map((row) =>
            batch.includes(row.id) ? { ...row, error: message } : row,
          ),
        );
      }
    }
    chaosRates.current = measured;
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
        <View style={styles.selectWrap}>
          <Pressable
            style={[styles.select, pickerOpen && styles.selectOpen]}
            onPress={() => setPickerOpen((open) => !open)}
          >
            <Text style={styles.selectText}>{denominationLabel}</Text>
            <Text style={styles.caret}>▾</Text>
          </Pressable>
          {pickerOpen ? (
            <View style={styles.menu}>
              {DENOMINATIONS.map((entry) => {
                const active = denomination === entry.id;
                return (
                  <Pressable
                    key={entry.id}
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => {
                      setDenomination(entry.id);
                      setPickerOpen(false);
                    }}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {entry.short}
                    </Text>
                    {active ? <Text style={styles.tick}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
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
        Median of the cheapest live bulk offers — what sellers are asking, not what items
        sold for. A wide range or a low offer count means the median is soft.
      </Text>

      <View style={styles.columns}>
        <Text style={[styles.columnLabel, styles.columnName]}>Currency</Text>
        <Text style={[styles.columnLabel, styles.columnRate]}>Rate</Text>
      </View>

      {shown.map((row) => (
        <View key={row.id} style={styles.row}>
          {icons.get(row.id) !== undefined ? (
            <Image
              style={styles.icon}
              source={{ uri: icons.get(row.id) as string }}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.icon} />
          )}
          <Text style={styles.currency} numberOfLines={1}>
            {row.label}
          </Text>

          {row.rate !== null ? (
            <View style={styles.rateBlock}>
              <Text style={styles.rate}>
                {formatRate(row.rate.median)}
                <Text style={styles.rateUnit}> {denomination}</Text>
              </Text>
              {/* Only surfaced when the sample is too thin to trust. A bare
                  number from a handful of offers overstates its own
                  confidence, and that is worth one quiet line. */}
              {row.rate.sampleSize < THIN_SAMPLE ? (
                <Text style={styles.thin}>from {row.rate.sampleSize} offers</Text>
              ) : null}
            </View>
          ) : row.error !== null ? (
            <Text style={styles.rowError} numberOfLines={1}>
              {row.error}
            </Text>
          ) : (
            <Text style={styles.pendingRate}>{loading ? '—' : 'no offers'}</Text>
          )}
        </View>
      ))}
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
      zIndex: 10,
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
    columns: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      gap: spacing.xl,
    },
    columnLabel: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: palette.dim,
    },
    // Matches the row layout below so headers sit over their own values.
    columnName: { flex: 1, marginLeft: 30 + spacing.xl },
    columnRate: { textAlign: 'right' },
    icon: {
      width: 30,
      height: 30,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xl,
      backgroundColor: surfaces.card,
      borderWidth: 1,
      borderColor: surfaces.cardBorder,
      borderTopColor: borders.rimLight,
      borderRadius: radii.card,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      marginBottom: 5,
    },
    currency: {
      color: '#e8ded8',
      fontFamily: fonts.sans,
      fontSize: 13.5,
      flex: 1,
    },
    rateBlock: { alignItems: 'flex-end' },
    rate: {
      fontFamily: fonts.mono,
      color: palette.primary,
      fontSize: scale.price,
      fontWeight: '600',
      textAlign: 'right',
    },
    thin: {
      fontFamily: fonts.mono,
      color: palette.dim,
      fontSize: scale.label,
      textAlign: 'right',
      marginTop: 1,
    },
    pendingRate: {
      fontFamily: fonts.mono,
      color: palette.dim,
      fontSize: scale.mono,
      textAlign: 'right',
    },
    rateUnit: {
      color: palette.secondary,
      fontSize: scale.mono,
      fontWeight: '400',
    },

    rowError: {
      fontFamily: fonts.mono,
      color: theme.accentText,
      fontSize: scale.mono,
      textAlign: 'right',
      flexShrink: 1,
    },
    selectWrap: { marginRight: spacing.md, zIndex: 10 },
    select: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radii.keycap,
      borderWidth: 1,
      borderColor: borders.strong,
      paddingHorizontal: spacing.xl,
      paddingVertical: 7,
    },
    selectOpen: { borderColor: alpha(theme.accent, 0.45) },
    selectText: { fontFamily: fonts.sans, fontSize: scale.small, color: '#c9c7c1' },
    caret: { fontFamily: fonts.mono, fontSize: scale.label, color: palette.dim },
    menu: {
      position: 'absolute',
      top: 34,
      right: 0,
      minWidth: 132,
      backgroundColor: surfaces.card,
      borderRadius: radii.field,
      borderWidth: 1,
      borderColor: borders.strong,
      paddingVertical: spacing.xs,
      shadowColor: '#000',
      shadowOpacity: 0.6,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.xl,
      paddingHorizontal: spacing.xl,
      paddingVertical: 7,
    },
    optionActive: { backgroundColor: alpha(theme.accent, 0.12) },
    optionText: { fontFamily: fonts.sans, fontSize: scale.small, color: palette.body },
    optionTextActive: { color: theme.accentText, fontWeight: '600' },
    tick: { fontFamily: fonts.mono, fontSize: scale.label, color: theme.accent },
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
