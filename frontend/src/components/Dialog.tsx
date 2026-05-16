import React, { useEffect, useRef, useState } from 'react';
import { T } from '../lib/tokens';

interface BaseProps {
  onCancel: () => void;
}

interface InputDialogProps extends BaseProps {
  title: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
}

interface ConfirmDialogProps extends BaseProps {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {children}
    </div>
  );
}

const boxStyle: React.CSSProperties = {
  background: T.panel,
  border: `1px solid ${T.borderStrong}`,
  borderRadius: 8,
  padding: '20px 22px',
  width: 340,
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  fontFamily: T.ui,
};

const btnRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 2,
};

function cancelBtnStyle(): React.CSSProperties {
  return {
    padding: '5px 14px', fontSize: 12, borderRadius: 4,
    background: 'none', border: `1px solid ${T.border}`,
    color: T.textSec, cursor: 'pointer', fontFamily: T.ui,
  };
}

function confirmBtnStyle(): React.CSSProperties {
  return {
    padding: '5px 14px', fontSize: 12, borderRadius: 4,
    background: T.accent, border: 'none',
    color: '#fff', cursor: 'pointer', fontFamily: T.ui, fontWeight: 500,
  };
}

export function InputDialog({ title, placeholder, defaultValue = '', confirmLabel = 'Save', onConfirm, onCancel }: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) { e.preventDefault(); onConfirm(value.trim()); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  return (
    <Backdrop>
      <div style={boxStyle} onKeyDown={handleKeyDown}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{title}</div>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '6px 10px', fontSize: 12,
            background: T.bg, border: `1px solid ${T.border}`,
            borderRadius: 4, color: T.text, outline: 'none',
            fontFamily: T.mono,
          }}
        />
        <div style={btnRow}>
          <button style={cancelBtnStyle()} onClick={onCancel}>Cancel</button>
          <button style={confirmBtnStyle()} onClick={() => value.trim() && onConfirm(value.trim())} disabled={!value.trim()}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

export function ConfirmDialog({ message, confirmLabel = 'Close anyway', onConfirm, onCancel }: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { confirmRef.current?.focus(); }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  return (
    <Backdrop>
      <div style={boxStyle} onKeyDown={handleKeyDown}>
        <div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.5 }}>{message}</div>
        <div style={btnRow}>
          <button style={cancelBtnStyle()} onClick={onCancel}>Cancel</button>
          <button ref={confirmRef} style={{ ...confirmBtnStyle(), background: T.err }} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}
