import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, KEY_CODE_D, KEY_CODE_SPACE } from './settings';

describe('DEFAULT_SETTINGS', () => {
  it('matches the documented default shortcuts', () => {
    const { priceCheck, priceCheckPersistent, toggleOverlay } = DEFAULT_SETTINGS.hotkeys;

    // Ctrl+D
    expect(priceCheck).toMatchObject({
      keyCode: KEY_CODE_D,
      control: true,
      option: false,
      shift: false,
      command: false,
    });

    // Ctrl+Option+D
    expect(priceCheckPersistent).toMatchObject({
      keyCode: KEY_CODE_D,
      control: true,
      option: true,
      shift: false,
      command: false,
    });

    // Shift+Space
    expect(toggleOverlay).toMatchObject({
      keyCode: KEY_CODE_SPACE,
      control: false,
      option: false,
      shift: true,
      command: false,
    });
  });

  it('never uses the Command modifier by default (conflicts with system shortcuts)', () => {
    for (const combo of Object.values(DEFAULT_SETTINGS.hotkeys)) {
      expect(combo?.command).toBe(false);
    }
  });

  it('starts with onboarding incomplete, no league, and debug logging off', () => {
    expect(DEFAULT_SETTINGS.onboardingCompleted).toBe(false);
    expect(DEFAULT_SETTINGS.leagueId).toBeNull();
    expect(DEFAULT_SETTINGS.debugLogging).toBe(false);
  });

  it('round-trips through JSON without loss', () => {
    expect(JSON.parse(JSON.stringify(DEFAULT_SETTINGS))).toEqual(DEFAULT_SETTINGS);
  });
});
