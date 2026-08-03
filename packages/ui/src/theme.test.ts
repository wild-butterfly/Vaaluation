import { describe, expect, it } from 'vitest';
import { THEMES, semantic, text } from './tokens';

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

const themes = Object.values(THEMES);

describe('theme contrast (WCAG AA)', () => {
  /**
   * Checks the pairings the design actually uses. Each theme picks its own
   * action text colour precisely so the button stays legible — Cold Steel
   * uses dark text on its lighter blue, the others use white.
   */
  it.each(themes)('$label action button text is legible', (theme) => {
    expect(contrastRatio(theme.actionText, theme.action)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(themes)('$label primary text on the window meets 4.5:1', (theme) => {
    expect(contrastRatio(text.primary, theme.window)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(text.body, theme.window)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(themes)('$label item names stay readable on the overlay', (theme) => {
    expect(contrastRatio(theme.accentText, theme.overlayBottom)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it.each(themes)('$label secondary and dim text remain legible', (theme) => {
    expect(contrastRatio(text.secondary, theme.window)).toBeGreaterThanOrEqual(4.5);
    // Dim text carries metadata only, so the large-text threshold applies.
    expect(contrastRatio(text.dim, theme.window)).toBeGreaterThanOrEqual(3);
  });

  it('semantic colours are legible on the darkest surface', () => {
    const darkest = THEMES.verdantRot.window;
    expect(contrastRatio(semantic.up, darkest)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(semantic.down, darkest)).toBeGreaterThanOrEqual(3);
  });
});
