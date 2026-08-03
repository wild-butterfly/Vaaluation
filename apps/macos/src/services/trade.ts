import { TradeClient } from '@vaaluation/trade-client';
import type { FetchLike } from '@vaaluation/trade-client';

export const APP_VERSION = '0.1.0';
export const PROJECT_URL = 'https://github.com/OWNER/vaaluation';

/**
 * GGG's developer policy requires requests to identify the application and
 * offer a contact point. Nothing user-specific is included.
 */
export const USER_AGENT = `Vaaluation/${APP_VERSION} (+${PROJECT_URL})`;

let client: TradeClient | null = null;

export function getTradeClient(): TradeClient {
  client ??= new TradeClient({
    fetch: globalThis.fetch as unknown as FetchLike,
    userAgent: USER_AGENT,
  });
  return client;
}
