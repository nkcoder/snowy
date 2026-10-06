// Appearance: SnowyDark is the `:root` default; SnowyLight is the
// `[data-theme="light"]` override in style.css. The user picks System / Dark /
// Light; System follows the macOS appearance.
export type ThemeMode = 'system' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'snowy:theme';
const MODES: readonly ThemeMode[] = ['system', 'dark', 'light'];

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'system') return prefersDark ? 'dark' : 'light';
  return mode;
}

// localStorage can throw (blocked site data, private windows); the app must
// still render, so every access is guarded.
export function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return MODES.includes(v as ThemeMode) ? (v as ThemeMode) : 'system';
  } catch {
    return 'system';
  }
}

export function storeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Non-fatal: the choice just won't persist.
  }
}

export function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : true;
}

export function applyTheme(mode: ThemeMode, prefersDark: boolean): void {
  const root = document.documentElement;
  if (resolveTheme(mode, prefersDark) === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');
}
