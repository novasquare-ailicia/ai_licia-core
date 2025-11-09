'use client';

import { PaletteMode } from "@mui/material";
import { createTheme } from "@mui/material/styles";

const surfaceByMode = {
  light: {
    backgroundDefault: "#f4f6fb",
    backgroundPaper: "rgba(255,255,255,0.85)",
    primary: "#7542ff",
    secondary: "#12c8a8",
    textPrimary: "#14151f",
  },
  dark: {
    backgroundDefault: "#04050d",
    backgroundPaper: "rgba(7,8,20,0.78)",
    primary: "#8e2de2",
    secondary: "#29ffc6",
    textPrimary: "#f6f7ff",
  },
} as const;

export const createAppTheme = (mode: PaletteMode) => {
  const palette = surfaceByMode[mode];
  return createTheme({
    palette: {
      mode,
      primary: {
        main: palette.primary,
      },
      secondary: {
        main: palette.secondary,
      },
      background: {
        default: palette.backgroundDefault,
        paper: palette.backgroundPaper,
      },
      text: {
        primary: palette.textPrimary,
      },
    },
    typography: {
      fontFamily:
        '"Space Grotesk", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    shape: {
      borderRadius: 20,
    },
  });
};

export type AppThemeMode = PaletteMode;
