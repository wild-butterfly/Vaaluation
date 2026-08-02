import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AppSettings } from '@vaaluation/shared-types';
import { DEFAULT_SETTINGS } from '@vaaluation/shared-types';
import { loadSettings, saveSettings } from '../native/VLSettings';
import { log } from '../native/VLLog';

interface SettingsContextValue {
  settings: AppSettings;
  loaded: boolean;
  update(partial: Partial<AppSettings>): void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSettings()
      .then((value) => {
        if (!cancelled) {
          setSettings(value);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          log('error', 'settings', 'Failed to load settings; using defaults');
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((partial: Partial<AppSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...partial };
      saveSettings(next).catch(() => {
        log('error', 'settings', 'Failed to persist settings');
      });
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, loaded, update }), [settings, loaded, update]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (value === null) {
    throw new Error('useSettings must be used inside SettingsProvider');
  }
  return value;
}
