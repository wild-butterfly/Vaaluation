import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import { colors, radii, spacing, typography } from '@vaaluation/ui';
import { useSettings } from '../state/SettingsContext';
import { useLeagues, defaultLeagueId } from '../hooks/useLeagues';
import { getTradeClient } from '../services/trade';
import { onItemCopied } from '../native/VLEvents';
import { readClipboardText } from '../native/VLClipboard';
import { log } from '../native/VLLog';

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
  | { status: 'error'; message: string; retryAfterMs?: number };

function relativeAge(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'unknown';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function itemTitle(item: ParsedItem): string {
  switch (item.kind) {
    case 'currency':
    case 'divinationCard':
    case 'gem':
      return item.name;
    case 'equipment':
    case 'map':
      return item.name === item.baseType ? item.name : `${item.name} — ${item.baseType}`;
  }
}

export function PriceCheckScreen() {
  const { settings, update } = useSettings();
  const { leagues } = useLeagues();
  const [text, setText] = useState('');
  const [filters, setFilters] = useState<SelectableFilter[]>([]);
  const [state, setState] = useState<SearchState>({ status: 'idle' });

  const parsed = useMemo(() => parseItemText(text), [text]);
  const item = parsed.ok ? parsed.item : null;

  const league = settings.leagueId ?? defaultLeagueId(leagues);

  // Persist a sensible league the first time the list arrives.
  useEffect(() => {
    if (settings.leagueId === null && leagues.length > 0) {
      const fallback = defaultLeagueId(leagues);
      if (fallback !== null) update({ leagueId: fallback });
    }
  }, [leagues, settings.leagueId, update]);

  // A price-check hotkey fills this screen with the copied item.
  useEffect(
    () =>
      onItemCopied(({ text: copied }) => {
        setText(copied);
        setState({ status: 'idle' });
      }),
    [],
  );

  // Recompute selectable filters whenever the item changes.
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
      const query = buildQuery(item, filters, { baseTypes });
      const search = await client.search(league, query);
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
      log('info', 'trade', `Search returned ${search.total} listings`);
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : 'The trade search failed.';
      const retryAfterMs = (cause as { retryAfterMs?: number } | null)?.retryAfterMs;
      setState({
        status: 'error',
        message,
        ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
      });
      log('warn', 'trade', message);
    }
  }, [item, league, filters]);

  const toggleFilter = (key: string) => {
    setFilters((current) =>
      current.map((filter) =>
        filter.key === key ? { ...filter, selected: !filter.selected } : filter,
      ),
    );
  };

  const setBound = (key: string, bound: 'min' | 'max', raw: string) => {
    const value = raw.trim() === '' ? null : Number(raw);
    if (value !== null && Number.isNaN(value)) return;
    setFilters((current) =>
      current.map((filter) =>
        filter.key === key ? { ...filter, [bound]: value } : filter,
      ),
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>
          {item === null ? 'Price Check' : itemTitle(item)}
        </Text>
        <Text style={styles.league}>{league ?? 'No league'}</Text>
      </View>

      {item === null ? (
        <View style={styles.card}>
          <Text style={styles.hint}>
            Hover an item in Path of Exile and press your price-check shortcut, or paste
            item text below.
          </Text>
          <TextInput
            style={styles.input}
            multiline
            value={text}
            onChangeText={setText}
            placeholder={'Item Class: …\nRarity: …'}
            placeholderTextColor={colors.textDisabled}
          />
          <View style={styles.row}>
            <Pressable
              style={styles.button}
              onPress={() => {
                readClipboardText()
                  .then((clip) => setText(clip ?? ''))
                  .catch(() => {});
              }}
            >
              <Text style={styles.buttonText}>Read Clipboard</Text>
            </Pressable>
          </View>
          {text.trim() !== '' && !parsed.ok ? (
            <Text style={styles.warning}>{parsed.message}</Text>
          ) : null}
        </View>
      ) : (
        <>
          {filters.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Modifiers to match</Text>
              <Text style={styles.hint}>
                Only a few relevant modifiers are preselected — searching every roll
                usually returns nothing.
              </Text>
              {filters.map((filter) => (
                <View key={filter.key} style={styles.filterRow}>
                  <Pressable
                    style={styles.checkboxHit}
                    onPress={() => toggleFilter(filter.key)}
                  >
                    <View
                      style={[styles.checkbox, filter.selected && styles.checkboxOn]}
                    />
                    <Text style={styles.filterLabel} numberOfLines={1}>
                      {filter.label}
                    </Text>
                  </Pressable>
                  <TextInput
                    style={styles.bound}
                    value={filter.min === null ? '' : String(filter.min)}
                    onChangeText={(value) => setBound(filter.key, 'min', value)}
                    placeholder="min"
                    placeholderTextColor={colors.textDisabled}
                  />
                  <TextInput
                    style={styles.bound}
                    value={filter.max === null ? '' : String(filter.max)}
                    onChangeText={(value) => setBound(filter.key, 'max', value)}
                    placeholder="max"
                    placeholderTextColor={colors.textDisabled}
                  />
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.row}>
            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={() => {
                void runSearch();
              }}
              disabled={state.status === 'searching' || league === null}
            >
              <Text style={styles.buttonText}>
                {state.status === 'searching' ? 'Searching…' : 'Search Trade'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.button}
              onPress={() => {
                setText('');
                setState({ status: 'idle' });
              }}
            >
              <Text style={styles.buttonText}>Clear</Text>
            </Pressable>
          </View>

          {state.status === 'error' ? (
            <View style={styles.card}>
              <Text style={styles.warning}>{state.message}</Text>
              <Pressable
                style={styles.button}
                onPress={() => {
                  void runSearch();
                }}
              >
                <Text style={styles.buttonText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}

          {state.status === 'done' ? (
            <View style={styles.card}>
              <View style={styles.headerRow}>
                <Text style={styles.cardTitle}>
                  {state.total} listing{state.total === 1 ? '' : 's'}
                </Text>
                {state.summary ? (
                  <Text style={styles.summary}>
                    {state.summary.min} – {state.summary.max} {state.summary.currency}
                    {'  ·  median '}
                    {state.summary.median}
                  </Text>
                ) : null}
              </View>

              <Text style={styles.disclaimer}>
                These are current asking prices for comparable listings, not a valuation.
              </Text>

              {state.warnings.map((warning, index) => (
                <Text key={index} style={styles.warning}>
                  {warning.message}
                </Text>
              ))}

              {state.listings.length === 0 ? (
                <Text style={styles.hint}>
                  No priced listings matched. Try deselecting some modifiers.
                </Text>
              ) : (
                state.listings.map((listing) => (
                  <View key={listing.id} style={styles.listingRow}>
                    <Text style={styles.price}>
                      {listing.amount} {listing.currency}
                    </Text>
                    <View
                      style={[
                        styles.presenceDot,
                        listing.presence === 'online'
                          ? styles.dotOnline
                          : listing.presence === 'afk'
                            ? styles.dotAfk
                            : styles.dotOffline,
                      ]}
                    />
                    <Text style={styles.seller} numberOfLines={1}>
                      {listing.accountName}
                    </Text>
                    <Text style={styles.age}>{relativeAge(listing.indexed)}</Text>
                  </View>
                ))
              )}

              <View style={styles.row}>
                <Pressable
                  style={styles.button}
                  onPress={() => {
                    if (league !== null) {
                      void Linking.openURL(tradeSearchUrl(league, state.queryId));
                    }
                  }}
                >
                  <Text style={styles.buttonText}>Open on Trade Site</Text>
                </Pressable>
              </View>
              {league !== null ? (
                <Text style={styles.url} selectable>
                  {tradeSearchUrl(league, state.queryId)}
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      )}
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
  heading: {
    color: colors.textPrimary,
    fontSize: typography.sizeHeading,
    fontWeight: '700',
    flexShrink: 1,
  },
  league: {
    color: colors.goldBright,
    fontSize: typography.sizeBody,
  },
  card: {
    backgroundColor: colors.charcoal,
    borderColor: colors.gold,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    color: colors.goldBright,
    fontSize: typography.sizeTitle,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    marginBottom: spacing.sm,
  },
  disclaimer: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 120,
    backgroundColor: colors.obsidian,
    borderColor: colors.gold,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.obsidian,
    borderColor: colors.gold,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  primaryButton: {
    backgroundColor: colors.vaalRed,
    borderColor: colors.vaalRedBright,
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 3,
  },
  checkboxHit: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  checkbox: {
    width: 13,
    height: 13,
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gold,
  },
  checkboxOn: {
    backgroundColor: colors.vaalRed,
    borderColor: colors.vaalRedBright,
  },
  filterLabel: {
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
    flexShrink: 1,
  },
  bound: {
    width: 56,
    backgroundColor: colors.obsidian,
    borderColor: colors.gold,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
    color: colors.textPrimary,
    fontSize: typography.sizeCaption,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  summary: {
    color: colors.textPrimary,
    fontSize: typography.sizeBody,
  },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 3,
    borderTopColor: colors.obsidian,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  price: {
    color: colors.goldBright,
    fontSize: typography.sizeBody,
    fontWeight: '600',
    minWidth: 92,
  },
  presenceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotOnline: { backgroundColor: colors.online },
  dotAfk: { backgroundColor: colors.warning },
  dotOffline: { backgroundColor: colors.offline },
  seller: {
    color: colors.textSecondary,
    fontSize: typography.sizeCaption,
    flex: 1,
  },
  age: {
    color: colors.textDisabled,
    fontSize: typography.sizeCaption,
  },
  url: {
    color: colors.textDisabled,
    fontSize: typography.sizeCaption,
  },
  warning: {
    color: colors.warning,
    fontSize: typography.sizeCaption,
    marginBottom: spacing.sm,
  },
});
