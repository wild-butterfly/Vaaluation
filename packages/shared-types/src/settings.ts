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

/**
 * Modifiers sent with C to make the game copy an item. Path of Exile copies
 * the advanced item description on Ctrl + <Highlight> + C, and Highlight
 * defaults to Alt (Option on macOS). Players who rebind Highlight need the
 * other options.
 */
export type CopyModifiers = 'control-option' | 'control' | 'control-shift' | 'command';

/** Accent themes from the design system. */
export type ThemeSetting =
  'emberGold' | 'coldSteel' | 'verdantRot' | 'vaalViolet' | 'boneAsh';

export interface AppSettings {
  /** Accent theme; switching it re-tints every screen. */
  readonly theme: ThemeSetting;
  /** Trade league id, e.g. "Standard". Null until leagues are first fetched. */
  readonly leagueId: string | null;
  readonly copyModifiers: CopyModifiers;
  /**
   * Watch the client log for trade whispers. Off by default: the log also
   * contains private conversation, so reading it is the user's choice.
   */
  readonly tradeWhispersEnabled: boolean;
  /** Raise the overlay automatically when a buy request arrives. */
  readonly showOverlayOnTradeWhisper: boolean;
  /** Canned whispers offered on a trade request. Each send is one command. */
  readonly quickReplies: readonly string[];
  /** Sent by the one-press Thanks button. */
  readonly thanksMessage: string;
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
  theme: 'coldSteel',
  leagueId: null,
  copyModifiers: 'control-option',
  tradeWhispersEnabled: false,
  showOverlayOnTradeWhisper: true,
  quickReplies: [
    'Hi, I am ready to trade. Sending an invite now.',
    'Hi, one moment please.',
    'Sorry, that one is already sold.',
  ],
  thanksMessage: 'Thanks, have a nice day!',
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
