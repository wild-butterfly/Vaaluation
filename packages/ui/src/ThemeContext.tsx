import React, { createContext, useContext, useMemo } from 'react';
import type { Theme, ThemeName } from './tokens';
import { DEFAULT_THEME, THEMES } from './tokens';

const ThemeContext = createContext<Theme>(THEMES[DEFAULT_THEME]);

/**
 * Supplies the active theme. Only the accent, action and surface tint differ
 * between themes, so every screen flips together when this changes.
 */
export function ThemeProvider({
  name,
  children,
}: {
  name: ThemeName | undefined;
  children: React.ReactNode;
}) {
  const theme = useMemo(
    () => THEMES[name ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME],
    [name],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
