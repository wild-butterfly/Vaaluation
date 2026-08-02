import { DEFAULT_SETTINGS } from '@vaaluation/shared-types';
import { settingsFromJSON } from '../src/state/mergeSettings';

describe('settingsFromJSON', () => {
  it('returns defaults for null', () => {
    expect(settingsFromJSON(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults for invalid JSON', () => {
    expect(settingsFromJSON('{not json')).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults for non-object payloads', () => {
    expect(settingsFromJSON('42')).toEqual(DEFAULT_SETTINGS);
    expect(settingsFromJSON('[1,2]')).toEqual(DEFAULT_SETTINGS);
  });

  it('merges persisted fields over defaults', () => {
    const persisted = JSON.stringify({ leagueId: 'Standard', debugLogging: true });
    const result = settingsFromJSON(persisted);
    expect(result.leagueId).toBe('Standard');
    expect(result.debugLogging).toBe(true);
    expect(result.hotkeys).toEqual(DEFAULT_SETTINGS.hotkeys);
    expect(result.onboardingCompleted).toBe(false);
  });

  it('round-trips through JSON', () => {
    const settings = { ...DEFAULT_SETTINGS, onboardingCompleted: true };
    expect(settingsFromJSON(JSON.stringify(settings))).toEqual(settings);
  });
});
