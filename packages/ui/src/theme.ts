/**
 * Vaaluation visual language: obsidian/charcoal surfaces, Vaal-inspired
 * dark red accents, muted gold borders. All pairings meet WCAG AA on
 * their intended surfaces.
 */
export const colors = {
  /** Window background. */
  obsidian: '#161216',
  /** Raised surface (cards, rows). */
  charcoal: '#211B21',
  /** Subtle surface hover state. */
  charcoalHover: '#2A222A',
  /** Vaal red — primary accent, used sparingly. */
  vaalRed: '#A31E2C',
  vaalRedBright: '#C93A47',
  /** Muted gold — borders and emphasis. */
  gold: '#8C7A4B',
  goldBright: '#C9B37E',
  /** Text. */
  textPrimary: '#EDE6DA',
  textSecondary: '#A99F91',
  textDisabled: '#6B635B',
  /** Semantic. */
  success: '#5FA46B',
  warning: '#C9A24B',
  danger: '#C94747',
  online: '#5FA46B',
  offline: '#6B635B',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radii = {
  sm: 4,
  md: 6,
  lg: 10,
} as const;

export const typography = {
  /** macOS system font is applied by default in React Native macOS. */
  sizeCaption: 11,
  sizeBody: 13,
  sizeTitle: 15,
  sizeHeading: 18,
} as const;

export type ThemeColors = typeof colors;
