import type { ItemProperties, Modifier, ParsedItem } from '@vaaluation/shared-types';
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

/**
 * Trade-site filters that search an item's printed totals rather than the
 * rolls behind them. Keys are the API's own; every one was verified against
 * the live search before being listed here.
 */
export type PropertyFilterId =
  | 'ar'
  | 'ev'
  | 'es'
  | 'ward'
  | 'block'
  | 'pdps'
  | 'edps'
  | 'dps'
  | 'aps'
  | 'crit';

export interface SelectableFilter {
  /** Stable key for UI selection. */
  readonly key: string;
  /**
   * Which search this row drives: a modifier on the item, or one of the
   * item's own totals under the trade site's Armour and Weapon filters.
   */
  readonly kind: 'stat' | 'property';
  /** Set for `kind: 'property'`; the API's filter key. */
  readonly property?: PropertyFilterId;
  readonly statId: string;
  /** Human-readable text as shown on the item. */
  readonly label: string;
  readonly selected: boolean;
  readonly value: number | null;
  readonly min: number | null;
  readonly max: number | null;
  /**
   * How strongly this modifier argued for being searched on. Carried through
   * so a search that finds nothing can give up its weakest filter first.
   */
  readonly weight: number;
}

/**
 * Rares roll many modifiers and searching all of them returns nothing, so
 * only a small, high-signal set is preselected. The user adjusts from there.
 *
 * Each rule carries a weight because ranking, not matching, is what decides
 * the selection: an earlier version took the first three modifiers that
 * matched any pattern, so a wand's "+1 to Level of all Lightning Spell Skill
 * Gems" — the line the item is actually worth anything for — lost its place
 * to whatever happened to be printed above it.
 */
interface PreselectRule {
  readonly pattern: RegExp;
  readonly weight: number;
}

const PRESELECT_RULES: readonly PreselectRule[] = [
  // A gem level is worth more than the rest of an item put together.
  { pattern: /to Level of all .*Skill Gems/i, weight: 100 },
  { pattern: /to maximum Life/i, weight: 90 },
  { pattern: /increased Physical Damage/i, weight: 82 },
  { pattern: /increased Spell Damage/i, weight: 80 },
  { pattern: /increased Elemental Damage with Attack Skills/i, weight: 78 },
  { pattern: /to maximum Energy Shield/i, weight: 74 },
  { pattern: /Critical Strike Multiplier/i, weight: 66 },
  { pattern: /increased Attack Speed/i, weight: 62 },
  { pattern: /increased Cast Speed/i, weight: 62 },
  { pattern: /increased Movement Speed/i, weight: 60 },
  { pattern: /Adds \d+ to \d+ .*Damage/i, weight: 52 },
  // One line covering three resistances beats one covering a single one.
  { pattern: /to all Elemental Resistances/i, weight: 50 },
  { pattern: /to Chaos Resistance/i, weight: 44 },
  { pattern: /to (Fire|Cold|Lightning) Resistance/i, weight: 40 },
  { pattern: /increased Critical Strike Chance/i, weight: 34 },
  { pattern: /increased Elemental Damage/i, weight: 32 },
  { pattern: /to maximum Mana/i, weight: 24 },
];

const MAX_PRESELECTED = 3;

/**
 * Item classes that never carry the item's own defences or weapon stats, so
 * their modifiers are the global forms. Inverted deliberately: the list of
 * things that do carry local stats is every armour piece and every weapon
 * type, which is long and grows with the game.
 */
const GLOBAL_ONLY_CLASSES = new Set([
  'rings',
  'amulets',
  'belts',
  'jewels',
  'abyss jewels',
  'cluster jewels',
  'life flasks',
  'mana flasks',
  'hybrid flasks',
  'utility flasks',
  'charms',
  'tinctures',
]);

/**
 * The item's totals, in the order a player reads them off the tooltip. Only
 * those the item actually prints become rows.
 */
const PROPERTY_ROWS: ReadonlyArray<{
  id: PropertyFilterId;
  label: string;
  read: (properties: ItemProperties) => number | undefined;
}> = [
  { id: 'ar', label: 'Armour', read: (p) => p.armour },
  { id: 'ev', label: 'Evasion Rating', read: (p) => p.evasion },
  { id: 'es', label: 'Energy Shield', read: (p) => p.energyShield },
  { id: 'ward', label: 'Ward', read: (p) => p.ward },
  { id: 'block', label: 'Chance to Block', read: (p) => p.block },
  { id: 'pdps', label: 'Physical DPS', read: (p) => p.physicalDps },
  { id: 'edps', label: 'Elemental DPS', read: (p) => p.elementalDps },
  { id: 'dps', label: 'Total DPS', read: (p) => p.totalDps },
  { id: 'aps', label: 'Attacks per Second', read: (p) => p.attacksPerSecond },
  { id: 'crit', label: 'Critical Strike Chance', read: (p) => p.criticalChance },
];

/**
 * Rows for the item's own totals.
 *
 * They start unticked with their value already filled in, because the choice
 * belongs to the player: "boots with at least 44 energy shield" is usually
 * the more useful search, but only they know whether they are pricing the
 * defence or the rolls. Ticking one is a single click either way.
 */
function propertyFilters(item: ParsedItem): SelectableFilter[] {
  if (item.kind !== 'equipment') return [];
  const properties = item.properties ?? {};
  return PROPERTY_ROWS.flatMap((row) => {
    const value = row.read(properties);
    if (value === undefined || value <= 0) return [];
    return [
      {
        key: `property:${row.id}`,
        kind: 'property' as const,
        property: row.id,
        statId: '',
        label: row.label,
        selected: false,
        value,
        min: value,
        max: null,
        // Never preselected, so ranking never has to consider them.
        weight: 0,
      },
    ];
  });
}

/** Whether this item's modifiers should resolve to the "(Local)" stats. */
function usesLocalStats(item: ParsedItem): boolean {
  if (item.kind !== 'equipment') return false;
  return !GLOBAL_ONLY_CLASSES.has(item.itemClass.trim().toLowerCase());
}

/** How strongly a modifier argues for being searched on. Zero means never. */
function preselectWeight(modifier: Modifier): number {
  let best = 0;
  for (const rule of PRESELECT_RULES) {
    if (rule.weight > best && rule.pattern.test(modifier.text)) best = rule.weight;
  }
  return best;
}

/**
 * Turns an item's modifiers into selectable filters. Uniques and currency
 * are identified by name, so their modifiers start unselected.
 */
export function buildFilters(item: ParsedItem, stats: StatIndex): SelectableFilter[] {
  if (item.kind !== 'equipment' && item.kind !== 'map') return [];

  const preselectAllowed = item.rarity === 'rare' || item.rarity === 'magic';
  const local = usesLocalStats(item);

  const candidates: { key: string; statId: string; label: string; value: number | null;
    weight: number }[] = [];

  item.modifiers.forEach((modifier, index) => {
    const match = stats.match(modifier, { local });
    if (match === null) return;
    candidates.push({
      key: `${index}:${match.id}`,
      statId: match.id,
      label: modifier.text,
      value: match.values[0] ?? null,
      weight: preselectAllowed ? preselectWeight(modifier) : 0,
    });
  });

  // Rank first, then pick: the strongest few modifiers get searched on
  // regardless of where they sit on the item.
  const chosen = new Set(
    [...candidates]
      .filter((candidate) => candidate.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, MAX_PRESELECTED)
      .map((candidate) => candidate.key),
  );

  // The item's own totals come first, matching the tooltip: the game prints
  // armour and energy shield above the modifiers that produced them.
  return [...propertyFilters(item), ...candidates.map((candidate) => {
    const selected = chosen.has(candidate.key);
    return {
      key: candidate.key,
      statId: candidate.statId,
      label: candidate.label,
      selected,
      value: candidate.value,
      // Default to "at least what this item rolled", the usual intent.
      min: selected && candidate.value !== null ? candidate.value : null,
      max: null,
      weight: candidate.weight,
      kind: 'stat' as const,
    };
  })];
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
    .filter((filter) => filter.selected && filter.kind !== 'property')
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
    ...propertyQuery(filters),
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

/**
 * Loosens the search by one step, weakest modifier first.
 *
 * A rare or magic item searched on three exact rolls routinely matches
 * nothing — the item is one of a kind, which is the point of it. Rather than
 * report no listings and leave the player to guess which checkbox to clear,
 * the search relaxes itself and asks again.
 *
 * A bound is given up before the filter that carries it: "some fire
 * resistance" still describes the item, while dropping the modifier outright
 * stops describing it at all. Only once a filter has no bound left does it
 * come off, so the search degrades toward a looser description of the same
 * item rather than collapsing to the bare base type. Returns `null` when
 * nothing is left to relax.
 */
export function relaxWeakest(
  filters: readonly SelectableFilter[],
): SelectableFilter[] | null {
  const bounded = filters.filter(
    (filter) => filter.selected && (filter.min !== null || filter.max !== null),
  );
  const pool = bounded.length > 0 ? bounded : filters.filter((f) => f.selected);
  if (pool.length === 0) return null;

  let weakest = pool[0] as SelectableFilter;
  for (const filter of pool) {
    if (filter.weight < weakest.weight) weakest = filter;
  }

  const target = weakest;
  const dropBound = bounded.length > 0;
  return filters.map((filter) =>
    filter.key === target.key
      ? dropBound
        ? { ...filter, min: null, max: null }
        : { ...filter, selected: false }
      : filter,
  );
}

/** The `armour_filters` and `weapon_filters` groups a query needs, if any. */
function propertyQuery(
  filters: readonly SelectableFilter[],
): { filters?: Record<string, unknown> } {
  const armour: Record<string, { min?: number; max?: number }> = {};
  const weapon: Record<string, { min?: number; max?: number }> = {};

  for (const filter of filters) {
    if (!filter.selected || filter.kind !== 'property' || filter.property === undefined) {
      continue;
    }
    const bound: { min?: number; max?: number } = {};
    if (filter.min !== null) bound.min = filter.min;
    if (filter.max !== null) bound.max = filter.max;
    if (Object.keys(bound).length === 0) continue;

    const group = ARMOUR_PROPERTIES.has(filter.property) ? armour : weapon;
    group[filter.property] = bound;
  }

  const groups: Record<string, unknown> = {};
  if (Object.keys(armour).length > 0) groups.armour_filters = { filters: armour };
  if (Object.keys(weapon).length > 0) groups.weapon_filters = { filters: weapon };
  return Object.keys(groups).length > 0 ? { filters: groups } : {};
}

const ARMOUR_PROPERTIES = new Set<PropertyFilterId>(['ar', 'ev', 'es', 'ward', 'block']);
