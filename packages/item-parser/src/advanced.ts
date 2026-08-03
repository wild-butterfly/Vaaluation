import type { ModifierAnnotation } from '@vaaluation/shared-types';

/**
 * Support for the game's "Advanced Mod Descriptions" option, which prefixes
 * each modifier with an annotation line and embeds roll ranges in the value:
 *
 *   { Prefix Modifier "Healthy" (Tier: 12) — Life }
 *   +18(10-24) to maximum Life
 */

const ANNOTATION = /^\{\s*(.+?)\s*\}$/;

export function isAnnotationLine(line: string): boolean {
  return ANNOTATION.test(line.trim());
}

/**
 * Parses an annotation line. Returns null when the braces contain something
 * we do not recognize, so the caller can preserve the raw line instead.
 */
export function parseAnnotation(line: string): ModifierAnnotation | null {
  const outer = ANNOTATION.exec(line.trim());
  if (outer === null) return null;
  const body = outer[1];
  if (body === undefined) return null;

  // Split the trailing tag list on the em dash the game uses as separator.
  const [head, tagPart] = splitOnDash(body);

  const affix: ModifierAnnotation['affix'] = /^Prefix\b/i.test(head)
    ? 'prefix'
    : /^Suffix\b/i.test(head)
      ? 'suffix'
      : 'unknown';

  const nameMatch = /"([^"]*)"/.exec(head);
  const tierMatch = /\(Tier:\s*(\d+)\)/i.exec(head);

  const tags =
    tagPart === null
      ? []
      : tagPart
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0);

  const annotation: ModifierAnnotation = {
    affix,
    name: nameMatch?.[1] ?? '',
    ...(tierMatch?.[1] !== undefined ? { tier: Number(tierMatch[1]) } : {}),
    tags,
  };

  // Braces that carry no recognizable structure are not annotations.
  if (
    annotation.affix === 'unknown' &&
    annotation.name === '' &&
    annotation.tier === undefined
  ) {
    return null;
  }
  return annotation;
}

function splitOnDash(body: string): [string, string | null] {
  // The game separates the affix description from its tags with an em dash;
  // fall back to other dash characters defensively.
  const index = body.search(/[—–-]\s/);
  if (index === -1) return [body, null];
  return [body.slice(0, index).trim(), body.slice(index + 1).trim()];
}

/**
 * Strips advanced-description roll ranges from modifier text.
 * `+18(10-24) to maximum Life` → `+18 to maximum Life` with range 10…24.
 * Only the first range is reported; the text keeps every rolled value.
 */
export function stripRanges(text: string): {
  text: string;
  range?: { min: number; max: number };
} {
  let first: { min: number; max: number } | undefined;

  const stripped = text.replace(
    /(-?\d+(?:\.\d+)?)\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)/g,
    (_match, value: string, min: string, max: string) => {
      first ??= { min: Number(min), max: Number(max) };
      return value;
    },
  );

  return first === undefined ? { text: stripped } : { text: stripped, range: first };
}
