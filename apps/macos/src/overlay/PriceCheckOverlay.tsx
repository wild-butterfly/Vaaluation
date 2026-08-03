import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { parseItemText } from '@vaaluation/item-parser';
import type { ParsedItem } from '@vaaluation/shared-types';
import type {
  PriceDistribution,
  PriceWarning,
  PricedListing,
  SelectableFilter,
} from '@vaaluation/trade-client';
import {
  buildFilters,
  buildQuery,
  detectPriceWarnings,
  distribution,
  toPricedListings,
  tradeSearchUrl,
} from '@vaaluation/trade-client';
import {
  alpha,
  borders,
  fonts,
  radii,
  semantic,
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
import { onItemCopied } from '../native/VLEvents';

type SearchState =
  | { status: 'idle' }
  | { status: 'searching' }
  | {
      status: 'done';
      total: number;
      queryId: string;
      listings: PricedListing[];
      spread: PriceDistribution | null;
      warnings: PriceWarning[];
    }
  | { status: 'error'; message: string };

function round(value: number): string {
  if (value >= 100) return String(Math.round(value));
  if (value >= 10) return value.toFixed(0);
  return value.toFixed(1);
}

function nameOf(item: ParsedItem): string {
  return item.kind === 'equipment' || item.kind === 'map' ? item.name : item.name;
}

function subtitleOf(item: ParsedItem): string {
  const parts: string[] = [];
  switch (item.kind) {
    case 'equipment':
      if (item.name !== item.baseType) parts.push(item.baseType);
      if (item.itemLevel !== undefined) parts.push(`iLvl ${item.itemLevel}`);
      break;
    case 'map':
      parts.push(item.baseType);
      if (item.mapTier !== undefined) parts.push(`T${item.mapTier}`);
      break;
    case 'gem':
      parts.push(`Level ${item.level}`, `${item.quality}%`);
      break;
    default:
      parts.push(item.itemClass);
  }
  return parts.join(' · ');
}

export function PriceCheckOverlay() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { settings, update } = useSettings();
  const { leagues } = useLeagues();
  const [item, setItem] = useState<ParsedItem | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SelectableFilter[]>([]);
  const [state, setState] = useState<SearchState>({ status: 'idle' });

  const league = settings.leagueId ?? defaultLeagueId(leagues);

  useEffect(() => {
    if (settings.leagueId === null && leagues.length > 0) {
      const fallback = defaultLeagueId(leagues);
      if (fallback !== null) update({ leagueId: fallback });
    }
  }, [leagues, settings.leagueId, update]);

  useEffect(
    () =>
      onItemCopied(({ text }) => {
        const parsed = parseItemText(text);
        setState({ status: 'idle' });
        if (parsed.ok) {
          setItem(parsed.item);
          setParseError(null);
        } else {
          setItem(null);
          setParseError(parsed.message);
        }
      }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    if (item === null) {
      setFilters([]);
      return;
    }
    getTradeClient()
      .getStatIndex()
      .then((stats) => {
        if (!cancelled) setFilters(buildFilters(item, stats));
      })
      .catch(() => {
        if (!cancelled) setFilters([]);
      });
    return () => {
      cancelled = true;
    };
  }, [item]);

  const runSearch = useCallback(async () => {
    if (item === null || league === null) return;
    setState({ status: 'searching' });
    try {
      const client = getTradeClient();
      const baseTypes = await client.getBaseTypeIndex();
      const search = await client.search(
        league,
        buildQuery(item, filters, { baseTypes }),
      );
      // Two pages: ten listings is too few for the histogram to show a shape.
      const first = await client.fetchListings(search.result.slice(0, 10), search.id);
      const second =
        search.result.length > 10
          ? await client.fetchListings(search.result.slice(10, 20), search.id)
          : [];
      const listings = toPricedListings([...first, ...second]);
      setState({
        status: 'done',
        total: search.total,
        queryId: search.id,
        listings,
        spread: distribution(listings),
        warnings: detectPriceWarnings(listings),
      });
    } catch (cause: unknown) {
      setState({
        status: 'error',
        message: cause instanceof Error ? cause.message : 'Search failed.',
      });
    }
  }, [item, league, filters]);

  const setBound = (key: string, bound: 'min' | 'max', raw: string) => {
    const value = raw.trim() === '' ? null : Number(raw);
    if (value !== null && Number.isNaN(value)) return;
    setFilters((current) =>
      current.map((f) => (f.key === key ? { ...f, [bound]: value } : f)),
    );
  };

  const spread = state.status === 'done' ? state.spread : null;
  const maxBucket = spread ? Math.max(...spread.buckets, 1) : 1;
  const unit = spread?.currency.charAt(0) ?? '';

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item === null ? 'Vaaluation' : nameOf(item)}
          </Text>
          {item !== null ? (
            <Text style={styles.itemMeta} numberOfLines={1}>
              {subtitleOf(item)}
            </Text>
          ) : null}
        </View>
        {spread !== null ? (
          <View style={styles.priceBlock}>
            <Text style={styles.price}>
              {round(spread.median)}
              <Text style={styles.priceUnit}> {spread.currency}</Text>
            </Text>
            <Text style={styles.priceMeta}>
              median · {state.status === 'done' ? state.total : 0} live listings
            </Text>
          </View>
        ) : null}
      </View>

      {spread !== null ? (
        <View style={styles.histogram}>
          <View style={styles.bars}>
            {spread.buckets.map((count, index) => (
              <View
                key={index}
                style={[
                  styles.bar,
                  {
                    height: Math.max(2, (count / maxBucket) * 52),
                    backgroundColor:
                      index === spread.medianBucket
                        ? theme.accent
                        : alpha(theme.accent, 0.28),
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.scale}>
            <Text style={styles.scaleEnd}>
              {round(spread.min)}
              {unit}
            </Text>
            <Text style={styles.scaleMedian}>
              {round(spread.median)}
              {unit} median
            </Text>
            <Text style={styles.scaleEnd}>
              {round(spread.max)}
              {unit}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.divider} />

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {item === null ? (
          <Text style={styles.empty}>
            {parseError ?? 'Hover an item in Path of Exile and press Ctrl+D.'}
          </Text>
        ) : (
          <View style={styles.mods}>
            {filters.map((filter) => (
              <View key={filter.key} style={styles.modRow}>
                <Pressable
                  style={styles.modHit}
                  onPress={() =>
                    setFilters((current) =>
                      current.map((f) =>
                        f.key === filter.key ? { ...f, selected: !f.selected } : f,
                      ),
                    )
                  }
                >
                  <View style={[styles.checkbox, filter.selected && styles.checkboxOn]} />
                  <Text
                    style={[styles.modText, !filter.selected && styles.modTextOff]}
                    numberOfLines={1}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
                <TextInput
                  style={styles.input}
                  value={filter.min === null ? '' : String(filter.min)}
                  onChangeText={(raw) => setBound(filter.key, 'min', raw)}
                  placeholder="min"
                  placeholderTextColor={palette.faint}
                />
                <TextInput
                  style={[styles.input, styles.inputDim]}
                  value={filter.max === null ? '' : String(filter.max)}
                  onChangeText={(raw) => setBound(filter.key, 'max', raw)}
                  placeholder="max"
                  placeholderTextColor={palette.faint}
                />
              </View>
            ))}

            {state.status === 'error' ? (
              <Text style={styles.error}>{state.message}</Text>
            ) : null}

            {state.status === 'done'
              ? state.warnings.map((warning, index) => (
                  <Text key={index} style={styles.warning}>
                    {warning.message}
                  </Text>
                ))
              : null}

            {state.status === 'done' && state.listings.length === 0 ? (
              <Text style={styles.empty}>
                No priced listings matched. Try deselecting a modifier.
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.search, item === null && styles.disabled]}
          onPress={() => {
            void runSearch();
          }}
          disabled={item === null || state.status === 'searching'}
        >
          {state.status === 'searching' ? (
            <ActivityIndicator size="small" color={theme.actionText} />
          ) : (
            <Text style={styles.searchText}>Search</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.ghost, state.status !== 'done' && styles.disabled]}
          onPress={() => {
            if (state.status === 'done' && league !== null) {
              void Linking.openURL(tradeSearchUrl(league, state.queryId));
            }
          }}
          disabled={state.status !== 'done'}
        >
          <Text style={styles.ghostText}>Trade site</Text>
        </Pressable>
        <Text style={styles.hint}>esc to close · ⌥ to pin</Text>
      </View>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    panel: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.h3,
      paddingTop: spacing.h2,
      paddingBottom: spacing.xxl,
      gap: spacing.xl,
    },
    headerText: { flex: 1 },
    itemName: {
      fontFamily: fonts.sans,
      fontSize: scale.xl,
      fontWeight: '600',
      color: theme.accentText,
      letterSpacing: -0.2,
    },
    itemMeta: {
      fontFamily: fonts.sans,
      fontSize: scale.body,
      color: palette.secondary,
      marginTop: 3,
    },
    priceBlock: { alignItems: 'flex-end' },
    price: {
      fontFamily: fonts.mono,
      fontSize: scale.display,
      fontWeight: '600',
      color: palette.primary,
    },
    priceUnit: {
      fontFamily: fonts.sans,
      fontSize: scale.body,
      fontWeight: '400',
      color: palette.muted,
    },
    priceMeta: {
      fontFamily: fonts.mono,
      fontSize: scale.tiny,
      color: semantic.up,
      marginTop: 2,
    },
    histogram: { paddingHorizontal: spacing.h3, paddingBottom: spacing.h1 },
    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 52 },
    bar: { flex: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
    scale: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
    },
    scaleEnd: { fontFamily: fonts.mono, fontSize: scale.tiny, color: palette.dim },
    scaleMedian: { fontFamily: fonts.mono, fontSize: scale.tiny, color: theme.accent },
    divider: { height: 1, backgroundColor: borders.standard },
    body: { flex: 1 },
    mods: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    empty: {
      fontFamily: fonts.sans,
      fontSize: scale.ui,
      color: palette.secondary,
      padding: spacing.h1,
      lineHeight: 19,
    },
    modRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingVertical: 9,
      borderRadius: radii.button,
    },
    modHit: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
    checkbox: {
      width: 15,
      height: 15,
      borderRadius: radii.tag,
      borderWidth: 1,
      borderColor: borders.checkbox,
    },
    checkboxOn: { backgroundColor: theme.accent, borderColor: theme.accent },
    modText: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: scale.bodyTight,
      color: palette.body,
    },
    modTextOff: { color: '#a4a6ad' },
    input: {
      width: 52,
      borderRadius: radii.input,
      borderWidth: 1,
      borderColor: borders.input,
      backgroundColor: surfaces.sunkenStrong,
      color: palette.primary,
      fontFamily: fonts.mono,
      fontSize: scale.mono,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      textAlign: 'center',
    },
    inputDim: { backgroundColor: surfaces.sunken, borderColor: borders.inputDim },
    error: {
      fontFamily: fonts.sans,
      fontSize: scale.caption,
      color: semantic.down,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
    },
    warning: {
      fontFamily: fonts.sans,
      fontSize: scale.caption,
      color: theme.accent,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.sm,
      lineHeight: 16,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      paddingHorizontal: spacing.h1,
      paddingVertical: spacing.xl,
      borderTopWidth: 1,
      borderTopColor: borders.standard,
      backgroundColor: surfaces.sunken,
    },
    search: {
      backgroundColor: theme.action,
      borderRadius: radii.button,
      paddingHorizontal: spacing.h3,
      paddingVertical: 9,
      minWidth: 84,
      alignItems: 'center',
    },
    searchText: {
      fontFamily: fonts.sans,
      fontSize: scale.bodyTight,
      fontWeight: '600',
      color: theme.actionText,
    },
    ghost: {
      borderWidth: 1,
      borderColor: borders.stronger,
      borderRadius: radii.button,
      paddingHorizontal: spacing.h1,
      paddingVertical: 9,
    },
    ghostText: { fontFamily: fonts.sans, fontSize: scale.bodyTight, color: '#c9c7c1' },
    disabled: { opacity: 0.45 },
    hint: {
      marginLeft: 'auto',
      fontFamily: fonts.mono,
      fontSize: scale.tiny,
      color: palette.faint,
    },
  });
}
