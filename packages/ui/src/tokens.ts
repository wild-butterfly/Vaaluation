/**
 * Design tokens for the Obsidian Console direction.
 *
 * Structure and type are identical across themes; only the surface tint,
 * accent, and action colour change. Everything accent-derived flows from
 * `Theme`, so switching the accent flips every screen at once.
 */

export type ThemeName =
  'emberGold' | 'coldSteel' | 'verdantRot' | 'vaalViolet' | 'boneAsh';

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
    action: '#3f78a3',
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
    actionText: '#ffffff',
    window: '#0f0f10',
    overlayTop: '#161618',
    overlayBottom: '#0f0f10',
  },
};

export const DEFAULT_THEME: ThemeName = 'coldSteel';

/** Surfaces that do not change with the accent. */
export const surfaces = {
  rail: '#101216',
  card: '#171b22',
  sunken: 'rgba(0,0,0,0.25)',
  sunkenStrong: 'rgba(0,0,0,0.40)',
  raised: 'rgba(255,255,255,0.02)',
  hover: 'rgba(255,255,255,0.025)',
  hoverStrong: 'rgba(255,255,255,0.04)',
} as const;

export const borders = {
  hairline: 'rgba(255,255,255,0.035)',
  subtle: 'rgba(255,255,255,0.05)',
  standard: 'rgba(255,255,255,0.06)',
  strong: 'rgba(255,255,255,0.09)',
  stronger: 'rgba(255,255,255,0.12)',
  input: 'rgba(255,255,255,0.08)',
  inputDim: 'rgba(255,255,255,0.06)',
  checkbox: 'rgba(255,255,255,0.18)',
} as const;

export const text = {
  primary: '#f2efe8',
  body: '#e2e0da',
  secondary: '#9a9ca3',
  muted: '#8d8f96',
  dim: '#6f727a',
  faint: '#5c5f66',
  disabled: '#4d5057',
} as const;

export const semantic = {
  up: '#7fb069',
  upSoft: 'rgba(127,176,105,0.12)',
  upText: '#a7cf90',
  upBorder: 'rgba(127,176,105,0.18)',
  upBackground: 'rgba(127,176,105,0.07)',
  down: '#c05a5a',
  downSoft: 'rgba(192,90,90,0.12)',
  downBorder: 'rgba(192,90,90,0.35)',
  neutral: '#4d5057',
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
  display: 34,
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
