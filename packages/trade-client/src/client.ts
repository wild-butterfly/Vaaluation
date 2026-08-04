import type { League } from '@vaaluation/shared-types';
import type { FetchResult, SearchResponse, TradeQuery } from './types';
import { TradeError } from './types';
import {
  parseFetchResponse,
  parseLeagues,
  parseSearchResponse,
  parseStatGroups,
} from './validate';
import { RateLimitPolicy } from './rateLimit';
import { StatIndex } from './stats';
import { BaseTypeIndex, parseItemCatalog } from './baseTypes';
import type { CurrencyRate, ExchangeOffer } from './exchange';
import { parseExchangeResponse, summarizeBatch, summarizeRates } from './exchange';
import { parseStaticIcons } from './icons';

const BASE = 'https://www.pathofexile.com/api/trade';

/** Longest a batch caller will block waiting for rate-limit capacity. */
const MAX_WAIT_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exchange rates are cached longer than searches; they move slowly. */
const EXCHANGE_CACHE_MS = 5 * 60_000;

/** Injected so tests and the mock development mode use the same seam. */
export type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export interface TradeClientOptions {
  readonly fetch: FetchLike;
  /**
   * Identifies the app to GGG, as their developer policy requires.
   * Include a contact so they can reach the project if it misbehaves.
   */
  readonly userAgent: string;
  readonly now?: () => number;
  /** How long identical searches are reused. Defaults to 60s. */
  readonly cacheTtlMs?: number;
}

interface CacheEntry {
  readonly at: number;
  readonly value: unknown;
}

export class TradeClient {
  private readonly searchPolicy: RateLimitPolicy;
  private readonly fetchPolicy: RateLimitPolicy;
  private readonly exchangePolicy: RateLimitPolicy;
  private readonly cache = new Map<string, CacheEntry>();
  private statIndex: StatIndex | null = null;
  private baseTypeIndex: BaseTypeIndex | null = null;
  private currencyIcons: Map<string, string> | null = null;
  private readonly now: () => number;
  private readonly cacheTtlMs: number;

  constructor(private readonly options: TradeClientOptions) {
    this.now = options.now ?? Date.now;
    this.cacheTtlMs = options.cacheTtlMs ?? 60_000;
    this.searchPolicy = new RateLimitPolicy(this.now);
    this.fetchPolicy = new RateLimitPolicy(this.now);
    this.exchangePolicy = new RateLimitPolicy(this.now);
  }

  private cached<T>(key: string, ttlMs = this.cacheTtlMs): T | null {
    const entry = this.cache.get(key);
    if (entry === undefined) return null;
    if (this.now() - entry.at > ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  private store(key: string, value: unknown): void {
    this.cache.set(key, { at: this.now(), value });
  }

  private async request(
    url: string,
    init: { method?: string; body?: string } | undefined,
    policy: RateLimitPolicy,
    options: { waitForCapacity?: boolean } = {},
  ): Promise<unknown> {
    let waitMs = policy.retryAfterMs();
    if (waitMs > 0) {
      // Batch callers (the currency table) would rather wait out the window
      // than fail half their rows, so they opt into blocking. Interactive
      // callers still get an immediate, typed error.
      if (options.waitForCapacity === true && waitMs <= MAX_WAIT_MS) {
        await sleep(waitMs + 100);
        waitMs = policy.retryAfterMs();
      }
      if (waitMs > 0) {
        throw new TradeError(
          'rate_limited',
          `Rate limited by the trade API. Try again in ${Math.ceil(waitMs / 1000)}s.`,
          waitMs,
        );
      }
    }

    let response;
    try {
      response = await this.options.fetch(url, {
        ...(init?.method !== undefined ? { method: init.method } : {}),
        ...(init?.body !== undefined ? { body: init.body } : {}),
        headers: {
          'User-Agent': this.options.userAgent,
          Accept: 'application/json',
          ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
      });
    } catch (error) {
      throw new TradeError(
        'network',
        `Could not reach the trade API: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    policy.update(response.headers);

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after') ?? '60');
      const retryMs = (Number.isFinite(retryAfter) ? retryAfter : 60) * 1000;
      policy.blockUntil(this.now() + retryMs);
      throw new TradeError(
        'rate_limited',
        `Rate limited by the trade API. Try again in ${Math.ceil(retryMs / 1000)}s.`,
        retryMs,
      );
    }

    if (!response.ok) {
      // GGG returns a descriptive body; surfacing it beats a bare status code.
      let detail = '';
      try {
        const parsed: unknown = JSON.parse(await response.text());
        const message = (parsed as { error?: { message?: unknown } } | null)?.error
          ?.message;
        if (typeof message === 'string') detail = ` ${message}.`;
      } catch {
        // Body was not JSON; the status alone will have to do.
      }
      throw new TradeError(
        'http_error',
        `The trade API rejected the search (HTTP ${response.status}).${detail}`,
      );
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new TradeError('unexpected_response', 'The trade API returned invalid JSON.');
    }
  }

  async getLeagues(): Promise<League[]> {
    const key = 'leagues';
    const hit = this.cached<League[]>(key);
    if (hit !== null) return hit;

    const body = await this.request(`${BASE}/data/leagues`, undefined, this.searchPolicy);
    const leagues = parseLeagues(body);
    this.store(key, leagues);
    return leagues;
  }

  /** Loads and caches the stat catalog needed to map modifiers to stat ids. */
  async getStatIndex(): Promise<StatIndex> {
    if (this.statIndex !== null) return this.statIndex;
    const body = await this.request(`${BASE}/data/stats`, undefined, this.searchPolicy);
    this.statIndex = new StatIndex(parseStatGroups(body));
    return this.statIndex;
  }

  /** Loads and caches the catalog of searchable item base types. */
  async getBaseTypeIndex(): Promise<BaseTypeIndex> {
    if (this.baseTypeIndex !== null) return this.baseTypeIndex;
    const body = await this.request(`${BASE}/data/items`, undefined, this.searchPolicy);
    this.baseTypeIndex = new BaseTypeIndex(parseItemCatalog(body));
    return this.baseTypeIndex;
  }

  /**
   * Currency icon URLs, keyed by the same ids used for exchange queries.
   * Cached for the process: the catalog only changes between game patches.
   */
  async getCurrencyIcons(): Promise<Map<string, string>> {
    if (this.currencyIcons !== null) return this.currencyIcons;
    const body = await this.request(`${BASE}/data/static`, undefined, this.searchPolicy);
    this.currencyIcons = parseStaticIcons(body);
    return this.currencyIcons;
  }

  async search(league: string, query: TradeQuery): Promise<SearchResponse> {
    const body = JSON.stringify(query);
    const key = `search:${league}:${body}`;
    const hit = this.cached<SearchResponse>(key);
    if (hit !== null) return hit;

    const response = await this.request(
      `${BASE}/search/${encodeURIComponent(league)}`,
      { method: 'POST', body },
      this.searchPolicy,
    );
    const parsed = parseSearchResponse(response);
    this.store(key, parsed);
    return parsed;
  }

  /**
   * Bulk-exchange offers for one currency pair. Uses its own rate-limit
   * policy: the endpoint is metered separately from item search.
   */
  async exchange(
    league: string,
    give: string,
    want: string,
    options: { waitForCapacity?: boolean } = {},
  ): Promise<ExchangeOffer[]> {
    const key = `exchange:${league}:${give}:${want}`;
    // Rates move slowly, so exchange results are held far longer than a
    // search: re-opening the page should not re-spend the request budget.
    const hit = this.cached<ExchangeOffer[]>(key, EXCHANGE_CACHE_MS);
    if (hit !== null) return hit;

    const body = JSON.stringify({
      query: { status: { option: 'online' }, have: [want], want: [give] },
      sort: { have: 'asc' },
      engine: 'new',
    });
    const response = await this.request(
      `${BASE}/exchange/${encodeURIComponent(league)}`,
      { method: 'POST', body },
      this.exchangePolicy,
      options,
    );
    const offers = parseExchangeResponse(response);
    this.store(key, offers);
    return offers;
  }

  /**
   * Rates for several currencies in one request.
   *
   * Batching is what makes a table of eighteen currencies practical against an
   * endpoint capped at five requests per fifteen seconds: eighteen separate
   * calls would take roughly a minute, six batched ones take a few seconds.
   * Callers should pass currencies of comparable value — see `TrackedCurrency`
   * on why mixing tiers loses the expensive ones.
   */
  async currencyRates(
    league: string,
    gives: readonly string[],
    want = 'chaos',
    options: { waitForCapacity?: boolean } = {},
  ): Promise<Map<string, CurrencyRate>> {
    if (gives.length === 0) return new Map();

    const key = `exchange-batch:${league}:${want}:${[...gives].sort().join(',')}`;
    const hit = this.cached<ExchangeOffer[]>(key, EXCHANGE_CACHE_MS);
    if (hit !== null) return summarizeBatch(hit, want);

    const body = JSON.stringify({
      query: { status: { option: 'online' }, have: [want], want: [...gives] },
      sort: { have: 'asc' },
      engine: 'new',
    });
    const response = await this.request(
      `${BASE}/exchange/${encodeURIComponent(league)}`,
      { method: 'POST', body },
      this.exchangePolicy,
      options,
    );
    const offers = parseExchangeResponse(response);
    this.store(key, offers);
    return summarizeBatch(offers, want);
  }

  /** Median asking rate for one unit of `give`, priced in `want`. */
  async currencyRate(
    league: string,
    give: string,
    want = 'chaos',
    options: { waitForCapacity?: boolean } = {},
  ): Promise<CurrencyRate | null> {
    const offers = await this.exchange(league, give, want, options);
    return summarizeRates(offers, give, want);
  }

  /**
   * Fetches listing details. The endpoint accepts at most 10 hashes per
   * request, so callers should pass a single page.
   */
  async fetchListings(
    hashes: readonly string[],
    queryId: string,
  ): Promise<FetchResult[]> {
    if (hashes.length === 0) return [];
    const page = hashes.slice(0, 10);
    const key = `fetch:${queryId}:${page.join(',')}`;
    const hit = this.cached<FetchResult[]>(key);
    if (hit !== null) return hit;

    const body = await this.request(
      `${BASE}/fetch/${page.join(',')}?query=${encodeURIComponent(queryId)}`,
      undefined,
      this.fetchPolicy,
    );
    const results = parseFetchResponse(body).result.filter(
      (entry): entry is FetchResult => entry !== null,
    );
    this.store(key, results);
    return results;
  }
}
