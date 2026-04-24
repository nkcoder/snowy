import { FileCode2, X, Plus } from 'lucide-react';
import { T } from '../lib/tokens';

export interface Tab {
  id: string;
  label: string;          // display name (filename or "schema.table" or "untitled")
  filename: string | null; // null = unsaved
  sql: string;
  dirty: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}

export function TabBar({ tabs, activeTabId, onSelect, onClose, onNew }: TabBarProps) {
  return (
    <div
      data-testid="tab-bar"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        height: 30,
        background: T.chrome,
        borderBottom: `0.5px solid ${T.border}`,
        flexShrink: 0,
        overflowX: 'auto',
        overflowY: 'hidden',
      }}
    >
      {tabs.map(tab => {
        const active = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => onSelect(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '0 10px 0 10px',
              minWidth: 100,
              maxWidth: 200,
              background: active ? T.panel : 'transparent',
              borderRight: `0.5px solid ${T.border}`,
              borderBottom: active ? `2px solid ${T.accent}` : '2px solid transparent',
              color: active ? T.text : T.textDim,
              fontSize: 12,
              cursor: 'pointer',
              userSelect: 'none',
              flexShrink: 0,
              position: 'relative',
            }}
          >
            {/* File icon */}
            <FileCode2 size={12} color={active ? T.accent : T.textDim} style={{ flexShrink: 0 }} />

            {/* Label */}
            <span style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: T.mono,
              fontSize: 11.5,
              fontWeight: active ? 500 : 400,
            }}>
              {tab.label}
            </span>

            {/* Dirty dot + close */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}
              onClick={e => e.stopPropagation()}
            >
              {tab.dirty && (
                <span
                  data-testid={`tab-dirty-${tab.id}`}
                  style={{ color: T.accent, fontSize: 14, lineHeight: 1, marginRight: 2 }}
                  title="Unsaved changes"
                >
                  ●
                </span>
              )}
              <button
                data-testid={`tab-close-${tab.id}`}
                onClick={() => onClose(tab.id)}
                title="Close tab"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: T.textDim,
                  padding: '2px 2px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 3,
                  lineHeight: 1,
                }}
              >
                <X size={11} />
              </button>
            </div>
          </div>
        );
      })}

      {/* New tab button */}
      <button
        data-testid="tab-new"
        onClick={onNew}
        title="New tab"
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          background: 'none',
          border: 'none',
          borderRight: `0.5px solid ${T.border}`,
          cursor: 'pointer',
          color: T.textDim,
          flexShrink: 0,
        }}
      >
        <Plus size={13} />
      </button>
    </div>
  );
}
