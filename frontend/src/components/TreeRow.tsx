import { ChevronDown, ChevronRight } from 'lucide-react';
import { T } from '../lib/tokens';

export const ROW_H = 24;

// ── TreeRow primitive ─────────────────────────────────────────────────────────
export function TreeRow({
  depth,
  expanded,
  hasChildren = true,
  icon,
  label,
  meta,
  selected,
  onClick,
  onDoubleClick,
  onContextMenu,
  badge,
  actions,
  dim = false,
  bold = false,
  small = false,
  'data-testid': testId,
}: {
  depth: number;
  expanded?: boolean;
  hasChildren?: boolean;
  icon?: React.ReactNode;
  label: React.ReactNode;
  meta?: string | number;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  dim?: boolean;
  bold?: boolean;
  small?: boolean;
  'data-testid'?: string;
}) {
  const pad = 6 + depth * 14;
  return (
    <div
      data-testid={testId}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      style={{
        height: small ? 22 : ROW_H,
        paddingLeft: pad,
        paddingRight: 8,
        background: selected ? T.selected : 'transparent',
        borderLeft: `2px solid ${selected ? T.selectedBorder : 'transparent'}`,
        color: dim ? T.textDim : T.text,
        fontSize: small ? 11 : 13,
        fontWeight: bold ? 600 : selected ? 600 : 400,
        cursor: onClick ? 'pointer' : 'default',
      }}
      className={`flex items-center gap-1.5 select-none relative shrink-0 snowy-row`}
    >
      {hasChildren ? (
        <div className="flex items-center shrink-0" style={{ width: 14, color: T.textDim }}>
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </div>
      ) : (
        <div className="shrink-0" style={{ width: 14 }} />
      )}
      {icon && <div className="flex items-center shrink-0">{icon}</div>}
      <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{label}</div>
      {meta !== undefined && (
        <div
          className="shrink-0"
          style={{ fontSize: 11, color: T.textDim, fontFamily: T.mono, marginLeft: 4 }}
        >
          {meta}
        </div>
      )}
      {badge}
      {actions}
    </div>
  );
}
