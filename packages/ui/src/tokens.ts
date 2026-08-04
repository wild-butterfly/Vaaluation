/**
 * Design tokens for the Obsidian Console direction.
 *
 * Structure and type are identical across themes; only the surface tint,
 * accent, and action colour change. Everything accent-derived flows from
 * `Theme`, so switching the accent flips every screen at once.
 */

export type ThemeName =
  'vaalRed' | 'emberGold' | 'coldSteel' | 'verdantRot' | 'vaalViolet' | 'boneAsh';

export interface Theme {
  readonly name: ThemeName;
  readonly label: string;
  /** Drives borders, active states, item names, histogram bars. */
  readonly accent: string;
  /** Lightened accent used for item names and emphasised numerals. */
  readonly accentText: string;
  /** Primary action button fill. */
  readonly action: string;
  /** Text drawn on the action fill. */
  readonly actionText: string;
  /** Base window surface. */
  readonly window: string;
  /** Overlay gradient endpoints, top to bottom. */
  readonly overlayTop: string;
  readonly overlayBottom: string;
}

export const THEMES: Record<ThemeName, Theme> = {
  /** The brand palette. Red is the accent, so price movement deliberately
   *  avoids red and green — see `semantic` below. */
  vaalRed: {
    name: 'vaalRed',
    label: 'Vaal Red',
    accent: '#9e1122',
    accentText: '#e88a92',
    action: '#b81527',
    actionText: '#ffffff',
    window: '#0c0a0b',
    overlayTop: '#130e11',
    overlayBottom: '#0a0809',
  },
  emberGold: {
    name: 'emberGold',
    label: 'Ember Gold',
    accent: '#d9b25f',
    accentText: '#e7c880',
    action: '#b03a3a',
    actionText: '#ffffff',
    window: '#0d0f13',
    overlayTop: '#12141a',
    overlayBottom: '#0d0f13',
  },
  coldSteel: {
    name: 'coldSteel',
    label: 'Cold Steel',
    accent: '#8fb8d8',
    accentText: '#a9cce6',
    // Handoff specifies #3f78a3, which gives its dark label only 4.02:1.
    // Lifted just enough to clear WCAG AA at 4.73:1.
    action: '#4584b3',
    actionText: '#0c1016',
    window: '#0b0e13',
    overlayTop: '#111620',
    overlayBottom: '#0b0e13',
  },
  verdantRot: {
    name: 'verdantRot',
    label: 'Verdant Rot',
    accent: '#9ec872',
    accentText: '#b6d992',
    action: '#4d7f47',
    actionText: '#ffffff',
    window: '#0a0e0b',
    overlayTop: '#101610',
    overlayBottom: '#0a0e0b',
  },
  vaalViolet: {
    name: 'vaalViolet',
    label: 'Vaal Violet',
    accent: '#b48ad9',
    accentText: '#c9a8e6',
    action: '#7a4fa8',
    actionText: '#ffffff',
    window: '#0f0c15',
    overlayTop: '#16111f',
    overlayBottom: '#0f0c15',
  },
  boneAsh: {
    name: 'boneAsh',
    label: 'Bone Ash',
    accent: '#d8d3c8',
    accentText: '#e6e2da',
    action: '#8a8378',
    // Handoff specifies white here, which is only 3.75:1 on this swatch.
    // The theme's own window colour as the label gives 5.11:1.
    actionText: '#0f0f10',
    window: '#0f0f10',
    overlayTop: '#161618',
    overlayBottom: '#0f0f10',
  },
};

export const DEFAULT_THEME: ThemeName = 'vaalRed';

/** Surfaces that do not change with the accent. */
export const surfaces = {
  rail: '#120e10',
  card: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.055)',
  sunken: 'rgba(0,0,0,0.28)',
  sunkenStrong: 'rgba(0,0,0,0.38)',
  raised: 'rgba(255,255,255,0.07)',
  hover: 'rgba(158,17,34,0.04)',
  hoverStrong: 'rgba(255,255,255,0.08)',
  /** Panel tint laid over the native blur. */
  glassOverlay: 'rgba(18,12,14,0.6)',
  glassWindow: 'rgba(17,11,13,0.62)',
  /** Chip used for mod rows and whisper strips. */
  chip: 'rgba(255,255,255,0.045)',
  chipBorder: 'rgba(255,255,255,0.06)',
} as const;

export const borders = {
  hairline: 'rgba(255,255,255,0.035)',
  subtle: 'rgba(255,255,255,0.055)',
  standard: 'rgba(255,255,255,0.06)',
  strong: 'rgba(255,255,255,0.09)',
  stronger: 'rgba(255,255,255,0.12)',
  glass: 'rgba(255,255,255,0.13)',
  input: 'rgba(255,255,255,0.12)',
  inputDim: 'rgba(255,255,255,0.06)',
  checkbox: 'rgba(255,255,255,0.16)',
  /** Top rim light — the detail that makes a surface read as glass. */
  rimLight: 'rgba(255,255,255,0.16)',
  rimShadow: 'rgba(0,0,0,0.3)',
} as const;

export const text = {
  primary: '#fdf9f7',
  body: '#e0d5ce',
  secondary: '#c1b6ae',
  muted: '#a29890',
  dim: '#8f857e',
  faint: '#5f5a54',
  disabled: '#43403c',
} as const;

/**
 * Red is the brand accent, so price movement deliberately avoids red and
 * green: a rise is muted olive and a fall is ember. Both stay inside the
 * game's own colour range rather than importing web-green.
 */
export const semantic = {
  up: '#8fae6a',
  upSoft: 'rgba(143,174,106,0.12)',
  upText: '#b3d197',
  upBorder: 'rgba(179,209,151,0.24)',
  upBackground: 'rgba(179,209,151,0.1)',
  down: '#c0864f',
  downSoft: 'rgba(192,134,79,0.12)',
  downBorder: 'rgba(192,134,79,0.35)',
  neutral: '#43403c',
  /** Log severity only — deliberately not accent-derived. */
  warn: '#c0864f',
} as const;

export const radii = {
  tag: 4,
  input: 5,
  keycap: 6,
  button: 7,
  field: 8,
  card: 9,
  panel: 11,
  window: 12,
  pill: 20,
  // Aliases used by screens still on the previous naming.
  sm: 5,
  md: 8,
  lg: 12,
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 14,
  h1: 16,
  h2: 18,
  h3: 20,
  h4: 22,
  h5: 24,
  h6: 26,
} as const;

export const type = {
  display: 32,
  xxl: 26,
  xl: 22,
  lg: 21,
  title: 20,
  md: 17,
  price: 15,
  body: 14,
  bodyTight: 13.5,
  ui: 13,
  small: 12.5,
  caption: 12,
  mono: 11.5,
  tiny: 11,
  label: 10.5,
} as const;

/**
 * IBM Plex is bundled with the app; the fallbacks keep text readable if the
 * font ever fails to register.
 */
export const fonts = {
  sans: 'IBM Plex Sans',
  mono: 'IBM Plex Mono',
} as const;

/** Uppercase metadata labels: mono, wide tracking. */
export const labelStyle = {
  fontFamily: fonts.mono,
  fontSize: type.label,
  letterSpacing: 1.3,
  textTransform: 'uppercase',
  color: text.faint,
} as const;

/** Accent at a given alpha, for borders and tinted fills. */
export function alpha(hex: string, value: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${value})`;
}
