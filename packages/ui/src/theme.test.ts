import { describe, expect, it } from 'vitest';
import { colors } from './theme';

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const l1 = luminance(foreground);
  const l2 = luminance(background);
  const [lighter, darker] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

describe('theme contrast (WCAG AA)', () => {
  it('primary text on both surfaces meets 4.5:1', () => {
    expect(contrastRatio(colors.textPrimary, colors.obsidian)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrastRatio(colors.textPrimary, colors.charcoal)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('secondary text on both surfaces meets 4.5:1', () => {
    expect(contrastRatio(colors.textSecondary, colors.obsidian)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrastRatio(colors.textSecondary, colors.charcoal)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('primary text on the Vaal red accent meets 4.5:1 (buttons)', () => {
    expect(contrastRatio(colors.textPrimary, colors.vaalRed)).toBeGreaterThanOrEqual(4.5);
  });

  it('gold emphasis text on surfaces meets 4.5:1', () => {
    expect(contrastRatio(colors.goldBright, colors.obsidian)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.goldBright, colors.charcoal)).toBeGreaterThanOrEqual(4.5);
  });
});
