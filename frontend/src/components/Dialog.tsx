import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  // Optional third action, rendered as the primary button to the right of the
  // confirm one (e.g. "Save" next to "Close anyway"). When present it takes
  // over the autofocus and the Enter key.
  altLabel?: string;
  onAlt?: () => void;
}

function Backdrop({ children }: { children: React.ReactNode }) {
  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
    >
      {children}
    </div>,
    document.body
  );
}

function Box({
  children,
  onKeyDown,
}: {
  children: React.ReactNode;
  onKeyDown?: React.KeyboardEventHandler;
}) {
  return (
    <div
      style={{
        background: T.panel,
        border: `1px solid ${T.borderStrong}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        fontFamily: T.ui,
      }}
      className="rounded-lg p-5 w-[340px] flex flex-col gap-3.5"
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}

export function InputDialog({
  title,
  placeholder,
  defaultValue = '',
  confirmLabel = 'Save',
  onConfirm,
  onCancel,
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const dotIdx = input.value.lastIndexOf('.');
    input.setSelectionRange(0, dotIdx > 0 ? dotIdx : input.value.length);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) {
      e.preventDefault();
      onConfirm(value.trim());
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Backdrop>
      <Box onKeyDown={handleKeyDown}>
        <div style={{ color: T.text }} className="text-[13px] font-semibold">
          {title}
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            background: T.bg,
            border: `1px solid ${T.border}`,
            color: T.text,
            fontFamily: T.mono,
          }}
          className="w-full box-border px-2.5 py-1.5 text-xs rounded outline-none"
        />
        <div className="flex justify-end gap-2 mt-0.5">
          <button
            type="button"
            style={{
              border: `1px solid ${T.border}`,
              color: T.textSec,
              fontFamily: T.ui,
            }}
            className="px-3.5 py-1 text-xs rounded cursor-pointer bg-transparent"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            style={{ background: T.accent, fontFamily: T.ui }}
            className="px-3.5 py-1 text-xs rounded border-none text-white cursor-pointer font-medium"
            onClick={() => value.trim() && onConfirm(value.trim())}
            disabled={!value.trim()}
          >
            {confirmLabel}
          </button>
        </div>
      </Box>
    </Backdrop>
  );
}

export function ConfirmDialog({
  message,
  confirmLabel = 'Close anyway',
  onConfirm,
  onCancel,
  altLabel,
  onAlt,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const altRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    (altRef.current ?? confirmRef.current)?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (onAlt) onAlt();
      else onConfirm();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Backdrop>
      <Box onKeyDown={handleKeyDown}>
        <div style={{ color: T.text }} className="text-[12.5px] leading-relaxed">
          {message}
        </div>
        <div className="flex justify-end gap-2 mt-0.5">
          <button
            type="button"
            style={{ border: `1px solid ${T.border}`, color: T.textSec, fontFamily: T.ui }}
            className="px-3.5 py-1 text-xs rounded cursor-pointer bg-transparent"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            ref={confirmRef}
            style={{ background: T.err, fontFamily: T.ui }}
            className="px-3.5 py-1 text-xs rounded border-none text-white cursor-pointer font-medium"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          {onAlt && (
            <button
              type="button"
              ref={altRef}
              data-testid="dialog-alt"
              style={{ background: T.accent, fontFamily: T.ui }}
              className="px-3.5 py-1 text-xs rounded border-none text-white cursor-pointer font-medium"
              onClick={onAlt}
            >
              {altLabel}
            </button>
          )}
        </div>
      </Box>
    </Backdrop>
  );
}
