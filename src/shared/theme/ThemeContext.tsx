import React, { createContext, useContext, useEffect } from 'react';
import { useColorScheme as useNativeColorScheme } from 'react-native';
import { useSettingsStore, type ThemePreference } from '~/state/settingsStore';

interface ThemeContextType {
  themeMode: ThemePreference;
  setThemeMode: (mode: ThemePreference) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme: themeMode, setTheme: setThemeMode, initialize } = useSettingsStore();
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

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
}
