import { AlertCircle, AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EventsOff, EventsOn } from '../../wailsjs/runtime/runtime';
import { T } from '../lib/tokens';

type Level = 'warning' | 'error';
interface Notification {
  id: number;
  level: Level;
  message: string;
}

const AUTO_DISMISS_MS = 8000;

export function Toast() {
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    let nextId = 1;
    const handler = (payload: { level?: string; message?: string }) => {
      const level: Level = payload?.level === 'error' ? 'error' : 'warning';
      const message = payload?.message ?? '';
      if (!message) return;
      const id = nextId++;
      setItems((prev) => [...prev, { id, level, message }]);
      setTimeout(() => setItems((prev) => prev.filter((n) => n.id !== id)), AUTO_DISMISS_MS);
    };
    EventsOn('snowy:notification', handler);
    return () => EventsOff('snowy:notification');
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      data-testid="toast-stack"
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 1000,
        maxWidth: 420,
      }}
    >
      {items.map((n) => {
        const accent = n.level === 'error' ? T.err : T.warn;
        const Icon = n.level === 'error' ? AlertCircle : AlertTriangle;
        return (
          <div
            key={n.id}
            data-testid={`toast-${n.level}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 12px',
              background: T.panel,
              border: `0.5px solid ${accent}88`,
              borderLeft: `3px solid ${accent}`,
              borderRadius: 6,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              fontSize: 12,
              color: T.text,
              lineHeight: 1.5,
            }}
          >
            <Icon size={14} color={accent} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, wordBreak: 'break-word' }}>{n.message}</div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setItems((prev) => prev.filter((p) => p.id !== n.id))}
              style={{
                background: 'none',
                border: 'none',
                color: T.textDim,
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
