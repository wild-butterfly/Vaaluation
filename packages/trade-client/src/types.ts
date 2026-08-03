/**
 * Shapes returned by the Path of Exile trade endpoints
 * (`www.pathofexile.com/api/trade/*`).
 *
 * These endpoints are not covered by GGG's published developer documentation,
 * so every response is validated at the boundary (see `validate.ts`). If the
 * upstream shape changes, requests fail loudly with a typed error instead of
 * producing wrong prices.
 */

export interface TradeStatEntry {
  readonly id: string;
  /** Display text with `#` placeholders, e.g. "+# to maximum Life". */
  readonly text: string;
  readonly type: string;
}

export interface TradeStatGroup {
  readonly label: string;
  readonly entries: readonly TradeStatEntry[];
}

export interface SearchResponse {
  /** Query id used to build the trade site URL and to fetch results. */
  readonly id: string;
  readonly complexity: number | null;
  /** Result hashes, most relevant first for the requested sort. */
  readonly result: readonly string[];
  readonly total: number;
}

export interface ListingPrice {
  readonly type: string;
  readonly amount: number;
  readonly currency: string;
}

export interface ListingAccountOnline {
  readonly league?: string;
  /** Present and equal to "afk" when the seller is online but away. */
  readonly status?: string;
}

export interface ListingAccount {
  readonly name: string;
  readonly online?: ListingAccountOnline | undefined;
  readonly lastCharacterName?: string;
}

export interface Listing {
  readonly method?: string;
  /** ISO timestamp of when the listing was last indexed. */
  readonly indexed: string;
  readonly price?: ListingPrice | undefined;
  readonly account: ListingAccount;
  readonly whisper?: string;
}

export interface FetchResultItem {
  readonly name?: string;
  readonly typeLine?: string;
  readonly baseType?: string;
  readonly ilvl?: number;
  readonly corrupted?: boolean;
  readonly identified?: boolean;
}

export interface FetchResult {
  readonly id: string;
  readonly listing: Listing;
  readonly item: FetchResultItem;
}

export interface FetchResponse {
  readonly result: readonly (FetchResult | null)[];
}

/** A single stat filter in a search query. */
export interface StatFilter {
  readonly id: string;
  readonly disabled?: boolean;
  readonly value?: { min?: number; max?: number };
}

export interface TradeQuery {
  readonly query: {
    readonly status: { readonly option: 'online' | 'onlineleague' | 'any' };
    readonly name?: string;
    readonly type?: string;
    readonly stats: ReadonlyArray<{
      readonly type: 'and';
      readonly filters: readonly StatFilter[];
    }>;
    readonly filters?: Record<string, unknown>;
  };
  readonly sort: { readonly price: 'asc' };
}

export type TradeErrorCode =
  'rate_limited' | 'network' | 'unexpected_response' | 'not_searchable' | 'http_error';

export class TradeError extends Error {
  constructor(
    readonly code: TradeErrorCode,
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'TradeError';
  }
}
