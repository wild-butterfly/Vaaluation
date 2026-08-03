import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseItemText } from '@vaaluation/item-parser';
import {
  BaseTypeIndex,
  parseItemCatalog,
  RateLimitPolicy,
  StatIndex,
  TradeClient,
  TradeError,
  buildFilters,
  buildQuery,
  detectPriceWarnings,
  normalizeStatText,
  parseRules,
  parseState,
  summarize,
  toPricedListings,
  tradeSearchUrl,
} from '../src';
import type { FetchLike } from '../src';

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8'));
}

/** Minimal fetch double returning a canned body and headers. */
function stubFetch(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): { fetch: FetchLike; calls: { url: string; body?: string }[] } {
  const calls: { url: string; body?: string }[] = [];
  const headers = new Map(Object.entries(init.headers ?? {}));
  const fetch: FetchLike = async (url, options) => {
    calls.push({ url, ...(options?.body !== undefined ? { body: options.body } : {}) });
    return {
      ok: (init.status ?? 200) < 400,
      status: init.status ?? 200,
      headers: { get: (name) => headers.get(name.toLowerCase()) ?? null },
      text: async () => JSON.stringify(body),
    };
  };
  return { fetch, calls };
}

const UA = 'Vaaluation/test (contact: test@example.com)';

describe('rate limit header parsing', () => {
  it('parses the rule and state formats GGG sends', () => {
    expect(parseRules('5:10:60,15:60:300')).toEqual([
      { maxHits: 5, periodSeconds: 10, restrictionSeconds: 60 },
      { maxHits: 15, periodSeconds: 60, restrictionSeconds: 300 },
    ]);
    expect(parseState('1:10:0,2:60:0')).toEqual([
      { hits: 1, periodSeconds: 10, restrictedForSeconds: 0 },
      { hits: 2, periodSeconds: 60, restrictedForSeconds: 0 },
    ]);
  });

  it('treats missing or malformed headers as no information', () => {
    expect(parseRules(null)).toEqual([]);
    expect(parseRules('garbage')).toEqual([]);
    expect(parseState('')).toEqual([]);
  });

  it('does not block while under the limit', () => {
    const now = 1_000_000;
    const policy = new RateLimitPolicy(() => now);
    policy.update({
      get: (name) =>
        name === 'x-rate-limit-ip'
          ? '5:10:60'
          : name === 'x-rate-limit-ip-state'
            ? '1:10:0'
            : null,
    });
    expect(policy.retryAfterMs()).toBe(0);
  });

  it('blocks once a rule is exhausted, and clears when the window passes', () => {
    let now = 1_000_000;
    const policy = new RateLimitPolicy(() => now);
    policy.update({
      get: (name) =>
        name === 'x-rate-limit-ip'
          ? '5:10:60'
          : name === 'x-rate-limit-ip-state'
            ? '5:10:0'
            : null,
    });
    expect(policy.retryAfterMs()).toBe(10_000);
    now += 10_001;
    expect(policy.retryAfterMs()).toBe(0);
  });

  it('honors an active restriction reported in the state header', () => {
    const now = 1_000_000;
    const policy = new RateLimitPolicy(() => now);
    policy.update({
      get: (name) =>
        name === 'x-rate-limit-ip'
          ? '5:10:60'
          : name === 'x-rate-limit-ip-state'
            ? '5:10:60'
            : null,
    });
    expect(policy.retryAfterMs()).toBe(60_000);
  });
});

describe('TradeClient', () => {
  it('parses the real leagues response and never returns console realms', async () => {
    const { fetch } = stubFetch(fixture('leagues-response.json'));
    const client = new TradeClient({ fetch, userAgent: UA });
    const leagues = await client.getLeagues();
    expect(leagues.length).toBeGreaterThan(0);
    expect(leagues.every((league) => league.realm === 'pc')).toBe(true);
    expect(leagues.some((league) => league.id === 'Standard')).toBe(true);
  });

  it('sends the required User-Agent', async () => {
    let seenAgent: string | undefined;
    const fetch: FetchLike = async (_url, options) => {
      seenAgent = options?.headers?.['User-Agent'];
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify(fixture('leagues-response.json')),
      };
    };
    await new TradeClient({ fetch, userAgent: UA }).getLeagues();
    expect(seenAgent).toBe(UA);
  });

  it('parses the real search response', async () => {
    const { fetch, calls } = stubFetch(fixture('search-response.json'));
    const client = new TradeClient({ fetch, userAgent: UA });
    const result = await client.search('Standard', {
      query: { status: { option: 'online' }, type: 'Leather Cap', stats: [] },
      sort: { price: 'asc' },
    });
    expect(result.id).toBeTruthy();
    expect(result.total).toBeGreaterThan(0);
    expect(result.result.length).toBeGreaterThan(0);
    expect(calls[0]?.url).toContain('/search/Standard');
  });

  it('caches identical searches instead of repeating them', async () => {
    const { fetch, calls } = stubFetch(fixture('search-response.json'));
    const client = new TradeClient({ fetch, userAgent: UA });
    const query = {
      query: { status: { option: 'online' as const }, type: 'Leather Cap', stats: [] },
      sort: { price: 'asc' as const },
    };
    await client.search('Standard', query);
    await client.search('Standard', query);
    expect(calls).toHaveLength(1);
  });

  it('surfaces a typed rate-limit error with a retry delay on HTTP 429', async () => {
    const { fetch } = stubFetch({}, { status: 429, headers: { 'retry-after': '17' } });
    const client = new TradeClient({ fetch, userAgent: UA });
    await expect(
      client.search('Standard', {
        query: { status: { option: 'online' }, stats: [] },
        sort: { price: 'asc' },
      }),
    ).rejects.toMatchObject({ code: 'rate_limited', retryAfterMs: 17_000 });
  });

  it('rejects an unexpected response shape rather than guessing', async () => {
    const { fetch } = stubFetch({ nonsense: true });
    const client = new TradeClient({ fetch, userAgent: UA });
    await expect(client.getLeagues()).rejects.toBeInstanceOf(TradeError);
  });

  it('parses real listings and requests at most ten hashes', async () => {
    const { fetch, calls } = stubFetch(fixture('fetch-response.json'));
    const client = new TradeClient({ fetch, userAgent: UA });
    const hashes = Array.from({ length: 25 }, (_, i) => `hash${i}`);
    const results = await client.fetchListings(hashes, 'QUERYID');
    expect(results.length).toBeGreaterThan(0);
    expect(calls[0]?.url).toContain('hash9');
    expect(calls[0]?.url).not.toContain('hash10');
    expect(calls[0]?.url).toContain('query=QUERYID');
  });
});

describe('stat mapping', () => {
  it('normalizes rolled values to catalog placeholders', () => {
    expect(normalizeStatText('+18 to maximum Life')).toBe('+# to maximum Life');
    expect(normalizeStatText('Adds 5 to 9 Physical Damage')).toBe(
      'Adds # to # Physical Damage',
    );
  });

  it('matches a parsed modifier to its stat id, preferring the right group', () => {
    const index = new StatIndex([
      {
        label: 'Explicit',
        entries: [
          { id: 'explicit.stat_life', text: '+# to maximum Life', type: 'explicit' },
        ],
      },
      {
        label: 'Implicit',
        entries: [
          { id: 'implicit.stat_life', text: '+# to maximum Life', type: 'implicit' },
        ],
      },
    ]);

    expect(index.match({ text: '+18 to maximum Life', type: 'explicit' })).toMatchObject({
      id: 'explicit.stat_life',
      values: [18],
    });
    expect(index.match({ text: '+31 to maximum Life', type: 'implicit' })).toMatchObject({
      id: 'implicit.stat_life',
    });
    expect(index.match({ text: 'Some unknown modifier', type: 'explicit' })).toBeNull();
  });
});

describe('query building', () => {
  const index = new StatIndex([
    {
      label: 'Explicit',
      entries: [
        { id: 'explicit.stat_life', text: '+# to maximum Life', type: 'explicit' },
        { id: 'explicit.stat_cold', text: '+#% to Cold Resistance', type: 'explicit' },
        { id: 'explicit.stat_int', text: '+# to Intelligence', type: 'explicit' },
      ],
    },
  ]);

  function parseFixtureItem(name: string) {
    const raw = readFileSync(
      join(__dirname, '..', '..', 'item-parser', 'test', 'fixtures', name),
      'utf8',
    );
    const result = parseItemText(raw);
    if (!result.ok) throw new Error('fixture failed to parse');
    return result.item;
  }

  it('preselects only a few high-signal modifiers for a rare', () => {
    const item = parseFixtureItem('rare-advanced-mod-descriptions.txt');
    const filters = buildFilters(item, index);
    const selected = filters.filter((filter) => filter.selected);
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.length).toBeLessThanOrEqual(3);
    expect(selected[0]?.label).toContain('maximum Life');
    // The rolled value becomes the minimum, which is the usual intent.
    expect(selected[0]?.min).toBe(18);
  });

  it('searches a unique by name and base type', () => {
    const item = parseFixtureItem('unique-belt.txt');
    const query = buildQuery(item, []);
    expect(query.query).toMatchObject({ name: 'Headhunter', type: 'Leather Belt' });
  });

  it('omits the name for an unidentified item', () => {
    const item = parseFixtureItem('rare-unidentified.txt');
    const query = buildQuery(item, []);
    expect(query.query.name).toBeUndefined();
    expect(query.query.type).toBe('Astral Plate');
  });

  it('searches currency and divination cards by name', () => {
    expect(buildQuery(parseFixtureItem('currency-divine-orb.txt'), []).query.type).toBe(
      'Divine Orb',
    );
    expect(buildQuery(parseFixtureItem('divination-card.txt'), []).query.type).toBe(
      'The Doctor',
    );
  });

  it('includes selected filters with their bounds', () => {
    const item = parseFixtureItem('rare-advanced-mod-descriptions.txt');
    const filters = buildFilters(item, index).map((filter) =>
      filter.label.includes('Cold Resistance')
        ? { ...filter, selected: true, min: 20, max: 40 }
        : { ...filter, selected: false },
    );
    const query = buildQuery(item, filters);
    expect(query.query.stats[0]?.filters).toEqual([
      { id: 'explicit.stat_cold', value: { min: 20, max: 40 } },
    ]);
  });

  it('builds the official trade page URL', () => {
    expect(tradeSearchUrl('Hardcore Allflame', 'abc123')).toBe(
      'https://www.pathofexile.com/trade/search/Hardcore%20Allflame/abc123',
    );
  });
});

describe('pricing', () => {
  const listing = (
    amount: number,
    accountName: string,
    currency = 'chaos',
    online: 'online' | 'afk' | 'offline' = 'online',
  ) => ({
    id: `${accountName}-${amount}`,
    amount,
    currency,
    accountName,
    presence: online,
    indexed: '2026-07-26T13:39:12Z',
  });

  it('converts real fetch results into priced listings with presence', () => {
    const parsed = fixture('fetch-response.json') as {
      result: { listing: { account: { online?: unknown } } }[];
    };
    const listings = toPricedListings(
      // Reuse the client's validator via a round trip through the module.
      parsed.result.map((entry) => entry as never),
    );
    expect(listings.length).toBeGreaterThan(0);
    expect(['online', 'afk', 'offline']).toContain(listings[0]?.presence);
  });

  it('summarizes the dominant currency only', () => {
    const summary = summarize([
      listing(1, 'a'),
      listing(3, 'b'),
      listing(5, 'c'),
      listing(100, 'd', 'divine'),
    ]);
    expect(summary).toEqual({ currency: 'chaos', count: 3, min: 1, median: 3, max: 5 });
  });

  it('returns no summary when there are no listings', () => {
    expect(summarize([])).toBeNull();
  });

  it('warns when one account holds most cheap listings', () => {
    const warnings = detectPriceWarnings([
      listing(1, 'flipper'),
      listing(1, 'flipper'),
      listing(1, 'flipper'),
      listing(9, 'someone'),
    ]);
    expect(warnings.some((warning) => warning.kind === 'single-seller')).toBe(true);
  });

  it('warns on an identical-price cluster from very few sellers', () => {
    const warnings = detectPriceWarnings([
      listing(1, 'a'),
      listing(1, 'a'),
      listing(1, 'b'),
      listing(1, 'b'),
      listing(50, 'c'),
    ]);
    expect(warnings.some((warning) => warning.kind === 'cluster')).toBe(true);
  });

  it('stays quiet for an ordinary spread of prices', () => {
    const warnings = detectPriceWarnings([
      listing(1, 'a'),
      listing(2, 'b'),
      listing(4, 'c'),
      listing(9, 'd'),
      listing(20, 'e'),
    ]);
    expect(warnings).toEqual([]);
  });
});

describe('base type resolution', () => {
  const index = new BaseTypeIndex(parseItemCatalog(fixture('items-response.json')));

  it('loads base types from the official catalog', () => {
    expect(index.size).toBeGreaterThan(0);
    expect(index.isKnown('Greater Mana Flask')).toBe(true);
    expect(index.isKnown('Nitrate Greater Mana Flask')).toBe(false);
  });

  it('strips affixes from a magic item name', () => {
    // The exact case that returned HTTP 400 "Unknown item base type".
    expect(index.resolve('Nitrate Greater Mana Flask')).toBe('Greater Mana Flask');
  });

  it('prefers the longest matching base type', () => {
    // "Mana Flask" is also a real base; the longer one must win.
    expect(index.resolve('Chemist’s Greater Mana Flask of Heat')).toBe(
      'Greater Mana Flask',
    );
  });

  it('passes through an exact base type unchanged', () => {
    expect(index.resolve('Leather Belt')).toBe('Leather Belt');
  });

  it('returns null when nothing matches', () => {
    expect(index.resolve('Completely Invented Item')).toBeNull();
  });

  it('builds a query with the resolved base type', () => {
    const raw = readFileSync(
      join(__dirname, '..', '..', 'item-parser', 'test', 'fixtures', 'magic-flask.txt'),
      'utf8',
    );
    const parsed = parseItemText(raw);
    if (!parsed.ok) throw new Error('fixture failed to parse');
    const query = buildQuery(parsed.item, [], { baseTypes: index });
    expect(query.query.type).toBe('Silver Flask');
  });

  it('fails with a clear message instead of sending an unknown base type', () => {
    const parsed = parseItemText(
      'Item Class: Rings\nRarity: Magic\nMade Up Widget of Nonsense\n--------\nItem Level: 5',
    );
    if (!parsed.ok) throw new Error('fixture failed to parse');
    expect(() => buildQuery(parsed.item, [], { baseTypes: index })).toThrow(
      /not a base type/,
    );
  });

  it('surfaces the API error message on a rejected search', async () => {
    const { fetch } = stubFetch(
      { error: { code: 2, message: 'Unknown item base type' } },
      { status: 400 },
    );
    const client = new TradeClient({ fetch, userAgent: UA });
    await expect(
      client.search('Standard', {
        query: { status: { option: 'online' }, stats: [] },
        sort: { price: 'asc' },
      }),
    ).rejects.toThrow(/Unknown item base type/);
  });
});
