import { useState } from 'react';
import { T } from '../lib/tokens';

// Shared backdrop + centered panel used by the connection-manager dialogs.
// (Distinct from the portal-based Dialog.tsx primitives, which have different
// z-index/opacity/focus behaviour and are not used here.)
function ModalShell({ testId, children }: { testId: string; children: React.ReactNode }) {
  return (
    <div
      data-testid={testId}
      style={{
        position: 'fixed',
        inset: 0,
        background: T.scrim,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: T.panel,
          border: `1px solid ${T.borderStrong}`,
          borderRadius: 8,
          padding: 20,
          width: 360,
          boxShadow: T.shadowModal,
        }}
      >
        {children}
      </div>
    </div>
  );
}

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
    <ModalShell testId="unsaved-changes-dialog">
      <div style={{ fontSize: 13, color: T.text, marginBottom: 16, lineHeight: 1.5 }}>
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
            color: T.onAccent,
            border: 'none',
            borderRadius: 4,
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
            borderRadius: 4,
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
            color: T.onAccent,
            border: 'none',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Save
        </button>
      </div>
    </ModalShell>
  );
}

// ── Confirm delete dialog ────────────────────────────────────────────────────
export function DeleteConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ModalShell testId="confirm-dialog">
      <div style={{ fontSize: 13, color: T.text, marginBottom: 16, lineHeight: 1.5 }}>
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
            borderRadius: 4,
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
            color: T.onAccent,
            border: 'none',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Delete
        </button>
      </div>
    </ModalShell>
  );
}
