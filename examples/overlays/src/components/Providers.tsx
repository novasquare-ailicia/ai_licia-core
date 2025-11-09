'use client';

import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { CssBaseline, PaletteMode, ThemeProvider } from "@mui/material";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { createAppTheme } from "@/theme";

interface ThemeModeContextValue {
  mode: PaletteMode;
  setMode: (mode: PaletteMode) => void;
  toggleMode: () => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: "dark",
  setMode: () => {},
  toggleMode: () => {},
});

const STORAGE_KEY = "ai_licia_theme_mode";

export const useThemeMode = () => useContext(ThemeModeContext);

const resolveInitialMode = (): PaletteMode => {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
};

export const Providers = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<PaletteMode>(() => resolveInitialMode());

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", mode);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch (error) {
      console.warn("Failed to persist theme mode", error);
    }
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      toggleMode: () => setMode((prev) => (prev === "dark" ? "light" : "dark")),
    }),
    [mode]
  );

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeModeContext.Provider value={value}>
      <AppRouterCacheProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </AppRouterCacheProvider>
    </ThemeModeContext.Provider>
  );
};
