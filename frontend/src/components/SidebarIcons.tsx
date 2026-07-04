import { T } from '../lib/tokens';

// ── Postgres elephant glyph ───────────────────────────────────────────────────
export function ElephantIcon({ size = 14, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M3.5 7.5c0-2.5 2-4.2 4.6-4.2 2.7 0 4.6 1.7 4.6 4 0 1.8-1 3-1 3.8l.6 1.6h-1.7l-.5-1.2c-.4.3-1 .4-1.6.4l.3 1.2H7.2l-.5-1.4c-1.1-.2-1.9-.6-2.4-1.1-.3.4-.7.6-1.1.6"
        stroke={color}
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill={`${color}22`}
      />
      <circle cx="10.4" cy="6.2" r=".6" fill={color} />
    </svg>
  );
}

// ── Column type glyph ─────────────────────────────────────────────────────────
export function ColIcon({ kind }: { kind?: 'pk' | 'fk' }) {
  if (kind === 'pk') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
        <rect
          x="3"
          y="4"
          width="10"
          height="8"
          rx="1"
          fill="none"
          stroke={T.warn}
          strokeWidth="1.3"
        />
        <circle cx="11" cy="5.5" r="1.4" fill={T.warn} />
      </svg>
    );
  }
  if (kind === 'fk') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
        <rect
          x="3"
          y="4"
          width="10"
          height="8"
          rx="1"
          fill="none"
          stroke={T.accent}
          strokeWidth="1.3"
        />
        <path d="M10 5.5l2.5 2.5L10 10.5" stroke={T.accent} strokeWidth="1.2" fill="none" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
      <rect
        x="3"
        y="4"
        width="10"
        height="8"
        rx="1"
        fill="none"
        stroke={T.textDim}
        strokeWidth="1.3"
      />
    </svg>
  );
}

// ── Database (cylinder) ───────────────────────────────────────────────────────
export function DatabaseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke={T.textSec}
      strokeWidth="1.5"
    >
      <ellipse cx="8" cy="4" rx="5" ry="1.8" />
      <path d="M3 4v4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4" />
      <path d="M3 8v4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V8" />
    </svg>
  );
}

// ── Schema ────────────────────────────────────────────────────────────────────
export function SchemaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={T.accent} strokeWidth="1.5">
      <rect x="2" y="3" width="5" height="4" rx="1" />
      <rect x="9" y="9" width="5" height="4" rx="1" />
      <path d="M4.5 7v2.5a1 1 0 001 1H9" />
    </svg>
  );
}

// ── Keys ──────────────────────────────────────────────────────────────────────
export function KeysIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="5.5" cy="8" r="3.5" stroke={T.warn} strokeWidth="1.3" />
      <path d="M8.5 8h5M11.5 8v2" stroke={T.warn} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// ── Index (stacked lines) ─────────────────────────────────────────────────────
export function IndexIcon({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2 4h12M4 8h8M6 12h4" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ── Check constraint (boxed tick) ─────────────────────────────────────────────
export function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="2" y="2" width="12" height="12" rx="2" stroke={T.textSec} strokeWidth="1.3" />
      <path
        d="M5 8l2 2 4-4"
        stroke={T.textSec}
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
