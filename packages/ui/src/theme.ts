import { THEMES, borders, semantic, surfaces, text } from './tokens';

/**
 * Compatibility palette.
 *
 * Screens written before the design system landed import `colors` and
 * `glass`. Both now resolve to Obsidian Console token values so those screens
 * inherit the design without a rewrite. Accent-derived entries fall back to
 * the default theme — anything that must follow the user's chosen accent
 * should call `useTheme()` instead of reading from here.
 */
const fallback = THEMES.vaalRed;

export const colors = {
  obsidian: fallback.window,
  charcoal: surfaces.card,
  charcoalHover: surfaces.hoverStrong,
  vaalRed: fallback.action,
  vaalRedBright: fallback.accent,
  gold: 'rgba(255,255,255,0.09)',
  goldBright: fallback.accentText,
  textPrimary: text.primary,
  textSecondary: text.secondary,
  textDisabled: text.faint,
  success: semantic.up,
  warning: semantic.down,
  danger: semantic.down,
  online: semantic.up,
  offline: text.disabled,
} as const;

export const glass = {
  surface: surfaces.card,
  surfaceStrong: surfaces.rail,
  fill: 'rgba(255,255,255,0.06)',
  fillHover: surfaces.hoverStrong,
  hairline: borders.hairline,
  border: borders.standard,
  accent: fallback.action,
  accentBorder: fallback.accent,
} as const;

export const typography = {
  sizeCaption: 11,
  sizeBody: 13,
  sizeTitle: 15,
  sizeHeading: 20,
} as const;

export type ThemeColors = typeof colors;
