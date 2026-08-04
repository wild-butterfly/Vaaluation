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
  cheapestFirst,
  detectPriceWarnings,
  distribution,
  formatAmount,
  listingAge,
  quoteAlternatives,
  toPricedListings,
  tradeSearchUrl,
} from '@vaaluation/trade-client';
import {
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

const round = formatAmount;

/**
 * Currencies a price is worth restating in, and how often those rates are
 * refreshed. Kept to two so the extra line stays a glance, and so the lookup
 * costs one batched exchange request rather than one per currency.
 */
const QUOTE_CURRENCIES = ['divine', 'exalted'] as const;

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

export function PriceCheckOverlay({
  onContentHeight,
}: {
  onContentHeight: (height: number) => void;
}) {
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
  const unit = spread?.currency.charAt(0) ?? '';
  /**
   * The listings themselves, cheapest first. A histogram of ten listings was
   * mostly empty buckets; the prices, who is asking them and how stale each
   * one is answer the question the histogram was gesturing at.
   */
  const rows = useMemo(
    () =>
      state.status === 'done' && spread !== null
        ? cheapestFirst(state.listings, spread.currency)
        : [],
    [state, spread],
  );

  /**
   * Chaos value of the larger currencies, so a big price can be restated in
   * them. The client caches exchange results for five minutes, so repeated
   * price checks do not each spend a request; if the lookup fails the line is
   * simply absent, since it is a convenience rather than the answer.
   */
  const [chaosRates, setChaosRates] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (league === null || spread === null || spread.currency !== 'chaos') return;
    let cancelled = false;
    getTradeClient()
      .currencyRates(league, QUOTE_CURRENCIES, 'chaos')
      .then((rates) => {
        if (cancelled) return;
        setChaosRates(
          new Map([...rates].map(([currency, rate]) => [currency, rate.median])),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [league, spread]);

  const alternatives = useMemo(
    () =>
      spread !== null && spread.currency === 'chaos'
        ? quoteAlternatives(spread.median, chaosRates)
        : [],
    [spread, chaosRates],
  );

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        {/* Crimson bloom behind the numeral — the panel's one piece of glow. */}
        <View style={styles.bloom} pointerEvents="none" />
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
            {alternatives.length > 0 ? (
              <Text style={styles.priceAlt} numberOfLines={1}>
                {alternatives
                  .map((quote) => `${round(quote.amount)} ${quote.currency}`)
                  .join(' · ')}
              </Text>
            ) : null}
            <Text style={styles.priceMeta}>
              median · {state.status === 'done' ? state.total : 0} live listings
            </Text>
          </View>
        ) : null}
      </View>

      {rows.length > 0 ? (
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.headCell, styles.colPrice]}>Price</Text>
            <Text style={[styles.headCell, styles.colIlvl]}>iLvl</Text>
            <Text style={[styles.headCell, styles.colAccount]}>Account</Text>
            <Text style={[styles.headCell, styles.colAge]}>Listed</Text>
          </View>
          <ScrollView style={styles.tableBody} nestedScrollEnabled>
            {rows.map((listing) => (
              <View key={listing.id} style={styles.tableRow}>
                <Text style={[styles.cellPrice, styles.colPrice]} numberOfLines={1}>
                  {round(listing.amount)}
                  <Text style={styles.cellUnit}>{unit}</Text>
                </Text>
                <Text style={[styles.cell, styles.colIlvl]}>{listing.ilvl ?? '—'}</Text>
                <View style={[styles.colAccount, styles.accountCell]}>
                  {/* Presence decides whether a whisper gets answered, so it
                      earns a place next to the name rather than a legend. */}
                  <View
                    style={[
                      styles.presence,
                      listing.presence === 'online'
                        ? styles.presenceOnline
                        : listing.presence === 'afk'
                          ? styles.presenceAfk
                          : styles.presenceOffline,
                    ]}
                  />
                  <Text style={styles.cell} numberOfLines={1}>
                    {listing.accountName}
                  </Text>
                </View>
                <Text style={[styles.cellAge, styles.colAge]}>
                  {listingAge(listing.indexed)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.divider} />

      <ScrollView
        style={styles.body}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={(_width, height) =>
          // The header and histogram sit above the scroll area, so the panel
          // needs room for them on top of whatever the mod list measures.
          onContentHeight(height + (spread === null ? 90 : 210))
        }
      >
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
        <Text style={styles.hint}>esc · ⌥ pin</Text>
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
      paddingHorizontal: spacing.h1,
      paddingTop: spacing.h2,
      paddingBottom: spacing.xxl,
      gap: spacing.xl,
      position: 'relative',
      overflow: 'hidden',
    },
    bloom: {
      position: 'absolute',
      top: -46,
      right: -30,
      width: 190,
      height: 150,
      borderRadius: 95,
      backgroundColor: 'rgba(207,31,45,0.16)',
    },
    headerText: { flex: 1 },
    itemName: {
      fontFamily: fonts.sans,
      fontSize: 19,
      fontWeight: '600',
      color: palette.primary,
      letterSpacing: -0.2,
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 8,
    },
    itemMeta: {
      fontFamily: fonts.sans,
      fontSize: 12.5,
      color: palette.secondary,
      marginTop: 3,
    },
    priceBlock: { alignItems: 'flex-end' },
    price: {
      fontFamily: fonts.mono,
      fontSize: scale.display,
      fontWeight: '600',
      color: '#ffffff',
      textShadowColor: 'rgba(207,31,45,0.55)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 14,
    },
    priceUnit: {
      fontFamily: fonts.sans,
      fontSize: scale.body,
      fontWeight: '400',
      color: palette.muted,
    },
    priceMeta: {
      fontFamily: fonts.mono,
      fontSize: 10.5,
      color: semantic.upText,
      marginTop: 2,
    },
    priceAlt: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: palette.secondary,
      marginTop: 3,
      textAlign: 'right',
    },
    table: { paddingHorizontal: spacing.h1, paddingBottom: spacing.xxl },
    tableHead: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: borders.hairline,
    },
    headCell: {
      fontFamily: fonts.mono,
      fontSize: 9.5,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: palette.faint,
    },
    // Six rows before scrolling: enough to see the cheap end and its spread
    // without the panel growing tall enough to cover the game.
    tableBody: { maxHeight: 6 * 24 },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 24,
    },
    colPrice: { width: 62 },
    colIlvl: { width: 34, textAlign: 'right' },
    colAccount: { flex: 1, paddingLeft: spacing.xl },
    colAge: { width: 40, textAlign: 'right' },
    accountCell: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    cell: { fontFamily: fonts.sans, fontSize: 11.5, color: palette.secondary, flexShrink: 1 },
    cellPrice: { fontFamily: fonts.mono, fontSize: 12, color: palette.primary },
    cellUnit: { color: palette.dim, fontSize: 10.5 },
    cellAge: { fontFamily: fonts.mono, fontSize: 10.5, color: palette.dim },
    presence: { width: 5, height: 5, borderRadius: 3 },
    presenceOnline: { backgroundColor: semantic.up },
    presenceAfk: { backgroundColor: semantic.down },
    presenceOffline: { backgroundColor: palette.disabled },
    divider: { height: 1, backgroundColor: borders.standard },
    body: { flexShrink: 1 },
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
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radii.field,
      backgroundColor: surfaces.chip,
      borderWidth: 1,
      borderColor: surfaces.chipBorder,
      marginBottom: 3,
    },
    modHit: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
    checkbox: {
      width: 14,
      height: 14,
      borderRadius: radii.tag,
      borderWidth: 1,
      borderColor: borders.checkbox,
    },
    checkboxOn: { backgroundColor: theme.accent, borderColor: theme.accent },
    modText: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 12.5,
      color: '#d6cbc4',
    },
    modTextOff: { color: palette.muted },
    input: {
      width: 44,
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
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.xl,
      borderTopWidth: 1,
      borderTopColor: borders.hairline,
      backgroundColor: 'rgba(0,0,0,0.24)',
    },
    search: {
      backgroundColor: theme.action,
      borderRadius: radii.field,
      borderWidth: 1,
      borderColor: 'rgba(232,116,128,0.35)',
      paddingHorizontal: spacing.h4,
      paddingVertical: 9,
      minWidth: 84,
      alignItems: 'center',
      shadowColor: theme.accent,
      shadowOpacity: 0.45,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
    },
    searchText: {
      fontFamily: fonts.sans,
      fontSize: scale.bodyTight,
      fontWeight: '600',
      color: theme.actionText,
    },
    ghost: {
      backgroundColor: 'rgba(255,255,255,0.07)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.13)',
      borderRadius: radii.field,
      paddingHorizontal: spacing.h1,
      paddingVertical: 9,
    },
    ghostText: { fontFamily: fonts.sans, fontSize: scale.bodyTight, color: '#e2d8d2' },
    disabled: { opacity: 0.45 },
    hint: {
      marginLeft: 'auto',
      fontFamily: fonts.mono,
      fontSize: 10.5,
      color: palette.faint,
    },
  });
}
