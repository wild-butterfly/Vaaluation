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

/**
 * Overlay palette. The panel sits on a live blur of the game, so surfaces are
 * translucent and borders are hairline — the depth comes from the blur, not
 * from heavy chrome. Text stays fully opaque for readability over any scene.
 */
export const glass = {
  /** Overall panel tint laid over the system blur. */
  surface: 'rgba(18, 15, 18, 0.62)',
  /** Slightly denser band for headers and footers. */
  surfaceStrong: 'rgba(14, 11, 14, 0.78)',
  /** Raised row / input fill. */
  fill: 'rgba(255, 255, 255, 0.06)',
  fillHover: 'rgba(255, 255, 255, 0.10)',
  /** Hairline separators and edges. */
  hairline: 'rgba(255, 255, 255, 0.10)',
  border: 'rgba(201, 179, 126, 0.28)',
  /** Accent wash for the primary action. */
  accent: 'rgba(163, 30, 44, 0.85)',
  accentBorder: 'rgba(201, 58, 71, 0.75)',
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
