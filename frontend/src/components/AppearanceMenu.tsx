import { Check, Monitor, Moon, Settings, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  applyTheme,
  readStoredMode,
  storeMode,
  systemPrefersDark,
  type ThemeMode,
} from '../lib/theme';
import { T } from '../lib/tokens';

const OPTIONS: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'system', label: 'System', icon: <Monitor size={13} /> },
  { mode: 'dark', label: 'Dark', icon: <Moon size={13} /> },
  { mode: 'light', label: 'Light', icon: <Sun size={13} /> },
];

// Sidebar-footer button that opens a small System / Dark / Light picker. The
// choice persists in localStorage and, in System mode, tracks the macOS
// appearance live.
export function AppearanceMenu() {
  const [mode, setMode] = useState<ThemeMode>(readStoredMode);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Apply on change, and follow the OS while in System mode.
  useEffect(() => {
    applyTheme(mode, systemPrefersDark());
    if (mode !== 'system' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system', mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  // Dismiss on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (m: ThemeMode) => {
    setMode(m);
    storeMode(m);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative flex items-center">
      <button
        type="button"
        data-testid="appearance-button"
        aria-label="Appearance"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Appearance"
        onClick={() => setOpen((o) => !o)}
        style={{ color: open ? T.textSec : T.textDim }}
        className="cursor-pointer p-1 flex items-center rounded bg-transparent border-none"
      >
        <Settings size={13} />
      </button>
      {open && (
        <div
          role="menu"
          data-testid="appearance-menu"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 'calc(100% + 6px)',
            zIndex: 1000,
            minWidth: 140,
            padding: '4px 0',
            background: T.panel,
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            boxShadow: T.shadow,
            fontSize: 12.5,
            fontFamily: T.ui,
          }}
        >
          {OPTIONS.map(({ mode: m, label, icon }) => (
            <div
              key={m}
              role="menuitemradio"
              aria-checked={mode === m}
              tabIndex={0}
              data-testid={`appearance-${m}`}
              onClick={() => choose(m)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  choose(m);
                }
              }}
              style={{ padding: '5px 12px', color: T.text, cursor: 'pointer' }}
              className="flex items-center gap-2 select-none snowy-row"
            >
              <span style={{ color: T.textSec }} className="flex items-center">
                {icon}
              </span>
              <span className="flex-1">{label}</span>
              {mode === m && <Check size={12} color={T.accent} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
