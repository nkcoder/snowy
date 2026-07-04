import { T } from '../lib/tokens';

// ── Toolbar icon button ───────────────────────────────────────────────────────
export function ToolBtn({
  icon,
  title,
  onClick,
  disabled,
  color,
  badge,
}: {
  icon: React.ReactNode;
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
  color?: string;
  badge?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        color: disabled ? T.textDim : color || T.textSec,
        cursor: disabled ? 'default' : onClick ? 'pointer' : 'default',
      }}
      className="relative flex items-center justify-center bg-transparent border-0 p-0 shrink-0"
    >
      {icon}
      {badge && (
        <div
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: 9,
            height: 9,
            borderRadius: 5,
            background: T.accent,
            color: '#fff',
            fontSize: 8,
            fontWeight: 800,
            lineHeight: 1,
            border: `1.5px solid ${T.chrome}`,
          }}
          className="flex items-center justify-center"
        >
          +
        </div>
      )}
    </button>
  );
}

// ── Context menu item ─────────────────────────────────────────────────────────
export function CtxMenuItem({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        padding: '5px 14px',
        color: disabled ? T.textDim : T.text,
        cursor: disabled ? 'default' : 'pointer',
      }}
      className={`select-none${disabled ? '' : ' snowy-row'}`}
    >
      {label}
    </div>
  );
}
