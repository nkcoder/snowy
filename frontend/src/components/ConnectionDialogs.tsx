import { useState } from 'react';
import { T } from '../lib/tokens';

// ── Unsaved changes dialog ───────────────────────────────────────────────────
export function UnsavedChangesDialog({
  onDiscard,
  onCancel,
  onSave,
}: {
  onDiscard: () => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      data-testid="unsaved-changes-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: T.panel,
          border: `0.5px solid ${T.borderStrong}`,
          borderRadius: 10,
          padding: '24px 28px',
          width: 360,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ fontSize: 14, color: T.text, marginBottom: 20, lineHeight: 1.5 }}>
          You have unsaved changes. What would you like to do?
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            data-testid="unsaved-discard"
            onClick={onDiscard}
            disabled={saving}
            style={{
              padding: '5px 14px',
              background: T.err,
              color: '#fff',
              border: 'none',
              borderRadius: 5,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Discard
          </button>
          <button
            type="button"
            data-testid="unsaved-cancel"
            onClick={onCancel}
            disabled={saving}
            style={{
              padding: '5px 14px',
              background: T.panelAlt,
              color: T.textSec,
              border: `0.5px solid ${T.border}`,
              borderRadius: 5,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="unsaved-save"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '5px 14px',
              background: T.accent,
              color: '#fff',
              border: 'none',
              borderRadius: 5,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm delete dialog ────────────────────────────────────────────────────
export function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      data-testid="confirm-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: T.panel,
          border: `0.5px solid ${T.borderStrong}`,
          borderRadius: 10,
          padding: '24px 28px',
          width: 360,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ fontSize: 14, color: T.text, marginBottom: 20, lineHeight: 1.5 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            data-testid="confirm-cancel"
            onClick={onCancel}
            style={{
              padding: '5px 14px',
              background: T.panelAlt,
              color: T.textSec,
              border: `0.5px solid ${T.border}`,
              borderRadius: 5,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="confirm-ok"
            onClick={onConfirm}
            style={{
              padding: '5px 14px',
              background: T.err,
              color: '#fff',
              border: 'none',
              borderRadius: 5,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
