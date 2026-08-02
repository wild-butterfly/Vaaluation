import { NativeModules } from 'react-native';
import type { AppSettings } from '@vaaluation/shared-types';
import { settingsFromJSON } from '../state/mergeSettings';

interface VLSettingsNative {
  getSettings(): Promise<string | null>;
  setSettings(json: string): Promise<void>;
}

const native = NativeModules.VLSettings as VLSettingsNative;

export async function loadSettings(): Promise<AppSettings> {
  return settingsFromJSON(await native.getSettings());
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await native.setSettings(JSON.stringify(settings));
}
