/**
 * Resolves the searchable base type of an item.
 *
 * Magic items decorate their base with an affix prefix and/or suffix —
 * "Nitrate Greater Mana Flask" is the base "Greater Mana Flask" wearing the
 * prefix "Nitrate". The trade API rejects the decorated name outright
 * (HTTP 400, "Unknown item base type"), so the base has to be recovered from
 * the official catalog at /api/trade/data/items.
 */

export interface ItemEntry {
  /** Base type, e.g. "Greater Mana Flask". */
  readonly type: string;
  /** Unique or card name, when the entry names a specific item. */
  readonly name?: string;
}

export interface ItemGroup {
  readonly label?: string;
  readonly entries: readonly ItemEntry[];
}

export class BaseTypeIndex {
  private readonly exact = new Set<string>();
  /** Base types bucketed by word count, longest first for greedy matching. */
  private readonly byLength: { words: number; types: string[] }[] = [];

  constructor(groups: readonly ItemGroup[]) {
    const byWordCount = new Map<number, string[]>();
    for (const group of groups) {
      for (const entry of group.entries) {
        if (typeof entry.type !== 'string' || entry.type === '') continue;
        if (this.exact.has(entry.type)) continue;
        this.exact.add(entry.type);
        const words = entry.type.split(' ').length;
        const bucket = byWordCount.get(words);
        if (bucket === undefined) byWordCount.set(words, [entry.type]);
        else bucket.push(entry.type);
      }
    }
    this.byLength = [...byWordCount.entries()]
      .map(([words, types]) => ({ words, types }))
      .sort((a, b) => b.words - a.words);
  }

  get size(): number {
    return this.exact.size;
  }

  isKnown(type: string): boolean {
    return this.exact.has(type);
  }

  /**
   * Returns the base type contained in `name`, preferring the longest match
   * so "Greater Mana Flask" wins over "Mana Flask". Returns null when nothing
   * in the catalog matches, letting the caller fail loudly rather than send a
   * request the API will reject.
   */
  resolve(name: string): string | null {
    const trimmed = name.trim();
    if (this.exact.has(trimmed)) return trimmed;

    const words = trimmed.split(/\s+/);
    for (const { words: length, types } of this.byLength) {
      if (length > words.length) continue;
      // Slide a window of this length across the name.
      for (let start = 0; start + length <= words.length; start += 1) {
        const candidate = words.slice(start, start + length).join(' ');
        if (this.exact.has(candidate)) return candidate;
      }
    }
    return null;
  }
}

export function parseItemCatalog(body: unknown): ItemGroup[] {
  if (
    typeof body !== 'object' ||
    body === null ||
    !Array.isArray((body as { result?: unknown }).result)
  ) {
    return [];
  }
  const groups: ItemGroup[] = [];
  for (const group of (body as { result: unknown[] }).result) {
    if (typeof group !== 'object' || group === null) continue;
    const entries = (group as { entries?: unknown }).entries;
    if (!Array.isArray(entries)) continue;
    groups.push({
      ...(typeof (group as { label?: unknown }).label === 'string'
        ? { label: (group as { label: string }).label }
        : {}),
      entries: entries.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null) return [];
        const type = (entry as { type?: unknown }).type;
        if (typeof type !== 'string') return [];
        const name = (entry as { name?: unknown }).name;
        return [{ type, ...(typeof name === 'string' ? { name } : {}) }];
      }),
    });
  }
  return groups;
}
