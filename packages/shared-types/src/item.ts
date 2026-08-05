/**
 * Parsed Path of Exile item model. Discriminated by `kind` so consumers can
 * narrow instead of probing a bag of optionals.
 */

export type ItemRarity = 'normal' | 'magic' | 'rare' | 'unique';

export type ModifierType =
  | 'implicit'
  | 'explicit'
  | 'crafted'
  | 'enchant'
  | 'fractured'
  | 'rune'
  | 'scourge'
  | 'unknown';

/**
 * Metadata the game emits above a modifier when the player has "Advanced Mod
 * Descriptions" enabled, e.g.
 * `{ Prefix Modifier "Healthy" (Tier: 12) — Life }`.
 */
export interface ModifierAnnotation {
  readonly affix: 'prefix' | 'suffix' | 'unknown';
  readonly name: string;
  readonly tier?: number;
  readonly tags: readonly string[];
}

export interface Modifier {
  /** Modifier text with any advanced-description value ranges removed. */
  readonly text: string;
  readonly type: ModifierType;
  /** Present only with Advanced Mod Descriptions enabled. */
  readonly annotation?: ModifierAnnotation;
  /** The roll range the game reported, e.g. `+18(10-24)` → 10…24. */
  readonly range?: { min: number; max: number };
}

export type Influence =
  | 'shaper'
  | 'elder'
  | 'crusader'
  | 'hunter'
  | 'redeemer'
  | 'warlord'
  | 'searing-exarch'
  | 'eater-of-worlds'
  | 'synthesised';

export interface SocketGroup {
  /** e.g. "B-G-R" — sockets in one linked group. */
  readonly sockets: readonly string[];
}

export interface Sockets {
  readonly groups: readonly SocketGroup[];
  readonly total: number;
  readonly maxLinks: number;
}

export interface Requirements {
  readonly level?: number;
  readonly str?: number;
  readonly dex?: number;
  readonly int?: number;
}

/** Fields shared by every parsed item. */
interface ItemBase {
  readonly itemClass: string;
  readonly rawText: string;
  /** Lines the parser did not understand, preserved verbatim. */
  readonly unknownLines: readonly string[];
}

export interface CurrencyItem extends ItemBase {
  readonly kind: 'currency';
  /** Currency, fragments, scarabs, essences and other stackables. */
  readonly name: string;
  readonly stackSize?: { current: number; max: number };
}

export interface DivinationCardItem extends ItemBase {
  readonly kind: 'divinationCard';
  readonly name: string;
  readonly stackSize?: { current: number; max: number };
}

export interface GemItem extends ItemBase {
  readonly kind: 'gem';
  readonly name: string;
  readonly level: number;
  readonly quality: number;
  readonly corrupted: boolean;
  readonly vaal: boolean;
  readonly requirements?: Requirements;
}

/**
 * The item's own totals, as printed at the top of its tooltip.
 *
 * These are what the trade site's Armour and Weapon filters search on, and
 * they are usually the more useful question: "boots with at least 44 energy
 * shield" describes what a buyer wants far better than "+13 to maximum
 * energy shield", which is only one of the rolls that produced it.
 */
export interface ItemProperties {
  readonly armour?: number;
  readonly evasion?: number;
  readonly energyShield?: number;
  readonly ward?: number;
  /** Chance to block, as a percentage. */
  readonly block?: number;
  readonly attacksPerSecond?: number;
  /** Critical strike chance, as a percentage. */
  readonly criticalChance?: number;
  /** Damage per second, derived from the ranges and attack speed. */
  readonly physicalDps?: number;
  readonly elementalDps?: number;
  readonly totalDps?: number;
}

export interface EquipmentItem extends ItemBase {
  readonly kind: 'equipment';
  readonly rarity: ItemRarity;
  /** Item name line; identical to baseType for normal items. */
  readonly name: string;
  readonly baseType: string;
  readonly identified: boolean;
  readonly corrupted: boolean;
  readonly mirrored: boolean;
  readonly itemLevel?: number;
  readonly quality?: number;
  readonly sockets?: Sockets;
  readonly requirements?: Requirements;
  readonly influences: readonly Influence[];
  readonly fractured: boolean;
  readonly modifiers: readonly Modifier[];
  readonly properties: ItemProperties;
}

export interface MapItem extends ItemBase {
  readonly kind: 'map';
  readonly rarity: ItemRarity;
  readonly name: string;
  readonly baseType: string;
  readonly mapTier?: number;
  readonly identified: boolean;
  readonly corrupted: boolean;
  readonly itemLevel?: number;
  readonly quality?: number;
  readonly modifiers: readonly Modifier[];
  readonly unknownProperties: readonly string[];
}

export type ParsedItem =
  CurrencyItem | DivinationCardItem | GemItem | EquipmentItem | MapItem;

export type ParseErrorCode =
  'empty' | 'not_an_item' | 'unsupported_language' | 'unrecognized_format';

export interface ParseFailure {
  readonly ok: false;
  readonly code: ParseErrorCode;
  readonly message: string;
}

export interface ParseSuccess {
  readonly ok: true;
  readonly item: ParsedItem;
}

export type ParseResult = ParseSuccess | ParseFailure;
