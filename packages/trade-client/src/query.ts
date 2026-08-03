import type { Modifier, ParsedItem } from '@vaaluation/shared-types';
import type { StatFilter, TradeQuery } from './types';
import { TradeError } from './types';
import type { StatIndex } from './stats';
import type { BaseTypeIndex } from './baseTypes';

/**
 * Builds a trade query from a parsed item.
 *
 * Nothing here contacts the network — the caller shows the resulting filters
 * to the user before anything is sent.
 */

export interface SelectableFilter {
  /** Stable key for UI selection. */
  readonly key: string;
  readonly statId: string;
  /** Human-readable text as shown on the item. */
  readonly label: string;
  readonly selected: boolean;
  readonly value: number | null;
  readonly min: number | null;
  readonly max: number | null;
}

/**
 * Rares roll many modifiers and searching all of them returns nothing, so
 * only a small, high-signal set is preselected. The user adjusts from there.
 */
const PRESELECT_PATTERNS: readonly RegExp[] = [
  /maximum Life/i,
  /maximum Energy Shield/i,
  /increased Physical Damage/i,
  /increased Spell Damage/i,
  /Attack Speed/i,
  /Cast Speed/i,
  /Critical Strike Multiplier/i,
  /increased Movement Speed/i,
];

const MAX_PRESELECTED = 3;

function shouldPreselect(modifier: Modifier, alreadySelected: number): boolean {
  if (alreadySelected >= MAX_PRESELECTED) return false;
  return PRESELECT_PATTERNS.some((pattern) => pattern.test(modifier.text));
}

/**
 * Turns an item's modifiers into selectable filters. Uniques and currency
 * are identified by name, so their modifiers start unselected.
 */
export function buildFilters(item: ParsedItem, stats: StatIndex): SelectableFilter[] {
  if (item.kind !== 'equipment' && item.kind !== 'map') return [];

  const preselectAllowed = item.rarity === 'rare' || item.rarity === 'magic';
  const filters: SelectableFilter[] = [];
  let selectedCount = 0;

  item.modifiers.forEach((modifier, index) => {
    const match = stats.match(modifier);
    if (match === null) return;

    const value = match.values[0] ?? null;
    const selected = preselectAllowed && shouldPreselect(modifier, selectedCount);
    if (selected) selectedCount += 1;

    filters.push({
      key: `${index}:${match.id}`,
      statId: match.id,
      label: modifier.text,
      selected,
      value,
      // Default to "at least what this item rolled", the usual intent.
      min: selected && value !== null ? value : null,
      max: null,
    });
  });

  return filters;
}

export interface QueryOptions {
  readonly onlineOnly?: boolean;
  /**
   * Catalog of searchable base types. Magic items carry affixes in their name
   * ("Nitrate Greater Mana Flask"), which the API rejects, so the base is
   * resolved through this index when available.
   */
  readonly baseTypes?: BaseTypeIndex | undefined;
}

/**
 * Picks the value to send as `type`. Falls back to the parsed base type when
 * no catalog is loaded, and throws when the catalog is loaded but recognizes
 * nothing — better a clear message than an HTTP 400 from the API.
 */
function resolveType(rawType: string, baseTypes: BaseTypeIndex | undefined): string {
  if (baseTypes === undefined) return rawType;
  const resolved = baseTypes.resolve(rawType);
  if (resolved !== null) return resolved;
  throw new TradeError(
    'not_searchable',
    `"${rawType}" is not a base type the trade site recognizes.`,
  );
}

/**
 * Assembles the request body. Throws `not_searchable` for item kinds the
 * trade search cannot express, rather than sending a query that silently
 * matches nothing.
 */
export function buildQuery(
  item: ParsedItem,
  filters: readonly SelectableFilter[],
  options: QueryOptions = {},
): TradeQuery {
  const baseTypes = options.baseTypes;
  const onlineOnly = options.onlineOnly ?? true;
  const stats: StatFilter[] = filters
    .filter((filter) => filter.selected)
    .map((filter) => {
      const value: { min?: number; max?: number } = {};
      if (filter.min !== null) value.min = filter.min;
      if (filter.max !== null) value.max = filter.max;
      return Object.keys(value).length > 0
        ? { id: filter.statId, value }
        : { id: filter.statId };
    });

  const base = {
    status: { option: onlineOnly ? ('online' as const) : ('any' as const) },
    stats: [{ type: 'and' as const, filters: stats }],
  };

  switch (item.kind) {
    case 'currency':
    case 'divinationCard':
      return { query: { ...base, type: item.name }, sort: { price: 'asc' } };

    case 'gem':
      return { query: { ...base, type: item.name }, sort: { price: 'asc' } };

    case 'map':
      return {
        query: { ...base, type: resolveType(item.baseType, baseTypes) },
        sort: { price: 'asc' },
      };

    case 'equipment': {
      if (item.rarity === 'unique') {
        // Uniques are identified by name; unidentified ones only by base.
        return {
          query: {
            ...base,
            ...(item.identified ? { name: item.name } : {}),
            type: resolveType(item.baseType, baseTypes),
          },
          sort: { price: 'asc' },
        };
      }
      return {
        query: { ...base, type: resolveType(item.baseType, baseTypes) },
        sort: { price: 'asc' },
      };
    }

    default: {
      const exhaustive: never = item;
      throw new TradeError(
        'not_searchable',
        `Cannot build a trade search for this item (${JSON.stringify(exhaustive)}).`,
      );
    }
  }
}

/** The official trade page for a completed search. */
export function tradeSearchUrl(league: string, queryId: string): string {
  return `https://www.pathofexile.com/trade/search/${encodeURIComponent(league)}/${encodeURIComponent(queryId)}`;
}
