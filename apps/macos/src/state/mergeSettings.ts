import type { AppSettings } from '@vaaluation/shared-types';
import { DEFAULT_SETTINGS } from '@vaaluation/shared-types';

/**
 * Turns a persisted JSON payload back into AppSettings, merging over defaults
 * so fields added in newer versions pick up their default values. Any invalid
 * payload falls back to the defaults — settings are never a fatal error.
 */
export function settingsFromJSON(json: string | null): AppSettings {
  if (json == null) {
    return DEFAULT_SETTINGS;
  }
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return DEFAULT_SETTINGS;
    }
    return { ...DEFAULT_SETTINGS, ...(parsed as Partial<AppSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
