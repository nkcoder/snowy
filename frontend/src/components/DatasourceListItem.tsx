import { ENV_COLORS, T } from '../lib/tokens';
import type { Datasource } from '../types';
import { ElephantIcon } from './ConnectionFormFields';

interface DatasourceListItemProps {
  ds: Datasource;
  selected: boolean;
  isActive: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
}

export function DatasourceListItem({
  ds,
  selected,
  isActive,
  onSelect,
  onDoubleClick,
}: DatasourceListItemProps) {
  const envColor = ENV_COLORS[ds.env] ?? T.textSec;
  return (
    <div
      data-testid={`ds-item-${ds.id}`}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        background: selected ? T.selected : 'transparent',
        borderLeft: `2px solid ${selected ? T.selectedBorder : 'transparent'}`,
        borderRadius: 4,
        marginBottom: 1,
        cursor: 'pointer',
        userSelect: 'none' as const,
      }}
    >
      <ElephantIcon color={envColor} size={14} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: selected ? 600 : 500,
            color: T.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {ds.name}
        </div>
        <div style={{ fontSize: 10.5, color: T.textDim, fontFamily: T.mono }}>{ds.host}</div>
      </div>
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          flexShrink: 0,
          background: isActive ? T.ok : T.textDim,
          boxShadow: isActive ? `0 0 4px ${T.ok}` : 'none',
        }}
      />
    </div>
  );
}
