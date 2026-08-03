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
  PriceSummary,
  PriceWarning,
  PricedListing,
  SelectableFilter,
} from '@vaaluation/trade-client';
import {
  buildFilters,
  buildQuery,
  detectPriceWarnings,
  summarize,
  toPricedListings,
  tradeSearchUrl,
} from '@vaaluation/trade-client';
import { colors, glass, radii, spacing, typography } from '@vaaluation/ui';
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
      summary: PriceSummary | null;
      warnings: PriceWarning[];
    }
  | { status: 'error'; message: string };

function age(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '—';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function titleOf(item: ParsedItem): { primary: string; secondary: string | null } {
  switch (item.kind) {
    case 'currency':
    case 'divinationCard':
      return { primary: item.name, secondary: item.itemClass };
    case 'gem':
      return { primary: item.name, secondary: `Level ${item.level} · ${item.quality}%` };
    case 'equipment':
    case 'map':
      return {
        primary: item.name,
        secondary: item.name === item.baseType ? null : item.baseType,
      };
  }
}

export function PriceCheckOverlay() {
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
      const search = await client.search(league, buildQuery(item, filters));
      const results = await client.fetchListings(search.result.slice(0, 10), search.id);
      const listings = toPricedListings(results);
      setState({
        status: 'done',
        total: search.total,
        queryId: search.id,
        listings,
        summary: summarize(listings),
        warnings: detectPriceWarnings(listings),
      });
    } catch (cause: unknown) {
      setState({
        status: 'error',
        message: cause instanceof Error ? cause.message : 'Search failed.',
      });
    }
  }, [item, league, filters]);

  const title = useMemo(() => (item === null ? null : titleOf(item)), [item]);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {title?.primary ?? 'Vaaluation'}
          </Text>
          {title?.secondary != null ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {title.secondary}
            </Text>
          ) : null}
        </View>
        <Text style={styles.league} numberOfLines={1}>
          {league ?? '—'}
        </Text>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {item === null ? (
          <Text style={styles.empty}>
            {parseError ?? 'Hover an item in Path of Exile and press ⌃D.'}
          </Text>
        ) : (
          <>
            {filters.length > 0 ? (
              <View style={styles.filters}>
                {filters.map((filter) => (
                  <View key={filter.key} style={styles.filterRow}>
                    <Pressable
                      style={styles.filterHit}
                      onPress={() =>
                        setFilters((current) =>
                          current.map((f) =>
                            f.key === filter.key ? { ...f, selected: !f.selected } : f,
                          ),
                        )
                      }
                    >
                      <View style={[styles.tick, filter.selected && styles.tickOn]} />
                      <Text
                        style={[
                          styles.filterText,
                          !filter.selected && styles.filterTextOff,
                        ]}
                        numberOfLines={1}
                      >
                        {filter.label}
                      </Text>
                    </Pressable>
                    <TextInput
                      style={styles.bound}
                      value={filter.min === null ? '' : String(filter.min)}
                      onChangeText={(raw) => {
                        const value = raw.trim() === '' ? null : Number(raw);
                        if (value !== null && Number.isNaN(value)) return;
                        setFilters((current) =>
                          current.map((f) =>
                            f.key === filter.key ? { ...f, min: value } : f,
                          ),
                        );
                      }}
                      placeholder="min"
                      placeholderTextColor={colors.textDisabled}
                    />
                  </View>
                ))}
              </View>
            ) : null}

            {state.status === 'error' ? (
              <Text style={styles.error}>{state.message}</Text>
            ) : null}

            {state.status === 'done' ? (
              <>
                {state.summary ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryValue}>
                      {state.summary.min}–{state.summary.max}
                      <Text style={styles.summaryUnit}> {state.summary.currency}</Text>
                    </Text>
                    <Text style={styles.summaryMeta}>
                      median {state.summary.median} · {state.total} listed
                    </Text>
                  </View>
                ) : null}

                {state.warnings.map((warning, index) => (
                  <Text key={index} style={styles.warning}>
                    {warning.message}
                  </Text>
                ))}

                {state.listings.length === 0 ? (
                  <Text style={styles.empty}>
                    No priced listings. Try deselecting a modifier.
                  </Text>
                ) : (
                  state.listings.map((listing) => (
                    <View key={listing.id} style={styles.listing}>
                      <Text style={styles.price} numberOfLines={1}>
                        {listing.amount}
                        <Text style={styles.priceUnit}> {listing.currency}</Text>
                      </Text>
                      <View
                        style={[
                          styles.dot,
                          listing.presence === 'online'
                            ? styles.dotOnline
                            : listing.presence === 'afk'
                              ? styles.dotAfk
                              : styles.dotOffline,
                        ]}
                      />
                      <Text style={styles.seller} numberOfLines={1}>
                        {listing.accountName.split('#')[0]}
                      </Text>
                      <Text style={styles.age}>{age(listing.indexed)}</Text>
                    </View>
                  ))
                )}
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.action, styles.primary]}
          onPress={() => {
            void runSearch();
          }}
          disabled={item === null || state.status === 'searching'}
        >
          {state.status === 'searching' ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <Text style={styles.actionText}>Search</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.action}
          onPress={() => {
            if (state.status === 'done' && league !== null) {
              void Linking.openURL(tradeSearchUrl(league, state.queryId));
            }
          }}
          disabled={state.status !== 'done'}
        >
          <Text
            style={[styles.actionText, state.status !== 'done' && styles.actionTextOff]}
          >
            Trade site
          </Text>
        </Pressable>
        <Text style={styles.hintKey}>esc</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: glass.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: glass.surfaceStrong,
    borderBottomColor: glass.hairline,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.sizeTitle,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    marginTop: 1,
  },
  league: {
    color: colors.goldBright,
    fontSize: typography.sizeCaption,
    maxWidth: 110,
    textAlign: 'right',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  empty: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    paddingVertical: spacing.sm,
    lineHeight: 16,
  },
  filters: {
    marginBottom: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 2,
  },
  filterHit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tick: {
    width: 11,
    height: 11,
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.border,
    backgroundColor: glass.fill,
  },
  tickOn: {
    backgroundColor: glass.accent,
    borderColor: glass.accentBorder,
  },
  filterText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.sizeCaption,
  },
  filterTextOff: {
    color: colors.textSecondary,
  },
  bound: {
    width: 42,
    backgroundColor: glass.fill,
    borderColor: glass.hairline,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    color: colors.textPrimary,
    fontSize: typography.sizeCaption,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    textAlign: 'right',
  },
  summaryRow: {
    marginBottom: spacing.sm,
  },
  summaryValue: {
    color: colors.goldBright,
    fontSize: typography.sizeHeading,
    fontWeight: '700',
  },
  summaryUnit: {
    fontSize: typography.sizeCaption,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  summaryMeta: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    marginTop: 1,
  },
  warning: {
    color: colors.warning,
    fontSize: typography.sizeCaption,
    marginBottom: spacing.xs,
    lineHeight: 15,
  },
  listing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
    borderTopColor: glass.hairline,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  price: {
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
    fontWeight: '600',
    minWidth: 74,
  },
  priceUnit: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    fontWeight: '400',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotOnline: { backgroundColor: colors.online },
  dotAfk: { backgroundColor: colors.warning },
  dotOffline: { backgroundColor: colors.offline },
  seller: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
  },
  age: {
    color: colors.textDisabled,
    fontSize: typography.sizeCaption,
  },
  error: {
    color: colors.danger,
    fontSize: typography.sizeCaption,
    marginBottom: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: glass.surfaceStrong,
    borderTopColor: glass.hairline,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  action: {
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.hairline,
    backgroundColor: glass.fill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    minWidth: 62,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: glass.accent,
    borderColor: glass.accentBorder,
  },
  actionText: {
    color: colors.textPrimary,
    fontSize: typography.sizeCaption,
    fontWeight: '600',
  },
  actionTextOff: {
    color: colors.textDisabled,
  },
  hintKey: {
    marginLeft: 'auto',
    color: colors.textDisabled,
    fontSize: typography.sizeCaption,
  },
});
