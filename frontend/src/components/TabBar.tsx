import { FileCode2, Plus, X } from 'lucide-react';
import { T } from '../lib/tokens';

export interface Tab {
  id: string;
  label: string;
  filename: string | null;
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
        background: T.chrome,
        borderBottom: `0.5px solid ${T.border}`,
      }}
      className="flex items-stretch h-[30px] shrink-0 overflow-x-auto overflow-y-hidden"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => onSelect(tab.id)}
            style={{
              background: active ? T.panel : 'transparent',
              borderRight: `0.5px solid ${T.border}`,
              borderBottom: active ? `2px solid ${T.accent}` : '2px solid transparent',
              color: active ? T.text : T.textSec,
            }}
            className="flex items-center gap-1 px-2.5 min-w-[100px] max-w-[200px] text-xs cursor-pointer select-none shrink-0 relative"
          >
            <FileCode2 size={12} color={active ? T.accent : T.textDim} className="shrink-0" />
            <span
              style={{ fontFamily: T.mono, fontWeight: active ? 600 : 400 }}
              className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px]"
            >
              {tab.label}
            </span>
            <div
              className="flex items-center gap-0.5 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {tab.dirty && (
                <span
                  data-testid={`tab-dirty-${tab.id}`}
                  style={{ color: T.accent }}
                  className="text-sm leading-none mr-0.5"
                  title="Unsaved changes"
                >
                  ●
                </span>
              )}
              <button
                type="button"
                data-testid={`tab-close-${tab.id}`}
                onClick={() => onClose(tab.id)}
                title="Close tab"
                style={{ color: T.textDim }}
                className="bg-transparent border-none cursor-pointer p-[2px] flex items-center rounded-[3px] leading-none"
              >
                <X size={11} />
              </button>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        data-testid="tab-new"
        onClick={onNew}
        title="New tab"
        style={{
          borderRight: `0.5px solid ${T.border}`,
          color: T.textDim,
        }}
        className="flex items-center px-2 bg-transparent border-none cursor-pointer shrink-0"
      >
        <Plus size={13} />
      </button>
    </div>
  );
}
