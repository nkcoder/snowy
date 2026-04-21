// Snowy — design tokens
// Finance postgres client. Ice-blue signature. macOS-native feel.

const SnowyTokens = {
  // Signature accent — cold icy blue
  accent: {
    50:  'oklch(0.97 0.02 240)',
    100: 'oklch(0.93 0.04 240)',
    200: 'oklch(0.85 0.08 240)',
    400: 'oklch(0.70 0.14 240)',
    500: 'oklch(0.62 0.17 240)',
    600: 'oklch(0.54 0.18 240)',
    700: 'oklch(0.46 0.16 240)',
  },
  // Semantic colors (shared)
  sem: {
    ok:   'oklch(0.60 0.14 155)',
    warn: 'oklch(0.70 0.15 75)',
    err:  'oklch(0.58 0.19 25)',
    info: 'oklch(0.62 0.14 240)',
    mag:  'oklch(0.60 0.18 320)',
    purple: 'oklch(0.58 0.17 290)',
  },
  font: {
    ui: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro", system-ui, sans-serif',
    display: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro", system-ui, sans-serif',
    mono: '"SF Mono", ui-monospace, "JetBrains Mono", Menlo, monospace',
  },
};

// Light theme
const SnowyLight = {
  bg: '#f3f1ec',            // warm off-white macos desktop tint
  chrome: '#e8e5df',         // toolbar/window chrome
  chromeHi: '#f7f5f1',
  panel: '#fbfaf7',          // content panel
  panelAlt: '#f6f4ef',
  border: 'rgba(0,0,0,0.09)',
  borderStrong: 'rgba(0,0,0,0.14)',
  divider: 'rgba(0,0,0,0.06)',
  text: '#1c1b19',
  textSec: '#5a574f',
  textDim: '#8b877d',
  hover: 'rgba(0,0,0,0.04)',
  selected: 'oklch(0.93 0.04 240)',
  selectedBorder: 'oklch(0.70 0.14 240)',
  sidebar: '#e8e5df',
  gridStripe: 'rgba(0,0,0,0.018)',
  gridHeader: '#f0ede7',
  shadow: '0 1px 0 rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.06)',
  vibrancy: 'rgba(232,229,223,0.85)',
};

// Dark theme — not pitch black. Warm graphite.
const SnowyDark = {
  bg: '#1a1917',
  chrome: '#252320',
  chromeHi: '#2d2b27',
  panel: '#1f1d1b',
  panelAlt: '#232120',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.13)',
  divider: 'rgba(255,255,255,0.05)',
  text: '#ecebe8',
  textSec: '#a9a59d',
  textDim: '#6e6a62',
  hover: 'rgba(255,255,255,0.04)',
  selected: 'oklch(0.28 0.07 240)',
  selectedBorder: 'oklch(0.62 0.17 240)',
  sidebar: '#1d1b19',
  gridStripe: 'rgba(255,255,255,0.018)',
  gridHeader: '#232120',
  shadow: '0 1px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(0,0,0,0.4)',
  vibrancy: 'rgba(37,35,32,0.85)',
};

Object.assign(window, { SnowyTokens, SnowyLight, SnowyDark });
