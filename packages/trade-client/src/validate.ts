import type {
  FetchResponse,
  FetchResult,
  Listing,
  ListingPrice,
  SearchResponse,
  TradeStatGroup,
} from './types';
import { TradeError } from './types';
import type { League } from '@vaaluation/shared-types';

/**
 * Boundary validation for the undocumented trade endpoints. Hand-written
 * rather than schema-library based to keep this package dependency-free —
 * it ships inside a desktop app that handles user data.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(what: string): never {
  throw new TradeError(
    'unexpected_response',
    `The trade API returned an unexpected ${what}. Vaaluation may need an update.`,
  );
}

export function parseLeagues(body: unknown): League[] {
  if (!isRecord(body) || !Array.isArray(body.result)) fail('league list');
  const leagues: League[] = [];
  for (const entry of body.result) {
    if (!isRecord(entry)) continue;
    const { id, text, realm } = entry;
    if (typeof id !== 'string') continue;
    // Console realms are not supported; PC only.
    if (realm !== undefined && realm !== 'pc') continue;
    leagues.push({ id, text: typeof text === 'string' ? text : id, realm: 'pc' });
  }
  if (leagues.length === 0) fail('league list');
  return leagues;
}

export function parseStatGroups(body: unknown): TradeStatGroup[] {
  if (!isRecord(body) || !Array.isArray(body.result)) fail('stat catalog');
  const groups: TradeStatGroup[] = [];
  for (const group of body.result) {
    if (!isRecord(group) || !Array.isArray(group.entries)) continue;
    const entries = group.entries.flatMap((entry) => {
      if (!isRecord(entry)) return [];
      const { id, text, type } = entry;
      if (typeof id !== 'string' || typeof text !== 'string') return [];
      return [{ id, text, type: typeof type === 'string' ? type : '' }];
    });
    groups.push({
      label: typeof group.label === 'string' ? group.label : '',
      entries,
    });
  }
  if (groups.length === 0) fail('stat catalog');
  return groups;
}

export function parseSearchResponse(body: unknown): SearchResponse {
  if (!isRecord(body)) fail('search response');
  const { id, result, total, complexity } = body;
  if (typeof id !== 'string' || !Array.isArray(result)) fail('search response');
  return {
    id,
    complexity: typeof complexity === 'number' ? complexity : null,
    result: result.filter((hash): hash is string => typeof hash === 'string'),
    total: typeof total === 'number' ? total : result.length,
  };
}

function parsePrice(value: unknown): ListingPrice | undefined {
  if (!isRecord(value)) return undefined;
  const { amount, currency, type } = value;
  if (typeof amount !== 'number' || typeof currency !== 'string') return undefined;
  return { amount, currency, type: typeof type === 'string' ? type : '' };
}

function parseListing(value: unknown): Listing | null {
  if (!isRecord(value)) return null;
  const account = isRecord(value.account) ? value.account : null;
  if (account === null || typeof account.name !== 'string') return null;

  const online = isRecord(account.online)
    ? {
        ...(typeof account.online.league === 'string'
          ? { league: account.online.league }
          : {}),
        ...(typeof account.online.status === 'string'
          ? { status: account.online.status }
          : {}),
      }
    : undefined;

  return {
    ...(typeof value.method === 'string' ? { method: value.method } : {}),
    indexed: typeof value.indexed === 'string' ? value.indexed : '',
    price: parsePrice(value.price),
    account: {
      name: account.name,
      online,
      ...(typeof account.lastCharacterName === 'string'
        ? { lastCharacterName: account.lastCharacterName }
        : {}),
    },
    ...(typeof value.whisper === 'string' ? { whisper: value.whisper } : {}),
  };
}

export function parseFetchResponse(body: unknown): FetchResponse {
  if (!isRecord(body) || !Array.isArray(body.result)) fail('listing response');
  const results: (FetchResult | null)[] = body.result.map((entry) => {
    if (!isRecord(entry)) return null;
    const listing = parseListing(entry.listing);
    if (listing === null || typeof entry.id !== 'string') return null;
    const item = isRecord(entry.item) ? entry.item : {};
    return {
      id: entry.id,
      listing,
      item: {
        ...(typeof item.name === 'string' ? { name: item.name } : {}),
        ...(typeof item.typeLine === 'string' ? { typeLine: item.typeLine } : {}),
        ...(typeof item.baseType === 'string' ? { baseType: item.baseType } : {}),
        ...(typeof item.ilvl === 'number' ? { ilvl: item.ilvl } : {}),
        ...(typeof item.corrupted === 'boolean' ? { corrupted: item.corrupted } : {}),
        ...(typeof item.identified === 'boolean' ? { identified: item.identified } : {}),
      },
    };
  });
  return { result: results };
}
