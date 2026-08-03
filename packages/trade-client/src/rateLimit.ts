/**
 * Rate limiting driven entirely by GGG's response headers.
 *
 *   x-rate-limit-ip:       "5:10:60,15:60:300"   maxHits:periodSec:restrictSec
 *   x-rate-limit-ip-state: "1:10:0,1:60:0"       hits:periodSec:restrictedForSec
 *
 * Limits are dynamic and may change at any time, so nothing here is
 * hard-coded: we read the policy back off every response and refuse to send a
 * request that the most recent state says would breach a rule.
 */

export interface RateLimitRule {
  readonly maxHits: number;
  readonly periodSeconds: number;
  readonly restrictionSeconds: number;
}

export interface RateLimitState {
  readonly hits: number;
  readonly periodSeconds: number;
  readonly restrictedForSeconds: number;
}

export function parseRules(header: string | null): RateLimitRule[] {
  if (header === null || header.trim() === '') return [];
  return header
    .split(',')
    .map((part) => part.split(':').map(Number))
    .filter((parts) => parts.length === 3 && parts.every((n) => Number.isFinite(n)))
    .map(([maxHits, periodSeconds, restrictionSeconds]) => ({
      maxHits: maxHits as number,
      periodSeconds: periodSeconds as number,
      restrictionSeconds: restrictionSeconds as number,
    }));
}

export function parseState(header: string | null): RateLimitState[] {
  if (header === null || header.trim() === '') return [];
  return header
    .split(',')
    .map((part) => part.split(':').map(Number))
    .filter((parts) => parts.length === 3 && parts.every((n) => Number.isFinite(n)))
    .map(([hits, periodSeconds, restrictedForSeconds]) => ({
      hits: hits as number,
      periodSeconds: periodSeconds as number,
      restrictedForSeconds: restrictedForSeconds as number,
    }));
}

/**
 * Tracks one rate-limit policy (search and fetch have separate policies).
 */
export class RateLimitPolicy {
  private rules: RateLimitRule[] = [];
  private state: RateLimitState[] = [];
  private blockedUntil = 0;
  private lastUpdated = 0;

  constructor(private readonly now: () => number = Date.now) {}

  update(headers: { get(name: string): string | null }): void {
    const rules = parseRules(headers.get('x-rate-limit-ip'));
    const state = parseState(headers.get('x-rate-limit-ip-state'));
    if (rules.length > 0) this.rules = rules;
    if (state.length > 0) this.state = state;
    this.lastUpdated = this.now();

    // Any active restriction blocks every request under this policy.
    for (const entry of this.state) {
      if (entry.restrictedForSeconds > 0) {
        this.blockUntil(this.now() + entry.restrictedForSeconds * 1000);
      }
    }
  }

  blockUntil(timestampMs: number): void {
    this.blockedUntil = Math.max(this.blockedUntil, timestampMs);
  }

  /**
   * Milliseconds the caller must wait before the next request is safe.
   * Zero means send now.
   */
  retryAfterMs(): number {
    const now = this.now();
    if (this.blockedUntil > now) return this.blockedUntil - now;

    for (const rule of this.rules) {
      const entry = this.state.find((s) => s.periodSeconds === rule.periodSeconds);
      if (entry === undefined) continue;
      if (entry.hits >= rule.maxHits) {
        // The window rolls forward from when the state was reported.
        const windowEnds = this.lastUpdated + rule.periodSeconds * 1000;
        if (windowEnds > now) return windowEnds - now;
      }
    }
    return 0;
  }

  get isBlocked(): boolean {
    return this.retryAfterMs() > 0;
  }
}
