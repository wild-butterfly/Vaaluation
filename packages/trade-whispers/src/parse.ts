import type {
  BulkTradeRequest,
  ItemTradeRequest,
  Price,
  StashLocation,
  TradeRequest,
  WhisperDirection,
} from './types';

/**
 * Parses trade whispers out of the Path of Exile client log.
 *
 * Privacy: only lines matching the game's own trade-whisper templates are
 * recognized. Ordinary chat — guild, party, global, and personal whispers —
 * returns null and is never surfaced, stored, or logged.
 */

/**
 * Log lines look like:
 * `2026/08/03 17:52:40 123456 cffb0716 [INFO Client 1234] @From Alice: Hi, …`
 */
const LOG_LINE =
  /^(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}).*?\[INFO Client \d+\] (@From|@To) ([^:]+): (.*)$/;

/** The game's own wording for a single-item purchase. */
const ITEM_PATTERNS: readonly RegExp[] = [
  // Hi, I would like to buy your X listed for 10 chaos in League (stash …)
  /^Hi, I would like to buy your (.+?) listed for ([\d.]+) ([\w' -]+?) in ([\w' ]+?)\s*(?:\((.*)\))?\.?$/,
  // Hi, I want to buy your X listed for 10 chaos in League
  /^Hi, I want to buy your (.+?) listed for ([\d.]+) ([\w' -]+?) in ([\w' ]+?)\s*(?:\((.*)\))?\.?$/,
];

/** Item listed with no price ("~b/o" absent). */
const ITEM_NO_PRICE =
  /^Hi, I would like to buy your (.+?) in ([\w' ]+?)\s*(?:\((.*)\))?\.?$/;

/** Bulk currency exchange. */
const BULK_PATTERN =
  /^Hi, I'?d? ?(?:would)? ?like to buy your ([\d.]+) ([\w' -]+?) for my ([\d.]+) ([\w' -]+?) in ([\w' ]+?)\.?$/;

const STASH_PATTERN = /stash tab "(.*?)";? position: left (\d+), top (\d+)/i;

function parseStash(extra: string | undefined): StashLocation | null {
  if (extra === undefined) return null;
  const match = STASH_PATTERN.exec(extra);
  if (match === null) return null;
  const [, tab, left, top] = match;
  if (tab === undefined || left === undefined || top === undefined) return null;
  return { tab, left: Number(left), top: Number(top) };
}

function price(amount: string | undefined, currency: string | undefined): Price | null {
  if (amount === undefined || currency === undefined) return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  return { amount: value, currency: currency.trim() };
}

/** `2026/08/03 17:52:40` → ISO string, treated as local time as the game logs it. */
function toIso(timestamp: string): string {
  const normalized = timestamp.replace(/\//g, '-').replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export interface ParsedLine {
  readonly direction: WhisperDirection;
  readonly character: string;
  readonly message: string;
  readonly timestamp: string;
}

/** Splits a log line into its whisper parts, or null when it is not a whisper. */
export function parseLogLine(line: string): ParsedLine | null {
  const match = LOG_LINE.exec(line.trim());
  if (match === null) return null;
  const [, timestamp, marker, character, message] = match;
  if (
    timestamp === undefined ||
    marker === undefined ||
    character === undefined ||
    message === undefined
  ) {
    return null;
  }
  return {
    direction: marker === '@From' ? 'incoming' : 'outgoing',
    character: character.trim(),
    message: message.trim(),
    timestamp: toIso(timestamp),
  };
}

/**
 * Returns a trade request for a trade whisper, or null for any other line —
 * including ordinary conversation, which is deliberately ignored.
 */
export function parseTradeWhisper(line: string): TradeRequest | null {
  const parsed = parseLogLine(line);
  if (parsed === null) return null;
  return requestFromMessage(parsed);
}

export function requestFromMessage(parsed: ParsedLine): TradeRequest | null {
  const { message, character, direction, timestamp } = parsed;

  const bulk = BULK_PATTERN.exec(message);
  if (bulk !== null) {
    const want = price(bulk[1], bulk[2]);
    const offer = price(bulk[3], bulk[4]);
    const league = bulk[5];
    if (want !== null && offer !== null && league !== undefined) {
      const request: BulkTradeRequest = {
        kind: 'bulk',
        direction,
        character,
        want,
        offer,
        league: league.trim(),
        receivedAt: timestamp,
        raw: message,
      };
      return request;
    }
  }

  for (const pattern of ITEM_PATTERNS) {
    const match = pattern.exec(message);
    if (match === null) continue;
    const itemName = match[1];
    const league = match[4];
    if (itemName === undefined || league === undefined) continue;
    const request: ItemTradeRequest = {
      kind: 'item',
      direction,
      character,
      itemName: itemName.trim(),
      price: price(match[2], match[3]),
      league: league.trim(),
      stash: parseStash(match[5]),
      receivedAt: timestamp,
      raw: message,
    };
    return request;
  }

  const noPrice = ITEM_NO_PRICE.exec(message);
  if (noPrice !== null) {
    const itemName = noPrice[1];
    const league = noPrice[2];
    if (itemName !== undefined && league !== undefined) {
      const request: ItemTradeRequest = {
        kind: 'item',
        direction,
        character,
        itemName: itemName.trim(),
        price: null,
        league: league.trim(),
        stash: parseStash(noPrice[3]),
        receivedAt: timestamp,
        raw: message,
      };
      return request;
    }
  }

  return null;
}
