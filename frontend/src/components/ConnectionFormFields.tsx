import { ChevronDown } from 'lucide-react';
import { T } from '../lib/tokens';

export function FieldInput({
  value,
  onChange,
  type = 'text',
  mono = false,
  readOnly = false,
  placeholder,
  'data-testid': testId,
}: {
  value: string | number;
  onChange?: (v: string) => void;
  type?: string;
  mono?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  'data-testid'?: string;
}) {
  return (
    <input
      type={type}
      readOnly={readOnly}
      value={value}
      placeholder={placeholder}
      data-testid={testId}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      onChange={(e) => onChange?.(e.target.value)}
      style={{
        background: T.panelAlt,
        border: `0.5px solid ${T.border}`,
        borderRadius: 4,
        padding: '7px 10px',
        fontSize: 12,
        color: readOnly ? T.textSec : T.text,
        fontFamily: mono ? T.mono : T.ui,
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box' as const,
      }}
      onFocus={(e) => {
        if (!readOnly) e.target.style.borderColor = T.accent;
      }}
      onBlur={(e) => {
        e.target.style.borderColor = T.border;
      }}
    />
  );
}

export function SelectInput({
  value,
  onChange,
  options,
  'data-testid': testId,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  'data-testid'?: string;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        style={{
          background: T.panelAlt,
          border: `0.5px solid ${T.border}`,
          borderRadius: 4,
          padding: '7px 28px 7px 10px',
          fontSize: 12,
          color: T.text,
          fontFamily: T.ui,
          outline: 'none',
          width: '100%',
          appearance: 'none' as const,
          cursor: 'pointer',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <div
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          color: T.textDim,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <ChevronDown size={11} />
      </div>
    </div>
  );
}

// ── FormRow — DataGrip-style label:value row ─────────────────────────────────
export function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '4px 24px', gap: 0 }}>
      <div
        style={{
          width: 136,
          flexShrink: 0,
          fontSize: 12,
          color: T.textSec,
          textAlign: 'right',
          paddingRight: 14,
        }}
      >
        {label}:
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function ElephantIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M3.5 7.5c0-2.5 2-4.2 4.6-4.2 2.7 0 4.6 1.7 4.6 4 0 1.8-1 3-1 3.8l.6 1.6h-1.7l-.5-1.2c-.4.3-1 .4-1.6.4l.3 1.2H7.2l-.5-1.4c-1.1-.2-1.9-.6-2.4-1.1-.3.4-.7.6-1.1.6"
        stroke={color}
        strokeWidth="1.2"
        fill={`${color}22`}
      />
    </svg>
  );
}
