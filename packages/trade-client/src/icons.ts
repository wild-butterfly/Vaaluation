/**
 * Currency icons from GGG's own static data endpoint
 * (`GET /api/trade/data/static`).
 *
 * The art is Grinding Gear Games' copyrighted asset, so it is never bundled
 * with the app — the icons are loaded at runtime from GGG's CDN, the same
 * source the official trade site uses. That keeps the repository free of
 * redistributed artwork and the icons current when the game changes them.
 */

const CDN = 'https://web.poecdn.com';

export interface StaticEntry {
  readonly id: string;
  readonly text: string;
  /** Absolute CDN URL, or null when the entry carries no art. */
  readonly imageUrl: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Flattens the static catalog into a lookup of entry id → icon URL. */
export function parseStaticIcons(body: unknown): Map<string, string> {
  const icons = new Map<string, string>();
  if (!isRecord(body) || !Array.isArray(body.result)) return icons;

  for (const group of body.result) {
    if (!isRecord(group) || !Array.isArray(group.entries)) continue;
    for (const entry of group.entries) {
      if (!isRecord(entry)) continue;
      const { id, image } = entry;
      if (typeof id !== 'string' || typeof image !== 'string' || image === '') continue;
      // First writer wins: ids are unique per catalog, and earlier groups
      // hold the currencies the app actually prices.
      if (!icons.has(id)) icons.set(id, absoluteIconUrl(image));
    }
  }
  return icons;
}

/** The endpoint returns CDN-relative paths; callers need absolute URLs. */
export function absoluteIconUrl(path: string): string {
  return path.startsWith('http') ? path : `${CDN}${path}`;
}
