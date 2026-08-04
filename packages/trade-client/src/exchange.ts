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
 * Summarizes offers into a rate: the median rate, weighted by how many units
 * each offer actually puts on the table.
 *
 * Weighting matters because this is the *bulk* exchange, where offer sizes
 * differ by orders of magnitude. Half the Orb of Transmutation listings are
 * one-orb novelties asking ten chaos apiece, so an unweighted median priced a
 * transmute at eight chaos — several hundred times what the real bulk sellers,
 * offering four hundred at a time, were asking. Counting an offer of four
 * hundred orbs as more of the market than an offer of one corrects that
 * without discarding anything, and leaves the expensive currencies untouched:
 * Divine Orb prices identically either way, because nobody bulk-lists divines
 * in stacks of four hundred.
 */
export function summarizeRates(
  offers: readonly ExchangeOffer[],
  give: string,
  want: string,
): CurrencyRate | null {
  const weighted = offers
    .map((offer) => ({ rate: offerRate(offer), weight: offer.giveAmount }))
    .filter(
      (entry): entry is { rate: number; weight: number } =>
        entry.rate !== null &&
        Number.isFinite(entry.rate) &&
        entry.rate > 0 &&
        entry.weight > 0,
    )
    .sort((a, b) => a.rate - b.rate);

  if (weighted.length === 0) return null;

  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const half = total / 2;

  let seen = 0;
  let median = weighted[weighted.length - 1]?.rate ?? 0;
  for (let index = 0; index < weighted.length; index += 1) {
    const entry = weighted[index] as { rate: number; weight: number };
    seen += entry.weight;
    if (seen > half) {
      median = entry.rate;
      break;
    }
    // Landing exactly on the halfway mark leaves two offers equally central,
    // so neither gets to claim the answer alone.
    if (seen === half) {
      const next = weighted[index + 1];
      median = next === undefined ? entry.rate : (entry.rate + next.rate) / 2;
      break;
    }
  }

  return {
    give,
    want,
    median,
    // The range stays that of the whole sample: it is what tells the reader
    // how much disagreement there is between sellers.
    low: weighted[0]?.rate ?? median,
    high: weighted[weighted.length - 1]?.rate ?? median,
    sampleSize: weighted.length,
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

/**
 * Currencies a rate can be quoted in. Any tracked currency could serve — every
 * one of them is measured against chaos — but the list is kept to the ones
 * players actually price in, so the picker stays a glance rather than a scroll.
 */
export const DENOMINATIONS: readonly CurrencyDef[] = [
  { id: 'chaos', label: 'Chaos Orb', short: 'Chaos' },
  { id: 'divine', label: 'Divine Orb', short: 'Divine' },
  { id: 'exalted', label: 'Exalted Orb', short: 'Exalted' },
  { id: 'annul', label: 'Orb of Annulment', short: 'Annul' },
  { id: 'regal', label: 'Regal Orb', short: 'Regal' },
  { id: 'vaal', label: 'Vaal Orb', short: 'Vaal' },
  { id: 'alch', label: 'Orb of Alchemy', short: 'Alch' },
];

export interface TrackedCurrency {
  readonly id: string;
  readonly label: string;
  /**
   * Rough value band, 1 being the most expensive.
   *
   * The exchange endpoint returns a single page of offers sorted by price, so
   * asking for a cheap currency alongside an expensive one lets the cheap
   * listings fill the page and starve the other — a live probe grouping
   * Annulment with four cheap orbs returned thirty Alchemy offers and one
   * Annulment. Currencies are therefore fetched in bands of similar value.
   */
  readonly tier: 1 | 2 | 3 | 4;
}

/**
 * The currencies players actually trade in bulk, banded by measured value.
 *
 * The list was not guessed: every entry in the game's currency catalogue was
 * queried against the live exchange, and only those returning real offers are
 * here. Notable absences are deliberate — Mirror of Kalandra, Awakener's Orb,
 * Maven's Orb, Hinekora's Lock, Harbinger's Orb, Fracturing Orb, Orb of
 * Dominance and Orb of Horizons each returned zero bulk offers, because they
 * change hands individually. A row that permanently reads "no offers" is noise,
 * not information. Vendor scraps (wisdom and portal scrolls, whetstones,
 * armourer's scrap) are omitted for the opposite reason: they trade, but
 * nobody price-checks them.
 */
export const TRACKED_CURRENCIES: readonly TrackedCurrency[] = [
  // Tier 1 — the expensive end, roughly 50 chaos and up.
  { id: 'divine', label: 'Divine Orb', tier: 1 },
  { id: 'veiled-chaos-orb', label: 'Veiled Chaos Orb', tier: 1 },
  { id: 'sacred-orb', label: 'Sacred Orb', tier: 1 },
  // Tier 2 — several chaos each. Kept clear of the sub-chaos orbs below:
  // grouped with them, Annulment's sample collapsed from 31 offers to 2.
  { id: 'annul', label: 'Orb of Annulment', tier: 2 },
  { id: 'ancient-orb', label: 'Ancient Orb', tier: 2 },
  { id: 'exalted', label: 'Exalted Orb', tier: 2 },
  // Tier 3 — one to three chaos.
  { id: 'stacked-deck', label: 'Stacked Deck', tier: 3 },
  { id: 'instilling-orb', label: 'Instilling Orb', tier: 3 },
  { id: 'enkindling-orb', label: 'Enkindling Orb', tier: 3 },
  { id: 'orb-of-unmaking', label: 'Orb of Unmaking', tier: 3 },
  { id: 'regal', label: 'Regal Orb', tier: 3 },
  { id: 'vaal', label: 'Vaal Orb', tier: 3 },
  { id: 'gcp', label: "Gemcutter's Prism", tier: 3 },
  { id: 'blessed', label: 'Blessed Orb', tier: 3 },
  { id: 'alch', label: 'Orb of Alchemy', tier: 3 },
  // Tier 4 — a chaos or less.
  { id: 'fusing', label: 'Orb of Fusing', tier: 4 },
  { id: 'bauble', label: "Glassblower's Bauble", tier: 4 },
  { id: 'regret', label: 'Orb of Regret', tier: 4 },
  { id: 'orb-of-binding', label: 'Orb of Binding', tier: 4 },
  { id: 'chrome', label: 'Chromatic Orb', tier: 4 },
  { id: 'jewellers', label: "Jeweller's Orb", tier: 4 },
  { id: 'chance', label: 'Orb of Chance', tier: 4 },
  { id: 'scour', label: 'Orb of Scouring', tier: 4 },
  { id: 'alt', label: 'Orb of Alteration', tier: 4 },
  { id: 'aug', label: 'Orb of Augmentation', tier: 4 },
  { id: 'transmute', label: 'Orb of Transmutation', tier: 4 },
];

/**
 * The tracked currencies grouped into the batches they should be fetched in —
 * one request per batch instead of one per currency.
 *
 * The default size keeps the whole table inside four requests, which fits the
 * endpoint's 5-per-15s allowance without ever having to wait out a window.
 * Crowding is a cross-tier problem, not a batch-size one: a live run packed
 * nine same-tier currencies into one request and every one came back with a
 * usable sample.
 */
export function currencyBatches(size = 9): string[][] {
  const byTier = new Map<number, string[]>();
  for (const entry of TRACKED_CURRENCIES) {
    byTier.set(entry.tier, [...(byTier.get(entry.tier) ?? []), entry.id]);
  }
  const batches: string[][] = [];
  const tiers = [...byTier.entries()].sort((a, b) => a[0] - b[0]);
  for (const [, ids] of tiers) {
    for (let index = 0; index < ids.length; index += size) {
      batches.push(ids.slice(index, index + size));
    }
  }
  return batches;
}

/**
 * Splits a batched response into one rate per currency. Offers are grouped by
 * what the seller gives, which is the currency being priced.
 */
export function summarizeBatch(
  offers: readonly ExchangeOffer[],
  want: string,
): Map<string, CurrencyRate> {
  const byCurrency = new Map<string, ExchangeOffer[]>();
  for (const offer of offers) {
    byCurrency.set(offer.giveCurrency, [
      ...(byCurrency.get(offer.giveCurrency) ?? []),
      offer,
    ]);
  }

  const rates = new Map<string, CurrencyRate>();
  for (const [give, group] of byCurrency) {
    const rate = summarizeRates(group, give, want);
    if (rate !== null) rates.set(give, rate);
  }
  return rates;
}

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
