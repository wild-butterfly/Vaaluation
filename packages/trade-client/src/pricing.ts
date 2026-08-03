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
