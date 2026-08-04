import type { FetchResult } from './types';

/**
 * Summarizes a page of listings.
 *
 * Deliberately does NOT claim a valuation: the trade site lists asking
 * prices, not sales, so we report what comparable sellers are asking and
 * leave judgement to the user.
 */

export interface PricedListing {
  readonly id: string;
  readonly amount: number;
  readonly currency: string;
  readonly accountName: string;
  /** 'online' | 'afk' | 'offline' */
  readonly presence: 'online' | 'afk' | 'offline';
  readonly indexed: string;
  /** Item level, where the listing reports one. */
  readonly ilvl?: number | undefined;
  readonly whisper?: string | undefined;
}

export function toPricedListings(results: readonly FetchResult[]): PricedListing[] {
  const listings: PricedListing[] = [];
  for (const result of results) {
    const price = result.listing.price;
    if (price === undefined) continue;
    const online = result.listing.account.online;
    listings.push({
      id: result.id,
      amount: price.amount,
      currency: price.currency,
      accountName: result.listing.account.name,
      presence:
        online === undefined ? 'offline' : online.status === 'afk' ? 'afk' : 'online',
      indexed: result.listing.indexed,
      ilvl: result.item.ilvl,
      whisper: result.listing.whisper,
    });
  }
  return listings;
}

export interface PriceSummary {
  readonly currency: string;
  readonly count: number;
  readonly min: number;
  readonly median: number;
  readonly max: number;
}

/**
 * Summarizes only the most common currency in the page; mixing currencies
 * without exchange rates would produce a meaningless number.
 */
export function summarize(listings: readonly PricedListing[]): PriceSummary | null {
  if (listings.length === 0) return null;

  const counts = new Map<string, number>();
  for (const listing of listings) {
    counts.set(listing.currency, (counts.get(listing.currency) ?? 0) + 1);
  }
  let currency = '';
  let best = 0;
  for (const [name, count] of counts) {
    if (count > best) {
      best = count;
      currency = name;
    }
  }

  const amounts = listings
    .filter((listing) => listing.currency === currency)
    .map((listing) => listing.amount)
    .sort((a, b) => a - b);

  if (amounts.length === 0) return null;
  const mid = Math.floor(amounts.length / 2);
  const median =
    amounts.length % 2 === 0
      ? ((amounts[mid - 1] as number) + (amounts[mid] as number)) / 2
      : (amounts[mid] as number);

  return {
    currency,
    count: amounts.length,
    min: amounts[0] as number,
    median,
    max: amounts[amounts.length - 1] as number,
  };
}

export interface PriceWarning {
  readonly kind: 'cluster' | 'single-seller';
  readonly message: string;
}

/**
 * Flags listing patterns that make the cheapest price misleading — a handful
 * of identical low prices, or one account holding most of them. This is a
 * caution to look closer, not an accusation.
 */
export function detectPriceWarnings(listings: readonly PricedListing[]): PriceWarning[] {
  const warnings: PriceWarning[] = [];
  if (listings.length < 4) return warnings;

  const cheapest = listings.slice(0, Math.min(5, listings.length));

  const bySeller = new Map<string, number>();
  for (const listing of cheapest) {
    bySeller.set(listing.accountName, (bySeller.get(listing.accountName) ?? 0) + 1);
  }
  for (const [, count] of bySeller) {
    if (count >= 3) {
      warnings.push({
        kind: 'single-seller',
        message:
          'One account holds most of the cheapest listings, so the lowest price may not be broadly available.',
      });
      break;
    }
  }

  const first = cheapest[0];
  if (first !== undefined) {
    const identical = cheapest.filter(
      (listing) => listing.currency === first.currency && listing.amount === first.amount,
    );
    if (identical.length >= 4) {
      const sellers = new Set(identical.map((listing) => listing.accountName));
      if (sellers.size <= 2) {
        warnings.push({
          kind: 'cluster',
          message:
            'Several of the cheapest listings share one price from very few sellers, a pattern often seen with price fixing.',
        });
      }
    }
  }

  return warnings;
}

export interface PriceDistribution {
  readonly currency: string;
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly p10: number;
  readonly median: number;
  readonly p90: number;
  /** Bucket counts across the min–max range, for the histogram. */
  readonly buckets: readonly number[];
  /** Index of the bucket the median falls in, for highlighting. */
  readonly medianBucket: number;
}

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0] as number;
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower] as number;
  if (lower === upper) return low;
  const high = sorted[upper] as number;
  return low + (high - low) * (position - lower);
}

/**
 * Distribution of asking prices for the histogram and percentile labels.
 *
 * Only the dominant currency is used: mixing currencies without exchange
 * rates would produce a meaningless shape.
 */
export function distribution(
  listings: readonly PricedListing[],
  bucketCount = 14,
): PriceDistribution | null {
  const summary = summarize(listings);
  if (summary === null) return null;

  const amounts = listings
    .filter((listing) => listing.currency === summary.currency)
    .map((listing) => listing.amount)
    .sort((a, b) => a - b);

  if (amounts.length === 0) return null;

  const min = amounts[0] as number;
  const max = amounts[amounts.length - 1] as number;
  const buckets = new Array<number>(bucketCount).fill(0);
  const span = max - min;

  for (const amount of amounts) {
    // A flat series collapses into the first bucket rather than dividing by 0.
    const index =
      span === 0
        ? 0
        : Math.min(bucketCount - 1, Math.floor(((amount - min) / span) * bucketCount));
    buckets[index] = (buckets[index] ?? 0) + 1;
  }

  const median = percentile(amounts, 0.5);
  const medianBucket =
    span === 0
      ? 0
      : Math.min(bucketCount - 1, Math.floor(((median - min) / span) * bucketCount));

  return {
    currency: summary.currency,
    count: amounts.length,
    min,
    max,
    p10: percentile(amounts, 0.1),
    median,
    p90: percentile(amounts, 0.9),
    buckets,
    medianBucket,
  };
}

/**
 * How long ago a listing went up, in the compact form trade tools use ("6h",
 * "10d", "4mo").
 *
 * Age is the single best staleness signal the trade site gives: a four-month-
 * old listing at a tempting price is usually someone who quit, not an offer
 * anyone will honour. Precision past the leading unit is noise here, so only
 * the largest unit is shown.
 */
export function listingAge(indexed: string, now: number = Date.now()): string {
  const then = Date.parse(indexed);
  if (Number.isNaN(then)) return '';

  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;

  return `${Math.round(months / 12)}y`;
}

/**
 * Every listing, cheapest first, each keeping the currency its seller chose.
 *
 * Prices are never converted for display. Orbs are indivisible, so restating
 * a one-chaos listing against an exalted rate produced "0.5 ex" — a price no
 * seller is asking and nobody could pay. Rates are used only to order rows
 * against each other, which is a comparison rather than a claim.
 *
 * @param chaosRates chaos per one unit of each currency; chaos is implicit.
 */
export function byAskingPrice(
  listings: readonly PricedListing[],
  chaosRates: ReadonlyMap<string, number> = new Map(),
): PricedListing[] {
  const chaosValue = (listing: PricedListing): number => {
    if (listing.currency === 'chaos') return listing.amount;
    const rate = chaosRates.get(listing.currency);
    // Without a rate there is no honest place for the row, so it sorts last
    // rather than being dropped: the listing is still real.
    if (rate === undefined || rate <= 0) return Number.POSITIVE_INFINITY;
    return listing.amount * rate;
  };

  return [...listings].sort((a, b) => chaosValue(a) - chaosValue(b));
}

export interface PriceQuote {
  readonly amount: number;
  readonly currency: string;
}

/**
 * Formats a currency amount the way players say it.
 *
 * Prices in Path of Exile are whole orbs, so a trailing ".0" is noise that
 * makes a plain two-chaos item read like a measurement. Fractions are kept
 * only where they carry meaning — a divine is worth hundreds of chaos, so
 * "1.3 divine" is a real distinction, while "2.0 chaos" is not.
 */
export function formatAmount(value: number): string {
  if (value >= 10) return String(Math.round(value));
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(/\.0$/, '');
}

/**
 * Re-expresses a chaos price in the larger currencies a player would name
 * instead, cheapest-sounding first.
 *
 * Nobody quotes six hundred chaos; they say three divine. A currency is only
 * offered when the price reaches one whole unit of it, since "0.4 divine" is
 * a worse way of saying the same thing than the chaos figure already shown.
 *
 * @param chaosRates chaos per one unit of each currency.
 */
export function quoteAlternatives(
  chaosAmount: number,
  chaosRates: ReadonlyMap<string, number>,
): PriceQuote[] {
  const quotes: PriceQuote[] = [];
  for (const [currency, rate] of chaosRates) {
    if (rate <= 0) continue;
    const amount = chaosAmount / rate;
    if (amount < 1) continue;
    quotes.push({ amount, currency });
  }
  // Ascending by count, so the largest currency — the shortest way to say the
  // price — comes first.
  return quotes.sort((a, b) => a.amount - b.amount);
}
