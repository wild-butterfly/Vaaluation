/** Splitting and low-level line parsing for copied item text. */

export const SECTION_SEPARATOR = /^-{8}$/;

export interface ItemSections {
  /** First section: Item Class, Rarity, name and base type lines. */
  readonly header: readonly string[];
  /** Every following section, in order. */
  readonly rest: readonly (readonly string[])[];
}

export function splitSections(text: string): ItemSections | null {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const sections: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (SECTION_SEPARATOR.test(line.trim())) {
      sections.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  sections.push(current);

  const cleaned = sections.map((section) =>
    section
      .map((line) => line.trimEnd())
      .filter((line, index, all) => {
        // Drop leading/trailing empty lines inside a section.
        if (line !== '') return true;
        const firstNonEmpty = all.findIndex((l) => l !== '');
        let lastNonEmpty = -1;
        for (let i = all.length - 1; i >= 0; i--) {
          if (all[i] !== '') {
            lastNonEmpty = i;
            break;
          }
        }
        return index > firstNonEmpty && index < lastNonEmpty;
      }),
  );

  const nonEmpty = cleaned.filter((section) => section.length > 0);
  if (nonEmpty.length === 0) return null;

  const [header, ...rest] = nonEmpty;
  if (header === undefined) return null;
  return { header, rest };
}

export function parseKeyValue(line: string): { key: string; value: string } | null {
  const match = /^([A-Za-z][A-Za-z ]*): (.+)$/.exec(line);
  if (match === null) return null;
  const key = match[1];
  const value = match[2];
  if (key === undefined || value === undefined) return null;
  return { key, value };
}

/** "Stack Size: 2,340/5,000" → { current: 2340, max: 5000 } */
export function parseStackSize(value: string): { current: number; max: number } | null {
  const match = /^([\d,]+)\/([\d,]+)/.exec(value.trim());
  if (match === null) return null;
  const current = Number(match[1]?.replace(/,/g, ''));
  const max = Number(match[2]?.replace(/,/g, ''));
  if (Number.isNaN(current) || Number.isNaN(max)) return null;
  return { current, max };
}

/** "+20% (augmented)" → 20; "20" → 20 */
export function parsePercent(value: string): number | null {
  const match = /^\+?(\d+)%/.exec(value.trim());
  if (match === null) return null;
  return Number(match[1]);
}

/** "Level: 20 (Max)" → 20 */
export function parseInteger(value: string): number | null {
  const match = /^(\d+)/.exec(value.trim());
  if (match === null) return null;
  return Number(match[1]);
}

/** "1.75" → 1.75; "8.50%" → 8.5; "66 (augmented)" → 66 */
export function parseDecimal(value: string): number | null {
  const match = /^\+?(\d+(?:\.\d+)?)/.exec(value.trim());
  if (match === null) return null;
  return Number(match[1]);
}

/**
 * Mean damage across every range on the line.
 *
 * Weapons print one range per damage type on the elemental line ("2-27, 3-5"),
 * and the trade site's DPS filters compare the total, so the midpoints are
 * summed rather than averaged against each other.
 */
export function averageDamage(value: string): number | null {
  const ranges = [...value.matchAll(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/g)];
  if (ranges.length === 0) return null;
  return ranges.reduce(
    (total, range) => total + (Number(range[1]) + Number(range[2])) / 2,
    0,
  );
}
