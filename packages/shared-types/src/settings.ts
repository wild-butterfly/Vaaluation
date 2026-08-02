/**
 * A keyboard shortcut, stored in a layout-independent form.
 * `keyCode` is the macOS virtual key code; `characters` is a display-only
 * rendering of the key for the current layout (e.g. "D").
 */
export interface KeyCombo {
  readonly keyCode: number;
  readonly characters: string;
  readonly control: boolean;
  readonly option: boolean;
  readonly shift: boolean;
  readonly command: boolean;
}

export type HotkeyAction = 'priceCheck' | 'priceCheckPersistent' | 'toggleOverlay';

export type HotkeyConfig = {
  readonly [K in HotkeyAction]: KeyCombo | null;
};

export interface AppSettings {
  /** Trade league id, e.g. "Standard". Null until leagues are first fetched. */
  readonly leagueId: string | null;
  readonly hotkeys: HotkeyConfig;
  /** Whether the overlay may be dragged to a new position. */
  readonly overlayUnlocked: boolean;
  /** Verbose logging, including full item text. Off by default. */
  readonly debugLogging: boolean;
  /** Whether the user has completed onboarding. */
  readonly onboardingCompleted: boolean;
  /** Settings schema version for future migrations. */
  readonly schemaVersion: 1;
}

/** macOS virtual key codes for the default shortcuts. */
export const KEY_CODE_D = 2;
export const KEY_CODE_SPACE = 49;

export const DEFAULT_SETTINGS: AppSettings = {
  leagueId: null,
  hotkeys: {
    priceCheck: {
      keyCode: KEY_CODE_D,
      characters: 'D',
      control: true,
      option: false,
      shift: false,
      command: false,
    },
    priceCheckPersistent: {
      keyCode: KEY_CODE_D,
      characters: 'D',
      control: true,
      option: true,
      shift: false,
      command: false,
    },
    toggleOverlay: {
      keyCode: KEY_CODE_SPACE,
      characters: 'Space',
      control: false,
      option: false,
      shift: true,
      command: false,
    },
  },
  overlayUnlocked: false,
  debugLogging: false,
  onboardingCompleted: false,
  schemaVersion: 1,
};
