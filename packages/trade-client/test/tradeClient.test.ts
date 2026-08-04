import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseItemText } from '@vaaluation/item-parser';
import {
  BaseTypeIndex,
  parseItemCatalog,
  parseExchangeResponse,
  offerRate,
  summarizeRates,
  summarizeBatch,
  distribution,
  convertRate,
  currencyBatches,
  TRACKED_CURRENCIES,
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

describe('currency exchange', () => {
  const offers = parseExchangeResponse(fixture('exchange-response.json'));

  it('reads offers from the real exchange response', () => {
    expect(offers.length).toBeGreaterThan(0);
    const first = offers[0];
    expect(first?.giveCurrency).toBe('divine');
    expect(first?.wantCurrency).toBe('chaos');
    expect(first?.wantAmount).toBeGreaterThan(0);
  });

  it('computes the rate as want per single unit given', () => {
    expect(
      offerRate({
        wantCurrency: 'chaos',
        wantAmount: 175,
        giveCurrency: 'divine',
        giveAmount: 1,
        stock: 3,
        accountName: 'x',
        online: true,
      }),
    ).toBe(175);

    // A bundle price must normalize to one unit.
    expect(
      offerRate({
        wantCurrency: 'chaos',
        wantAmount: 350,
        giveCurrency: 'divine',
        giveAmount: 2,
        stock: 1,
        accountName: 'x',
        online: true,
      }),
    ).toBe(175);
  });

  it('refuses to divide by a zero quantity', () => {
    expect(
      offerRate({
        wantCurrency: 'chaos',
        wantAmount: 10,
        giveCurrency: 'divine',
        giveAmount: 0,
        stock: 0,
        accountName: 'x',
        online: true,
      }),
    ).toBeNull();
  });

  it('summarizes with a median that resists outliers', () => {
    const make = (want: number, give = 1) => ({
      wantCurrency: 'chaos',
      wantAmount: want,
      giveCurrency: 'divine',
      giveAmount: give,
      stock: 1,
      accountName: 'x',
      online: true,
    });
    const summary = summarizeRates(
      [make(170), make(175), make(180), make(1)],
      'divine',
      'chaos',
    );
    expect(summary).toMatchObject({ give: 'divine', want: 'chaos', sampleSize: 4 });
    expect(summary?.median).toBe(172.5);
    expect(summary?.low).toBe(1);
    expect(summary?.high).toBe(180);
  });

  it('returns no rate when there is nothing to summarize', () => {
    expect(summarizeRates([], 'divine', 'chaos')).toBeNull();
  });

  it('summarizes the real fixture into a plausible rate', () => {
    const summary = summarizeRates(offers, 'divine', 'chaos');
    expect(summary).not.toBeNull();
    expect(summary?.median).toBeGreaterThan(0);
    expect(summary?.low).toBeLessThanOrEqual(summary?.median ?? 0);
    expect(summary?.high).toBeGreaterThanOrEqual(summary?.median ?? 0);
  });
});

describe('bulk-weighted rates', () => {
  const offer = (want: number, give: number) => ({
    wantCurrency: 'chaos',
    wantAmount: want,
    giveCurrency: 'transmute',
    giveAmount: give,
    stock: give,
    accountName: 'x',
    online: true,
  });

  it('lets real bulk offers outvote one-unit novelty listings', () => {
    // The shape seen live: a few sellers moving hundreds at the market rate,
    // and a crowd of single-orb listings asking absurd prices. By count the
    // novelties win; by volume they are a rounding error.
    const novelties = Array.from({ length: 10 }, () => offer(10, 1));
    const bulk = [offer(10, 400), offer(20, 160)];

    const summary = summarizeRates([...novelties, ...bulk], 'transmute', 'chaos');
    expect(summary?.median).toBeLessThan(0.2);
  });

  it('leaves evenly sized offers on their plain median', () => {
    // Nobody bulk-lists divines in stacks of four hundred, so weighting must
    // not disturb currencies whose offers are all of comparable size.
    const summary = summarizeRates(
      [offer(170, 1), offer(175, 1), offer(180, 1), offer(185, 1)],
      'divine',
      'chaos',
    );
    expect(summary?.median).toBe(177.5);
  });

  it('still reports the full spread, not the weighted window', () => {
    const summary = summarizeRates([offer(10, 400), offer(100, 1)], 'transmute', 'chaos');
    expect(summary?.low).toBe(0.025);
    expect(summary?.high).toBe(100);
    expect(summary?.sampleSize).toBe(2);
  });
});

describe('batched currency fetching', () => {
  it('never mixes value tiers within a batch', () => {
    // The whole point of banding: a cheap currency in with an expensive one
    // fills the single result page and starves the expensive one.
    const tierOf = new Map(TRACKED_CURRENCIES.map((entry) => [entry.id, entry.tier]));
    for (const batch of currencyBatches()) {
      const tiers = new Set(batch.map((id) => tierOf.get(id)));
      expect(tiers.size).toBe(1);
    }
  });

  it('covers every tracked currency exactly once', () => {
    const flat = currencyBatches().flat();
    expect([...flat].sort()).toEqual([...TRACKED_CURRENCIES.map((e) => e.id)].sort());
  });

  it('honours the batch size', () => {
    for (const batch of currencyBatches(2)) {
      expect(batch.length).toBeLessThanOrEqual(2);
    }
  });

  it('splits a mixed response into one rate per currency', () => {
    const make = (give: string, want: number) => ({
      wantCurrency: 'chaos',
      wantAmount: want,
      giveCurrency: give,
      giveAmount: 1,
      stock: 1,
      accountName: 'x',
      online: true,
    });
    const rates = summarizeBatch(
      [make('divine', 170), make('divine', 180), make('exalted', 12)],
      'chaos',
    );

    expect(rates.get('divine')?.median).toBe(175);
    expect(rates.get('divine')?.sampleSize).toBe(2);
    expect(rates.get('exalted')?.median).toBe(12);
    expect(rates.get('mirror')).toBeUndefined();
  });
});

describe('price distribution', () => {
  const listing = (amount: number, currency = 'chaos') => ({
    id: `l${amount}${currency}`,
    amount,
    currency,
    accountName: 'seller',
    presence: 'online' as const,
    indexed: '2026-08-03T00:00:00Z',
  });

  it('reports percentiles and buckets over the dominant currency', () => {
    const amounts = [18, 20, 25, 30, 35, 40, 42, 45, 60, 80, 100, 140];
    const result = distribution(
      amounts.map((a) => listing(a)),
      14,
    );
    expect(result).not.toBeNull();
    if (result === null) return;

    expect(result.currency).toBe('chaos');
    expect(result.count).toBe(amounts.length);
    expect(result.min).toBe(18);
    expect(result.max).toBe(140);
    expect(result.p10).toBeLessThan(result.median);
    expect(result.median).toBeLessThan(result.p90);
    expect(result.buckets).toHaveLength(14);
    // Every listing lands in exactly one bucket.
    expect(result.buckets.reduce((sum, n) => sum + n, 0)).toBe(amounts.length);
    expect(result.medianBucket).toBeGreaterThanOrEqual(0);
    expect(result.medianBucket).toBeLessThan(14);
  });

  it('handles a single listing without dividing by zero', () => {
    const result = distribution([listing(42)], 14);
    expect(result).toMatchObject({ min: 42, max: 42, median: 42, medianBucket: 0 });
    expect(result?.buckets[0]).toBe(1);
  });

  it('ignores listings in other currencies', () => {
    const result = distribution([listing(10), listing(12), listing(500, 'divine')]);
    expect(result?.currency).toBe('chaos');
    expect(result?.count).toBe(2);
    expect(result?.max).toBe(12);
  });

  it('returns nothing when there is nothing priced', () => {
    expect(distribution([])).toBeNull();
  });
});

describe('denomination conversion', () => {
  const rate = (give: string, median: number, n = 20) => ({
    give,
    want: 'chaos',
    median,
    low: median * 0.9,
    high: median * 1.1,
    sampleSize: n,
  });

  it('returns chaos rates untouched', () => {
    const divine = rate('divine', 200);
    expect(convertRate(divine, null, 'chaos')).toBe(divine);
  });

  it('re-expresses a rate in another currency', () => {
    // 200 chaos per divine, 10 chaos per exalted → 20 exalted per divine.
    const converted = convertRate(rate('divine', 200), rate('exalted', 10), 'exalted');
    expect(converted).toMatchObject({ give: 'divine', want: 'exalted', median: 20 });
    expect(converted?.low).toBeCloseTo(18);
    expect(converted?.high).toBeCloseTo(22);
  });

  it('reports the weaker sample size of the two measurements', () => {
    const converted = convertRate(
      rate('divine', 200, 30),
      rate('exalted', 10, 7),
      'exalted',
    );
    expect(converted?.sampleSize).toBe(7);
  });

  it('cannot convert without a denominator rate', () => {
    expect(convertRate(rate('divine', 200), null, 'exalted')).toBeNull();
  });

  it('refuses to divide by a zero rate', () => {
    expect(convertRate(rate('divine', 200), rate('exalted', 0), 'exalted')).toBeNull();
  });
});
