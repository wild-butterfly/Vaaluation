import type { Modifier, ModifierType } from '@vaaluation/shared-types';
import type { TradeStatEntry, TradeStatGroup } from './types';

/**
 * Maps parsed modifier text onto trade stat ids.
 *
 * The catalog stores display text with `#` placeholders ("+# to maximum
 * Life"), so a parsed modifier is normalized the same way before lookup.
 */

/** Group labels in the catalog, keyed by the modifier type we parsed. */
const GROUP_FOR_TYPE: Partial<Record<ModifierType, string>> = {
  explicit: 'Explicit',
  implicit: 'Implicit',
  crafted: 'Crafted',
  enchant: 'Enchant',
  fractured: 'Fractured',
  rune: 'Rune',
  scourge: 'Scourge',
};

/**
 * Replaces rolled numbers with the catalog's `#` placeholder while keeping
 * any sign, because the catalog itself is written that way ("+# to maximum
 * Life", not "# to maximum Life").
 */
export function normalizeStatText(text: string): string {
  return text
    .replace(/\d+(?:\.\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Signed stats are catalogued in their positive form, so a negative roll
 * ("-5% to Fire Resistance") must also be looked up as "+#% …".
 */
function positiveForm(key: string): string | null {
  return key.includes('-#') ? key.replace(/-#/g, '+#') : null;
}

export interface StatMatch {
  readonly id: string;
  readonly text: string;
  /** Numeric values pulled from the modifier, in order. */
  readonly values: readonly number[];
}

export class StatIndex {
  /** group label → normalized text → entry */
  private readonly byGroup = new Map<string, Map<string, TradeStatEntry>>();

  constructor(groups: readonly TradeStatGroup[]) {
    for (const group of groups) {
      const index = new Map<string, TradeStatEntry>();
      for (const entry of group.entries) {
        const key = normalizeStatText(entry.text);
        // First entry wins: the catalog lists the canonical stat first.
        if (!index.has(key)) index.set(key, entry);
      }
      this.byGroup.set(group.label, index);
    }
  }

  /**
   * Finds the stat id for a modifier, preferring the catalog group that
   * matches the modifier's type and falling back to Explicit.
   *
   * `local` selects between the two forms the catalogue keeps for defences
   * and weapon stats. The game prints both identically — a boot's line reads
   * "33% increased Energy Shield" whether it is the boot's own energy shield
   * or a jewel's global bonus — but the trade site separates them, suffixing
   * the item's own with "(Local)". Without this the boot's line matched
   * nothing at all and was dropped from the panel, while "increased Evasion
   * Rating" silently matched the global stat and searched for the wrong
   * thing.
   */
  match(modifier: Modifier, options: { local?: boolean } = {}): StatMatch | null {
    const key = normalizeStatText(modifier.text);
    const values = extractValues(modifier.text);

    const preferred = GROUP_FOR_TYPE[modifier.type];
    const candidates = [preferred, 'Explicit', 'Pseudo'].filter(
      (label): label is string => label !== undefined,
    );

    const plain = [key, positiveForm(key)].filter(
      (candidate): candidate is string => candidate !== null,
    );
    const keys =
      options.local === true
        ? [...plain.map((candidate) => `${candidate} (Local)`), ...plain]
        : plain;

    for (const label of candidates) {
      const group = this.byGroup.get(label);
      if (group === undefined) continue;
      for (const candidate of keys) {
        const entry = group.get(candidate);
        if (entry !== undefined) {
          return { id: entry.id, text: entry.text, values };
        }
      }
    }
    return null;
  }
}

export function extractValues(text: string): number[] {
  return (text.match(/[+-]?\d+(?:\.\d+)?/g) ?? []).map(Number);
}
