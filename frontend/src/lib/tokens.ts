// Design tokens — CSS custom property references.
// Values live in style.css (:root = SnowyDark, [data-theme=light] = SnowyLight).
// Components should use T.* which resolves to var(--t-*) at runtime.
export const T = {
  bg:             'var(--t-bg)',
  chrome:         'var(--t-chrome)',
  chromeHi:       'var(--t-chrome-hi)',
  panel:          'var(--t-panel)',
  panelAlt:       'var(--t-panel-alt)',
  sidebar:        'var(--t-sidebar)',
  border:         'var(--t-border)',
  borderStrong:   'var(--t-border-strong)',
  divider:        'var(--t-divider)',
  text:           'var(--t-text)',
  textSec:        'var(--t-text-sec)',
  textDim:        'var(--t-text-dim)',
  hover:          'var(--t-hover)',
  selected:       'var(--t-selected)',
  selectedBorder: 'var(--t-selected-border)',
  accent:         'var(--t-accent)',
  accentHover:    'var(--t-accent-hover)',
  ok:             'var(--t-ok)',
  err:            'var(--t-err)',
  warn:           'var(--t-warn)',
  info:           'var(--t-info)',
  mag:            'var(--t-mag)',
  purple:         'var(--t-purple)',
  gridStripe:     'var(--t-grid-stripe)',
  gridHeader:     'var(--t-grid-header)',
  shadow:         'var(--t-shadow)',
  vibrancy:       'var(--t-vibrancy)',
  mono:           'var(--t-font-mono)',
  ui:             'var(--t-font-ui)',
} as const;

export const PROJECT_COLORS = [
  'var(--t-accent)',   // blue
  'var(--t-mag)',      // magenta
  'var(--t-ok)',       // green
  'var(--t-warn)',     // amber
  'var(--t-purple)',   // purple
  'var(--t-err)',      // red
] as const;

export const ENV_COLORS: Record<string, string> = {
  prod:  T.err,
  stg:   T.warn,
  dev:   T.ok,
  local: T.accent,
};
