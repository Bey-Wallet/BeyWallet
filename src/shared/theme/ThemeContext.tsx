import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useColorScheme as useNativeColorScheme } from 'react-native';
import { useSettingsStore, type ThemePreference } from '~/state/settingsStore';

interface ThemeContextType {
  themeMode: ThemePreference;
  setThemeMode: (mode: ThemePreference) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeMode = useSettingsStore((state) => state.theme);
  const setThemeMode = useSettingsStore((state) => state.setTheme);
  const initialize = useSettingsStore((state) => state.initialize);
  const systemColorScheme = useNativeColorScheme();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const resolvedTheme =
    themeMode === 'system'
      ? systemColorScheme === 'dark'
        ? 'dark'
        : 'light'
      : (themeMode as 'light' | 'dark');

  const value = useMemo(
    () => ({ themeMode, setThemeMode, resolvedTheme }),
    [themeMode, setThemeMode, resolvedTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
}
