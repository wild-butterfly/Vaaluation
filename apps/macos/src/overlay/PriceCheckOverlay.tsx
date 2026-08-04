import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  formatAmount,
  listingAge,
  quoteAlternatives,
  relaxWeakest,
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

/**
 * How many filters a fruitless search may give up before reporting nothing.
 * Each attempt costs a request against a limit of five per ten seconds.
 */
const MAX_RELAXATIONS = 2;

/**
 * Table-width currency names. A bare initial ("c", "d") was ambiguous once
 * the panel could quote in more than one currency — "d" reads as divine to
 * one player and nothing at all to another.
 */
const SHORT_CURRENCY: Record<string, string> = {
  chaos: 'chaos',
  divine: 'div',
  exalted: 'ex',
};

function shortCurrency(currency: string): string {
  return SHORT_CURRENCY[currency] ?? currency;
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

  /**
   * Latest search, reachable from the effect below without making that effect
   * depend on it — the callback changes whenever a filter does, which would
   * otherwise re-run the effect and search again on every checkbox.
   */
  const runSearchRef = useRef<((withFilters: SelectableFilter[]) => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (item === null) {
      setFilters([]);
      return;
    }
    getTradeClient()
      .getStatIndex()
      .then((stats) => {
        if (cancelled) return;
        const built = buildFilters(item, stats);
        setFilters(built);
        // Price checking is one keypress, so the panel answers rather than
        // asking again: the modifiers it would have preselected are the ones
        // it searches with, and a unique has none to choose in the first
        // place. Adjusting a filter and pressing Search still works.
        runSearchRef.current?.(built);
      })
      .catch(() => {
        if (!cancelled) setFilters([]);
      });
    return () => {
      cancelled = true;
    };
  }, [item]);

  const runSearch = useCallback(
    async (withFilters: SelectableFilter[] = filters) => {
      if (item === null || league === null) return;
      setState({ status: 'searching' });
      try {
        const client = getTradeClient();
        const baseTypes = await client.getBaseTypeIndex();

        // An item searched on three of its exact rolls routinely matches
        // nothing, because the item is one of a kind — which is the point of
        // it. Rather than report no listings and leave the player guessing
        // which checkbox to clear, the search gives up its weakest filter and
        // asks again. Bounded, because each attempt spends a request.
        let applied = withFilters;
        let search = await client.search(
          league,
          buildQuery(item, applied, { baseTypes }),
        );
        for (let relaxations = 0; search.total === 0 && relaxations < MAX_RELAXATIONS; ) {
          const loosened = relaxWeakest(applied);
          if (loosened === null) break;
          applied = loosened;
          relaxations += 1;
          search = await client.search(
            league,
            buildQuery(item, applied, { baseTypes }),
          );
        }
        // The checkboxes must show what was actually searched, or the panel
        // would be reporting prices for a query it is not displaying.
        if (applied !== withFilters) setFilters(applied);
        // Two pages: twenty listings give the table something to scroll.
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
    },
    [item, league, filters],
  );

  runSearchRef.current = (withFilters) => {
    void runSearch(withFilters);
  };

  const setBound = (key: string, bound: 'min' | 'max', raw: string) => {
    const value = raw.trim() === '' ? null : Number(raw);
    if (value !== null && Number.isNaN(value)) return;
    setFilters((current) =>
      current.map((f) => (f.key === key ? { ...f, [bound]: value } : f)),
    );
  };

  const spread = state.status === 'done' ? state.spread : null;
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

  /**
   * The listings, in the order the trade site itself would show them.
   *
   * The search asks for `price: asc` and the API returns the hashes already
   * ordered, so the rows arrive cheapest first — across currencies, converted
   * with GGG's own rates. Re-sorting them here could only be worse: the panel
   * knows the rate of two currencies, and knows neither until the exchange
   * lookup lands, so a divine listing sorted after a one-chaos one on the
   * first paint and then jumped.
   */
  const rows = state.status === 'done' ? state.listings : [];

  /**
   * The currency the panel quotes in: the largest one the median is worth at
   * least one whole unit of. Sixty exalted is how a player would say it;
   * "600c" makes them do the division themselves.
   */
  const display = useMemo(() => {
    if (spread === null || spread.currency !== 'chaos') {
      return { currency: spread?.currency ?? 'chaos', rate: 1 };
    }
    let best = { currency: 'chaos', rate: 1 };
    for (const [currency, rate] of chaosRates) {
      if (rate > best.rate && spread.median / rate >= 1) best = { currency, rate };
    }
    return best;
  }, [spread, chaosRates]);

  /** The same price in every other currency worth naming it in. */
  const alternatives = useMemo(
    () =>
      spread !== null && spread.currency === 'chaos'
        ? [
            ...(display.currency === 'chaos'
              ? []
              : [{ amount: spread.median, currency: 'chaos' }]),
            ...quoteAlternatives(spread.median, chaosRates).filter(
              (quote) => quote.currency !== display.currency,
            ),
          ]
        : [],
    [spread, chaosRates, display],
  );

  return (
    <View style={styles.panel}>
      {/* Measured rather than guessed: the height used to be a hand-tuned
          constant added to the modifier list, which counted neither the
          listing table nor the header. The footer stays outside, because the
          shell adds its own allowance for it — measuring it here too made the
          panel taller than its contents. */}
      <View
        onLayout={(event) => onContentHeight(event.nativeEvent.layout.height)}
      >
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
              {round(spread.median / display.rate)}
              <Text style={styles.priceUnit}> {display.currency}</Text>
            </Text>
            {alternatives.length > 0 ? (
              <Text style={styles.priceAlt} numberOfLines={1}>
                {alternatives
                  .map((quote) => `${round(quote.amount)} ${shortCurrency(quote.currency)}`)
                  .join(' · ')}
              </Text>
            ) : null}
            <Text style={styles.priceMeta}>
              median · {state.status === 'done' ? state.total : 0} live listings
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
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
      </View>
      <View style={styles.divider} />

      {rows.length > 0 ? (
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.headCell, styles.colPrice]}>Price</Text>
            <Text style={[styles.headCell, styles.colIlvl]}>iLvl</Text>
            <Text style={[styles.headCell, styles.colAccount]}>Account</Text>
            <Text style={[styles.headCell, styles.colAge]}>Listed</Text>
          </View>
          {/* Keyed by the search, so a new item starts at the top. Without
              this the list kept the previous scroll position and opened part
              way down, hiding the cheapest listings the table exists to
              show — and making the headline median look wrong against them. */}
          <ScrollView
            key={state.status === 'done' ? state.queryId : 'idle'}
            style={styles.tableBody}
            nestedScrollEnabled
          >
            {rows.map((listing) => (
              <View key={listing.id} style={styles.tableRow}>
                <Text style={[styles.cellPrice, styles.colPrice]} numberOfLines={1}>
                  {round(listing.amount)}
                  <Text style={styles.cellUnit}> {shortCurrency(listing.currency)}</Text>
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

      </View>

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
      paddingHorizontal: spacing.xxl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
      gap: spacing.lg,
      position: 'relative',
      overflow: 'hidden',
    },
    bloom: {
      position: 'absolute',
      top: -38,
      right: -26,
      width: 150,
      height: 118,
      borderRadius: 75,
      backgroundColor: 'rgba(207,31,45,0.16)',
    },
    headerText: { flex: 1 },
    itemName: {
      fontFamily: fonts.sans,
      fontSize: 16,
      fontWeight: '600',
      color: palette.primary,
      letterSpacing: -0.2,
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 8,
    },
    itemMeta: {
      fontFamily: fonts.sans,
      fontSize: 11.5,
      color: palette.secondary,
      marginTop: 1,
    },
    priceBlock: { alignItems: 'flex-end' },
    price: {
      fontFamily: fonts.mono,
      fontSize: scale.xl,
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
    table: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.lg },
    tableHead: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: spacing.xs,
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
    // Five rows before scrolling. The modifiers share the panel now, so the
    // table gives up a row rather than pushing them off the bottom.
    tableBody: { maxHeight: 5 * 21 },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 21,
    },
    colPrice: { width: 76 },
    colIlvl: { width: 34, textAlign: 'right' },
    colAccount: { flex: 1, paddingLeft: spacing.xl },
    colAge: { width: 46, textAlign: 'right' },
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
    body: {},
    mods: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
    empty: {
      fontFamily: fonts.sans,
      fontSize: scale.ui,
      color: palette.secondary,
      padding: spacing.h1,
      lineHeight: 19,
    },
    // Compact on purpose: the modifiers share the panel with the listings
    // now, and every point a row spends here is one the prices lose.
    modRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 2,
      borderRadius: radii.input,
      backgroundColor: surfaces.chip,
      borderWidth: 1,
      borderColor: surfaces.chipBorder,
      marginBottom: 2,
    },
    modHit: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    checkbox: {
      width: 12,
      height: 12,
      borderRadius: radii.tag,
      borderWidth: 1,
      borderColor: borders.checkbox,
    },
    checkboxOn: { backgroundColor: theme.accent, borderColor: theme.accent },
    modText: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 12,
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
      paddingVertical: 1,
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
      gap: spacing.md,
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.md,
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
