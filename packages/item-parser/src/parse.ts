import type {
  CurrencyItem,
  DivinationCardItem,
  EquipmentItem,
  GemItem,
  Influence,
  ItemRarity,
  MapItem,
  Modifier,
  ModifierType,
  ParseResult,
  ParsedItem,
  Requirements,
  Sockets,
} from '@vaaluation/shared-types';
import {
  parseInteger,
  parseKeyValue,
  parsePercent,
  parseStackSize,
  splitSections,
} from './sections';

const RARITIES: Record<string, ItemRarity | 'currency' | 'gem' | 'divination'> = {
  Normal: 'normal',
  Magic: 'magic',
  Rare: 'rare',
  Unique: 'unique',
  Currency: 'currency',
  Gem: 'gem',
  'Divination Card': 'divination',
};

const INFLUENCE_LINES: Record<string, Influence> = {
  'Shaper Item': 'shaper',
  'Elder Item': 'elder',
  'Crusader Item': 'crusader',
  'Hunter Item': 'hunter',
  'Redeemer Item': 'redeemer',
  'Warlord Item': 'warlord',
  'Searing Exarch Item': 'searing-exarch',
  'Eater of Worlds Item': 'eater-of-worlds',
  'Synthesised Item': 'synthesised',
};

const MOD_SUFFIXES: ReadonlyArray<{ suffix: string; type: ModifierType }> = [
  { suffix: ' (implicit)', type: 'implicit' },
  { suffix: ' (enchant)', type: 'enchant' },
  { suffix: ' (crafted)', type: 'crafted' },
  { suffix: ' (fractured)', type: 'fractured' },
  { suffix: ' (rune)', type: 'rune' },
  { suffix: ' (scourge)', type: 'scourge' },
];

/** Section-level flag lines that are not modifiers. */
const FLAG_LINES = new Set([
  'Corrupted',
  'Unidentified',
  'Mirrored',
  'Split',
  'Fractured Item',
  ...Object.keys(INFLUENCE_LINES),
]);

/** Usage hints the game appends; never modifiers. */
const USAGE_PREFIXES = [
  'Right click',
  'Right-click',
  'Can be used',
  'Travel to this Map',
  'Place into',
  'Take this item',
  'Sell with other',
];

function isUsageSection(lines: readonly string[]): boolean {
  return lines.some((line) => USAGE_PREFIXES.some((prefix) => line.startsWith(prefix)));
}

function classifyModLine(line: string): Modifier {
  for (const { suffix, type } of MOD_SUFFIXES) {
    if (line.endsWith(suffix)) {
      return { text: line.slice(0, -suffix.length), type };
    }
  }
  return { text: line, type: 'explicit' };
}

interface HeaderInfo {
  itemClass: string;
  rarity: string;
  nameLines: string[];
}

function parseHeader(header: readonly string[]): HeaderInfo | null {
  let itemClass: string | null = null;
  let rarity: string | null = null;
  const nameLines: string[] = [];

  for (const line of header) {
    const kv = parseKeyValue(line);
    if (kv?.key === 'Item Class') {
      itemClass = kv.value;
    } else if (kv?.key === 'Rarity') {
      rarity = kv.value;
    } else if (line.trim() !== '') {
      nameLines.push(line.trim());
    }
  }

  if (rarity === null) return null;
  return { itemClass: itemClass ?? 'Unknown', rarity, nameLines };
}

interface ScanState {
  itemLevel?: number | undefined;
  quality?: number | undefined;
  mapTier?: number | undefined;
  gemLevel?: number | undefined;
  stackSize?: { current: number; max: number } | undefined;
  sockets?: Sockets | undefined;
  requirements?: Requirements | undefined;
  corrupted: boolean;
  mirrored: boolean;
  unidentified: boolean;
  fractured: boolean;
  influences: Influence[];
  modifierSections: Modifier[][];
  unknownLines: string[];
  mapProperties: string[];
}

function parseSocketsValue(value: string): Sockets {
  const groups = value
    .trim()
    .split(' ')
    .filter((part) => part.length > 0)
    .map((part) => ({ sockets: part.split('-') }));
  const total = groups.reduce((sum, group) => sum + group.sockets.length, 0);
  const maxLinks = groups.reduce((max, group) => Math.max(max, group.sockets.length), 0);
  return { groups, total, maxLinks };
}

function parseRequirementsSection(lines: readonly string[]): Requirements {
  const requirements: { level?: number; str?: number; dex?: number; int?: number } = {};
  for (const line of lines) {
    const kv = parseKeyValue(line.trim());
    if (kv === null) continue;
    const value = parseInteger(kv.value);
    if (value === null) continue;
    if (kv.key === 'Level') requirements.level = value;
    if (kv.key === 'Str' || kv.key === 'Strength') requirements.str = value;
    if (kv.key === 'Dex' || kv.key === 'Dexterity') requirements.dex = value;
    if (kv.key === 'Int' || kv.key === 'Intelligence') requirements.int = value;
  }
  return requirements;
}

/**
 * Walks every non-header section, filling ScanState. Sections that contain
 * only free text (no key-value lines, no flags) are treated as modifier
 * sections for identified gear; anything else unrecognized is preserved.
 */
function scanSections(
  sections: readonly (readonly string[])[],
  options: { collectMapProperties: boolean },
): ScanState {
  const state: ScanState = {
    corrupted: false,
    mirrored: false,
    unidentified: false,
    fractured: false,
    influences: [],
    modifierSections: [],
    unknownLines: [],
    mapProperties: [],
  };

  for (const section of sections) {
    const first = section[0];
    if (first !== undefined && first.trim() === 'Requirements:') {
      state.requirements = parseRequirementsSection(section.slice(1));
      continue;
    }

    let sectionHadStructure = false;
    const freeLines: string[] = [];

    for (const line of section) {
      const trimmed = line.trim();
      if (trimmed === '') continue;

      if (FLAG_LINES.has(trimmed)) {
        sectionHadStructure = true;
        if (trimmed === 'Corrupted') state.corrupted = true;
        else if (trimmed === 'Mirrored') state.mirrored = true;
        else if (trimmed === 'Unidentified') state.unidentified = true;
        else if (trimmed === 'Fractured Item') state.fractured = true;
        else {
          const influence = INFLUENCE_LINES[trimmed];
          if (influence !== undefined) state.influences.push(influence);
        }
        continue;
      }

      const kv = parseKeyValue(trimmed);
      if (kv !== null) {
        sectionHadStructure = true;
        switch (kv.key) {
          case 'Item Level':
            state.itemLevel = parseInteger(kv.value) ?? undefined;
            break;
          case 'Quality':
            state.quality = parsePercent(kv.value) ?? undefined;
            break;
          case 'Map Tier':
            state.mapTier = parseInteger(kv.value) ?? undefined;
            break;
          case 'Level':
            state.gemLevel = parseInteger(kv.value) ?? undefined;
            break;
          case 'Stack Size':
            state.stackSize = parseStackSize(kv.value) ?? undefined;
            break;
          case 'Sockets':
            state.sockets = parseSocketsValue(kv.value);
            break;
          default:
            if (options.collectMapProperties) {
              state.mapProperties.push(trimmed);
            } else {
              state.unknownLines.push(trimmed);
            }
        }
        continue;
      }

      freeLines.push(trimmed);
    }

    if (freeLines.length > 0) {
      if (sectionHadStructure || isUsageSection(freeLines)) {
        // Mixed or usage-hint section: keep the text as unknown, not as mods.
        state.unknownLines.push(...freeLines);
      } else {
        state.modifierSections.push(freeLines.map(classifyModLine));
      }
    }
  }

  return state;
}

/**
 * Flavour text and modifier sections are both free text. Heuristic: for
 * identified uniques the last free-text section is flavour when there are at
 * least two free-text sections; the trade site never searches flavour text.
 */
function selectModifiers(
  state: ScanState,
  rarity: ItemRarity,
  identified: boolean,
): Modifier[] {
  let sections = state.modifierSections;
  if (rarity === 'unique' && identified && sections.length >= 2) {
    sections = sections.slice(0, -1);
  }
  return sections.flat();
}

export function parseItemText(text: string): ParseResult {
  if (text.trim() === '') {
    return { ok: false, code: 'empty', message: 'No text to parse.' };
  }

  const sections = splitSections(text);
  if (sections === null) {
    return {
      ok: false,
      code: 'not_an_item',
      message: 'Text does not look like a copied Path of Exile item.',
    };
  }

  const header = parseHeader(sections.header);
  if (header === null) {
    return {
      ok: false,
      code: 'not_an_item',
      message:
        'Missing "Rarity:" line. Copy an item in the game (English client) and try again.',
    };
  }

  const rarityKind = RARITIES[header.rarity];
  if (rarityKind === undefined) {
    return {
      ok: false,
      code: 'unsupported_language',
      message: `Unrecognized rarity "${header.rarity}". Only the English game client is supported.`,
    };
  }

  const item = buildItem(text, header, rarityKind, sections.rest);
  return { ok: true, item };
}

function buildItem(
  rawText: string,
  header: HeaderInfo,
  rarityKind: ItemRarity | 'currency' | 'gem' | 'divination',
  rest: readonly (readonly string[])[],
): ParsedItem {
  const isMap =
    header.itemClass === 'Maps' ||
    rest.some((section) => section.some((line) => line.trim().startsWith('Map Tier: ')));

  const state = scanSections(rest, { collectMapProperties: isMap });

  // Currency/cards have no searchable modifiers; preserve their effect and
  // flavour lines verbatim instead of interpreting them.
  const preservedFreeText = [
    ...state.unknownLines,
    ...state.modifierSections.flat().map((mod) => mod.text),
  ];

  if (rarityKind === 'currency') {
    const currency: CurrencyItem = {
      kind: 'currency',
      itemClass: header.itemClass,
      rawText,
      name: header.nameLines[0] ?? '',
      ...(state.stackSize !== undefined ? { stackSize: state.stackSize } : {}),
      unknownLines: preservedFreeText,
    };
    return currency;
  }

  if (rarityKind === 'divination') {
    const card: DivinationCardItem = {
      kind: 'divinationCard',
      itemClass: header.itemClass,
      rawText,
      name: header.nameLines[0] ?? '',
      ...(state.stackSize !== undefined ? { stackSize: state.stackSize } : {}),
      unknownLines: preservedFreeText,
    };
    return card;
  }

  if (rarityKind === 'gem') {
    const name = header.nameLines[0] ?? '';
    const gem: GemItem = {
      kind: 'gem',
      itemClass: header.itemClass,
      rawText,
      name,
      level: state.gemLevel ?? 1,
      quality: state.quality ?? 0,
      corrupted: state.corrupted,
      vaal: name.startsWith('Vaal '),
      ...(state.requirements !== undefined ? { requirements: state.requirements } : {}),
      unknownLines: preservedFreeText,
    };
    return gem;
  }

  const rarity = rarityKind;
  const identified = !state.unidentified;
  // Magic and normal items have a single name line; rares and uniques have
  // name + base type. Unidentified rares/uniques show only the base type.
  const name = header.nameLines[0] ?? '';
  const baseType = header.nameLines.length > 1 ? (header.nameLines[1] ?? name) : name;

  if (isMap) {
    const map: MapItem = {
      kind: 'map',
      itemClass: header.itemClass,
      rawText,
      rarity,
      name,
      baseType,
      ...(state.mapTier !== undefined ? { mapTier: state.mapTier } : {}),
      identified,
      corrupted: state.corrupted,
      ...(state.itemLevel !== undefined ? { itemLevel: state.itemLevel } : {}),
      ...(state.quality !== undefined ? { quality: state.quality } : {}),
      modifiers: selectModifiers(state, rarity, identified),
      unknownProperties: state.mapProperties,
      unknownLines: state.unknownLines,
    };
    return map;
  }

  const equipment: EquipmentItem = {
    kind: 'equipment',
    itemClass: header.itemClass,
    rawText,
    rarity,
    name,
    baseType,
    identified,
    corrupted: state.corrupted,
    mirrored: state.mirrored,
    ...(state.itemLevel !== undefined ? { itemLevel: state.itemLevel } : {}),
    ...(state.quality !== undefined ? { quality: state.quality } : {}),
    ...(state.sockets !== undefined ? { sockets: state.sockets } : {}),
    ...(state.requirements !== undefined ? { requirements: state.requirements } : {}),
    influences: state.influences,
    fractured: state.fractured,
    modifiers: selectModifiers(state, rarity, identified),
    unknownLines: state.unknownLines,
  };
  return equipment;
}
