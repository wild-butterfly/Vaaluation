import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseItemText } from '../src';

function fixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf8');
}

function parseOk(name: string) {
  const result = parseItemText(fixture(name));
  if (!result.ok) {
    throw new Error(`Expected ${name} to parse, got ${result.code}: ${result.message}`);
  }
  return result.item;
}

describe('parseItemText — failures', () => {
  it('rejects empty input', () => {
    const result = parseItemText('   \n ');
    expect(result).toMatchObject({ ok: false, code: 'empty' });
  });

  it('rejects arbitrary text', () => {
    const result = parseItemText('hello world\nthis is not an item');
    expect(result).toMatchObject({ ok: false, code: 'not_an_item' });
  });

  it('rejects non-English rarity lines', () => {
    const result = parseItemText(
      'Item Class: Ringe\nRarity: Selten\nDoom Loop\nAmethyst Ring',
    );
    expect(result).toMatchObject({ ok: false, code: 'unsupported_language' });
  });
});

describe('parseItemText — currency and stackables', () => {
  it('parses stackable currency', () => {
    const item = parseOk('currency-divine-orb.txt');
    expect(item).toMatchObject({
      kind: 'currency',
      itemClass: 'Stackable Currency',
      name: 'Divine Orb',
      stackSize: { current: 3, max: 10 },
    });
    expect(item.unknownLines).toContain(
      'Randomises the numeric values of the random modifiers on an item',
    );
  });

  it('parses fragments without stack size', () => {
    const item = parseOk('fragment-sacrifice-at-dusk.txt');
    expect(item).toMatchObject({
      kind: 'currency',
      itemClass: 'Map Fragments',
      name: 'Sacrifice at Dusk',
    });
    expect('stackSize' in item && item.stackSize).toBeFalsy();
  });

  it('parses scarabs with effect text preserved', () => {
    const item = parseOk('scarab-titanic.txt');
    expect(item).toMatchObject({
      kind: 'currency',
      name: 'Titanic Scarab',
      stackSize: { current: 2, max: 20 },
    });
    expect(item.unknownLines).toContain('Area contains 10% increased number of Monsters');
  });
});

describe('parseItemText — divination cards', () => {
  it('parses cards with stack size and preserved reward/flavour', () => {
    const item = parseOk('divination-card.txt');
    expect(item).toMatchObject({
      kind: 'divinationCard',
      name: 'The Doctor',
      stackSize: { current: 3, max: 8 },
    });
    expect(item.unknownLines).toContain('Headhunter');
  });
});

describe('parseItemText — gems', () => {
  it('parses a corrupted Vaal gem', () => {
    const item = parseOk('gem-vaal-grace.txt');
    expect(item).toMatchObject({
      kind: 'gem',
      name: 'Vaal Grace',
      level: 20,
      quality: 20,
      corrupted: true,
      vaal: true,
      requirements: { level: 72, dex: 155 },
    });
    expect(item.unknownLines).toContain('Vaal, Aura, Spell, AoE, Duration');
  });
});

describe('parseItemText — equipment', () => {
  it('parses a unique with implicit, explicits, and flavour stripped', () => {
    const item = parseOk('unique-belt.txt');
    expect(item).toMatchObject({
      kind: 'equipment',
      rarity: 'unique',
      name: 'Headhunter',
      baseType: 'Leather Belt',
      itemLevel: 85,
      identified: true,
      corrupted: false,
      requirements: { level: 40 },
    });
    if (item.kind !== 'equipment') throw new Error('unreachable');
    expect(item.modifiers).toContainEqual({
      text: '+31 to maximum Life',
      type: 'implicit',
    });
    expect(item.modifiers).toContainEqual({
      text: 'When you Kill a Rare monster, you gain its Modifiers for 60 seconds',
      type: 'explicit',
    });
    const flavour = item.modifiers.find((mod) => mod.text.includes('fallen leader'));
    expect(flavour).toBeUndefined();
  });

  it('parses a rare with implicit, crafted, and requirements', () => {
    const item = parseOk('rare-ring.txt');
    expect(item).toMatchObject({
      kind: 'equipment',
      rarity: 'rare',
      name: 'Doom Loop',
      baseType: 'Amethyst Ring',
      itemLevel: 84,
    });
    if (item.kind !== 'equipment') throw new Error('unreachable');
    expect(item.modifiers).toContainEqual({
      text: '+17% to Chaos Resistance',
      type: 'implicit',
    });
    expect(item.modifiers).toContainEqual({
      text: '20% increased Rarity of Items found',
      type: 'crafted',
    });
    expect(item.modifiers.filter((mod) => mod.type === 'explicit')).toHaveLength(4);
  });

  it('parses a magic flask with quality and usage text excluded from mods', () => {
    const item = parseOk('magic-flask.txt');
    expect(item).toMatchObject({
      kind: 'equipment',
      rarity: 'magic',
      name: "Experimenter's Silver Flask of the Dove",
      quality: 20,
      itemLevel: 45,
    });
    if (item.kind !== 'equipment') throw new Error('unreachable');
    expect(item.modifiers).toContainEqual({
      text: '38% increased Duration',
      type: 'explicit',
    });
    const usage = item.modifiers.find((mod) => mod.text.startsWith('Right click'));
    expect(usage).toBeUndefined();
    expect(item.unknownLines).toContain('Onslaught');
  });

  it('parses a normal item with sockets and requirements', () => {
    const item = parseOk('normal-boots.txt');
    expect(item).toMatchObject({
      kind: 'equipment',
      rarity: 'normal',
      name: 'Titan Greaves',
      baseType: 'Titan Greaves',
      itemLevel: 80,
      requirements: { level: 68, str: 120 },
      sockets: {
        total: 4,
        maxLinks: 3,
        groups: [{ sockets: ['R', 'R', 'R'] }, { sockets: ['B'] }],
      },
    });
    if (item.kind !== 'equipment') throw new Error('unreachable');
    expect(item.unknownLines).toContain('Armour: 240');
  });

  it('parses a rare jewel', () => {
    const item = parseOk('jewel-rare.txt');
    expect(item).toMatchObject({
      kind: 'equipment',
      rarity: 'rare',
      name: 'Entropy Splinter',
      baseType: 'Cobalt Jewel',
      itemLevel: 85,
    });
    if (item.kind !== 'equipment') throw new Error('unreachable');
    expect(item.modifiers).toHaveLength(3);
  });

  it('parses an unidentified rare', () => {
    const item = parseOk('rare-unidentified.txt');
    expect(item).toMatchObject({
      kind: 'equipment',
      rarity: 'rare',
      name: 'Astral Plate',
      baseType: 'Astral Plate',
      identified: false,
      itemLevel: 86,
      sockets: { total: 5, maxLinks: 3 },
    });
  });

  it('parses fractured and influenced state with enchant and rune-style mods', () => {
    const item = parseOk('rare-fractured-influenced.txt');
    expect(item).toMatchObject({
      kind: 'equipment',
      rarity: 'rare',
      fractured: true,
      influences: ['hunter'],
    });
    if (item.kind !== 'equipment') throw new Error('unreachable');
    expect(item.modifiers).toContainEqual({
      text: '+68 to maximum Life',
      type: 'fractured',
    });
    expect(item.modifiers).toContainEqual({
      text: 'Nearby Enemies take 9% increased Physical Damage',
      type: 'enchant',
    });
  });
});

describe('parseItemText — maps', () => {
  it('parses a rare tier 16 map with properties preserved', () => {
    const item = parseOk('map-rare-t16.txt');
    expect(item).toMatchObject({
      kind: 'map',
      rarity: 'rare',
      name: 'Whispering Refuge',
      baseType: 'Cemetery Map',
      mapTier: 16,
      itemLevel: 83,
      identified: true,
    });
    if (item.kind !== 'map') throw new Error('unreachable');
    expect(item.modifiers).toContainEqual({
      text: 'Area is influenced by The Shaper',
      type: 'implicit',
    });
    expect(item.modifiers).toContainEqual({
      text: 'Players are Cursed with Vulnerability',
      type: 'explicit',
    });
    expect(item.unknownProperties).toContain('Item Quantity: +75% (augmented)');
  });
});

describe('parseItemText — raw text preservation', () => {
  it('keeps the exact raw text on every parsed item', () => {
    const raw = fixture('rare-ring.txt');
    const result = parseItemText(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.rawText).toBe(raw);
    }
  });
});
