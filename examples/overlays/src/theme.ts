'use client';

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#8e2de2',
    },
    secondary: {
      main: '#29ffc6',
    },
    background: {
      default: '#04050d',
      paper: 'rgba(7,8,20,0.7)',
    },
  },
  typography: {
    fontFamily: '"Space Grotesk", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  shape: {
    borderRadius: 20,
  },
});

export default theme;
