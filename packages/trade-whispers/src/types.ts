/** Direction of a trade whisper relative to the player. */
export type WhisperDirection = 'incoming' | 'outgoing';

export interface StashLocation {
  readonly tab: string;
  readonly left: number;
  readonly top: number;
}

export interface Price {
  readonly amount: number;
  readonly currency: string;
}

/** Someone wants to buy a single listed item. */
export interface ItemTradeRequest {
  readonly kind: 'item';
  readonly direction: WhisperDirection;
  readonly character: string;
  readonly itemName: string;
  readonly price: Price | null;
  readonly league: string;
  readonly stash: StashLocation | null;
  readonly receivedAt: string;
  /** The whisper text, kept so the user can see exactly what was said. */
  readonly raw: string;
}

/** Someone wants to bulk-exchange currency. */
export interface BulkTradeRequest {
  readonly kind: 'bulk';
  readonly direction: WhisperDirection;
  readonly character: string;
  readonly want: Price;
  readonly offer: Price;
  readonly league: string;
  readonly receivedAt: string;
  readonly raw: string;
}

export type TradeRequest = ItemTradeRequest | BulkTradeRequest;

/**
 * A chat command Vaaluation can send on the user's behalf. Each value maps to
 * exactly one in-game action, which is what GGG's third-party rules require:
 * one user action produces at most one game action. There is deliberately no
 * compound command that chains several of these together.
 */
export type ChatCommandKind = 'invite' | 'trade' | 'kick' | 'whisper' | 'hideout';

export interface ChatCommand {
  readonly kind: ChatCommandKind;
  /** The literal text sent to the game's chat box. */
  readonly text: string;
}
