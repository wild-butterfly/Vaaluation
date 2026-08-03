import type { ChatCommand, TradeRequest } from './types';

/**
 * Builds the chat commands offered for a trade request.
 *
 * Every command here is a single in-game action. Nothing chains actions
 * together: GGG's rules for standalone applications require that one user
 * action produce at most one game action, so a button that invited *and*
 * traded *and* kicked would not be acceptable. The user presses one button
 * per step, exactly as if they had typed it.
 */

/** Character names come from the log; keep them to what the game allows. */
function sanitizeCharacter(name: string): string {
  return name.replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 32);
}

/** Strips anything that could turn one command into several. */
export function sanitizeMessage(message: string): string {
  return message
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export function inviteCommand(request: TradeRequest): ChatCommand {
  return { kind: 'invite', text: `/invite ${sanitizeCharacter(request.character)}` };
}

export function tradeCommand(request: TradeRequest): ChatCommand {
  return { kind: 'trade', text: `/tradewith ${sanitizeCharacter(request.character)}` };
}

export function kickCommand(request: TradeRequest): ChatCommand {
  return { kind: 'kick', text: `/kick ${sanitizeCharacter(request.character)}` };
}

export function hideoutCommand(): ChatCommand {
  return { kind: 'hideout', text: '/hideout' };
}

export function whisperCommand(request: TradeRequest, message: string): ChatCommand {
  return {
    kind: 'whisper',
    text: `@${sanitizeCharacter(request.character)} ${sanitizeMessage(message)}`,
  };
}

/**
 * Sends a thank-you and nothing else. Kept as its own command so the button
 * that uses it stays a single game action — it must never be combined with
 * kicking or clearing the request.
 */
export function thanksCommand(request: TradeRequest, message: string): ChatCommand {
  return whisperCommand(request, message);
}

/**
 * Human-readable summary of a request, used for the list row and for
 * confirming what a command will do before it is sent.
 */
export function describeRequest(request: TradeRequest): string {
  if (request.kind === 'bulk') {
    return `${request.want.amount} ${request.want.currency} for ${request.offer.amount} ${request.offer.currency}`;
  }
  if (request.price === null) return request.itemName;
  return `${request.itemName} — ${request.price.amount} ${request.price.currency}`;
}
