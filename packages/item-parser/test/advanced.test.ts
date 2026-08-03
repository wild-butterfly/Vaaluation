import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseItemText } from '../src';
import { isAnnotationLine, parseAnnotation, stripRanges } from '../src/advanced';

describe('advanced mod description annotations', () => {
  it('recognizes annotation lines', () => {
    expect(isAnnotationLine('{ Prefix Modifier "Healthy" (Tier: 12) — Life }')).toBe(
      true,
    );
    expect(isAnnotationLine('+18 to maximum Life')).toBe(false);
  });

  it('parses affix, name, tier and tags', () => {
    expect(parseAnnotation('{ Prefix Modifier "Healthy" (Tier: 12) — Life }')).toEqual({
      affix: 'prefix',
      name: 'Healthy',
      tier: 12,
      tags: ['Life'],
    });
  });

  it('parses multi-tag suffix annotations', () => {
    expect(
      parseAnnotation(
        '{ Suffix Modifier "of the Inuit" (Tier: 8) — Elemental, Cold, Resistance }',
      ),
    ).toEqual({
      affix: 'suffix',
      name: 'of the Inuit',
      tier: 8,
      tags: ['Elemental', 'Cold', 'Resistance'],
    });
  });

  it('returns null for braces with no recognizable structure', () => {
    expect(parseAnnotation('{ something else entirely }')).toBeNull();
  });
});

describe('roll range stripping', () => {
  it('removes ranges and reports the first one', () => {
    expect(stripRanges('+18(10-24) to maximum Life')).toEqual({
      text: '+18 to maximum Life',
      range: { min: 10, max: 24 },
    });
  });

  it('handles values without a leading sign', () => {
    expect(stripRanges('22(15-26)% increased Armour and Energy Shield')).toEqual({
      text: '22% increased Armour and Energy Shield',
      range: { min: 15, max: 26 },
    });
  });

  it('strips every range while reporting the first', () => {
    const result = stripRanges('Adds 5(3-6) to 9(7-12) Physical Damage');
    expect(result.text).toBe('Adds 5 to 9 Physical Damage');
    expect(result.range).toEqual({ min: 3, max: 6 });
  });

  it('leaves ordinary text untouched', () => {
    expect(stripRanges('+18 to maximum Life')).toEqual({ text: '+18 to maximum Life' });
  });
});

describe('real copied item with Advanced Mod Descriptions enabled', () => {
  const raw = readFileSync(
    join(__dirname, 'fixtures', 'rare-advanced-mod-descriptions.txt'),
    'utf8',
  );

  it('parses the item without treating annotations as modifiers', () => {
    const result = parseItemText(raw);
    expect(result.ok).toBe(true);
    if (!result.ok || result.item.kind !== 'equipment') throw new Error('unreachable');
    const item = result.item;

    expect(item).toMatchObject({
      rarity: 'rare',
      name: 'Wrath Pelt',
      baseType: 'Chainmail Tunic',
      itemLevel: 15,
      identified: true,
      requirements: { level: 8, str: 16, int: 16 },
    });

    // Five real modifiers — no brace lines leaking through.
    expect(item.modifiers).toHaveLength(5);
    for (const mod of item.modifiers) {
      expect(mod.text.startsWith('{')).toBe(false);
    }
  });

  it('attaches each annotation to the modifier it introduces', () => {
    const result = parseItemText(raw);
    if (!result.ok || result.item.kind !== 'equipment') throw new Error('unreachable');

    expect(result.item.modifiers[0]).toEqual({
      text: '+18 to maximum Life',
      type: 'explicit',
      annotation: { affix: 'prefix', name: 'Healthy', tier: 12, tags: ['Life'] },
      range: { min: 10, max: 24 },
    });

    expect(result.item.modifiers[3]).toMatchObject({
      text: '+8% to Fire Resistance',
      annotation: { affix: 'suffix', name: 'of the Whelpling', tier: 8 },
      range: { min: 6, max: 11 },
    });
  });

  it('parses the single white socket', () => {
    const result = parseItemText(raw);
    if (!result.ok || result.item.kind !== 'equipment') throw new Error('unreachable');
    expect(result.item.sockets).toEqual({
      groups: [{ sockets: ['W'] }],
      total: 1,
      maxLinks: 1,
    });
  });

  it('parses identically with the CRLF line endings the game emits', () => {
    const crlf = raw.replace(/\n/g, '\r\n');
    const result = parseItemText(crlf);
    if (!result.ok || result.item.kind !== 'equipment') throw new Error('unreachable');
    expect(result.item.name).toBe('Wrath Pelt');
    expect(result.item.modifiers).toHaveLength(5);
  });
});
