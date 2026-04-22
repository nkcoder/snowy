// Design tokens — single source of truth.
// Derived from spec/designs/project/components/tokens.jsx
export const T = {
  bg:             '#1a1917',
  chrome:         '#252320',
  panel:          '#1f1d1b',
  panelAlt:       '#232120',
  sidebar:        '#1d1b19',
  border:         'rgba(255,255,255,0.07)',
  borderStrong:   'rgba(255,255,255,0.13)',
  divider:        'rgba(255,255,255,0.05)',
  text:           '#ecebe8',
  textSec:        '#a9a59d',
  textDim:        '#6e6a62',
  hover:          'rgba(255,255,255,0.04)',
  selected:       'oklch(0.28 0.07 240)',
  selectedBorder: 'oklch(0.62 0.17 240)',
  accent:         'oklch(0.62 0.17 240)',
  accentHover:    'oklch(0.68 0.17 240)',
  ok:             'oklch(0.60 0.14 155)',
  err:            'oklch(0.58 0.19 25)',
  warn:           'oklch(0.70 0.15 75)',
  purple:         'oklch(0.58 0.17 290)',
  mono:           '"SF Mono", ui-monospace, "JetBrains Mono", Menlo, monospace',
  ui:             '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
} as const;

export const PROJECT_COLORS = [
  'oklch(0.62 0.17 240)',  // blue
  'oklch(0.60 0.18 320)',  // magenta
  'oklch(0.60 0.14 155)',  // green
  'oklch(0.70 0.15 75)',   // amber
  'oklch(0.58 0.17 290)',  // purple
  'oklch(0.58 0.19 25)',   // red
] as const;

export const ENV_COLORS: Record<string, string> = {
  prod:  T.err,
  stg:   T.warn,
  dev:   T.ok,
  local: T.accent,
};
