/**
 * Currency exchange rates from the official bulk-exchange endpoint
 * (`POST /api/trade/exchange/{league}`).
 *
 * Rates are derived from what sellers are currently *asking*, not from
 * completed sales — the trade site does not publish sale data. A median of
 * the cheapest live offers is the closest honest approximation, and it is
 * presented as such rather than as a definitive price.
 */

export interface ExchangeOffer {
  /** What the seller wants, e.g. 175 chaos. */
  readonly wantCurrency: string;
  readonly wantAmount: number;
  /** What the seller gives, e.g. 1 divine. */
  readonly giveCurrency: string;
  readonly giveAmount: number;
  /** Units of the seller's stock available. */
  readonly stock: number;
  readonly accountName: string;
  readonly online: boolean;
}

/** Units of `wantCurrency` per single unit of `giveCurrency`. */
export function offerRate(offer: ExchangeOffer): number | null {
  if (offer.giveAmount <= 0) return null;
  return offer.wantAmount / offer.giveAmount;
}

export interface CurrencyRate {
  readonly give: string;
  readonly want: string;
  /** Median rate across the sampled offers. */
  readonly median: number;
  readonly low: number;
  readonly high: number;
  readonly sampleSize: number;
}

/**
 * Summarizes offers into a rate. The median resists the outliers that a
 * handful of unrealistic listings would otherwise introduce.
 */
export function summarizeRates(
  offers: readonly ExchangeOffer[],
  give: string,
  want: string,
): CurrencyRate | null {
  const rates = offers
    .map(offerRate)
    .filter((rate): rate is number => rate !== null && Number.isFinite(rate) && rate > 0)
    .sort((a, b) => a - b);

  if (rates.length === 0) return null;

  const mid = Math.floor(rates.length / 2);
  const median =
    rates.length % 2 === 0
      ? ((rates[mid - 1] as number) + (rates[mid] as number)) / 2
      : (rates[mid] as number);

  return {
    give,
    want,
    median,
    low: rates[0] as number,
    high: rates[rates.length - 1] as number,
    sampleSize: rates.length,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads the exchange response into offers, ignoring anything malformed. */
export function parseExchangeResponse(body: unknown): ExchangeOffer[] {
  if (!isRecord(body) || !isRecord(body.result)) return [];
  const offers: ExchangeOffer[] = [];

  for (const entry of Object.values(body.result)) {
    if (!isRecord(entry) || !isRecord(entry.listing)) continue;
    const listing = entry.listing;
    const account = isRecord(listing.account) ? listing.account : null;
    const accountName = typeof account?.name === 'string' ? account.name : '';
    const online = isRecord(account?.online);

    if (!Array.isArray(listing.offers)) continue;
    for (const raw of listing.offers) {
      if (!isRecord(raw)) continue;
      const want = isRecord(raw.exchange) ? raw.exchange : null;
      const give = isRecord(raw.item) ? raw.item : null;
      if (want === null || give === null) continue;
      if (
        typeof want.currency !== 'string' ||
        typeof want.amount !== 'number' ||
        typeof give.currency !== 'string' ||
        typeof give.amount !== 'number'
      ) {
        continue;
      }
      offers.push({
        wantCurrency: want.currency,
        wantAmount: want.amount,
        giveCurrency: give.currency,
        giveAmount: give.amount,
        stock: typeof give.stock === 'number' ? give.stock : 0,
        accountName,
        online,
      });
    }
  }
  return offers;
}

/**
 * Currencies worth showing a chaos rate for, in the order players usually
 * think about them. Deliberately short: each entry costs one request, and the
 * endpoint is rate limited.
 */
export interface CurrencyDef {
  readonly id: string;
  readonly label: string;
  /** Short form used in the denomination picker. */
  readonly short: string;
}

/** Currencies a rate can be quoted in. */
export const DENOMINATIONS: readonly CurrencyDef[] = [
  { id: 'chaos', label: 'Chaos Orb', short: 'Chaos' },
  { id: 'divine', label: 'Divine Orb', short: 'Divine' },
  { id: 'exalted', label: 'Exalted Orb', short: 'Exalted' },
  { id: 'alch', label: 'Orb of Alchemy', short: 'Alch' },
];

export const TRACKED_CURRENCIES: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'divine', label: 'Divine Orb' },
  { id: 'exalted', label: 'Exalted Orb' },
  { id: 'mirror', label: 'Mirror of Kalandra' },
  { id: 'annul', label: 'Orb of Annulment' },
  { id: 'regal', label: 'Regal Orb' },
  { id: 'alch', label: 'Orb of Alchemy' },
  { id: 'vaal', label: 'Vaal Orb' },
  { id: 'fusing', label: 'Orb of Fusing' },
];

/**
 * Re-expresses chaos-denominated rates in another currency.
 *
 * Deriving beats querying the pair directly for two reasons: switching
 * denomination costs no additional requests against a tightly metered
 * endpoint, and thin pairs (divine↔exalted has few direct bulk offers) would
 * otherwise show nothing at all. The tradeoff is that error in the
 * denominator's own rate propagates, so the sample size shown stays that of
 * the weaker of the two measurements.
 */
export function convertRate(
  rate: CurrencyRate,
  denominatorChaosRate: CurrencyRate | null,
  denomination: string,
): CurrencyRate | null {
  if (denomination === 'chaos') return rate;
  if (denominatorChaosRate === null || denominatorChaosRate.median <= 0) return null;

  const divisor = denominatorChaosRate.median;
  return {
    give: rate.give,
    want: denomination,
    median: rate.median / divisor,
    low: rate.low / divisor,
    high: rate.high / divisor,
    sampleSize: Math.min(rate.sampleSize, denominatorChaosRate.sampleSize),
  };
}
