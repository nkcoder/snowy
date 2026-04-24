import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryEditor } from './QueryEditor';

// CodeMirror uses complex DOM APIs (contenteditable, ResizeObserver, etc.)
// that jsdom doesn't implement. Mock the entire @codemirror/* stack so we can
// test toolbar behaviour without a real editor instance.
vi.mock('@codemirror/view', () => ({
  EditorView: class {
    static theme = () => ({});
    static updateListener = { of: () => ({}) };
    dom = document.createElement('div');
    state = { doc: { toString: () => 'SELECT 1;', length: 9 } };
    dispatch = vi.fn();
    destroy = vi.fn();
    constructor({ parent }: { parent?: Element }) {
      if (parent) parent.appendChild(this.dom);
    }
  },
  keymap: { of: () => ({}) },
  lineNumbers: () => ({}),
  highlightActiveLine: () => ({}),
  highlightActiveLineGutter: () => ({}),
}));

vi.mock('@codemirror/state', () => ({
  EditorState: {
    create: () => ({}),
  },
}));

vi.mock('@codemirror/lang-sql', () => ({ sql: () => ({}) }));
vi.mock('@codemirror/theme-one-dark', () => ({ oneDark: {} }));
vi.mock('@codemirror/commands', () => ({
  defaultKeymap: [],
  history: () => ({}),
  historyKeymap: [],
}));

describe('QueryEditor', () => {
  const defaultProps = {
    sql: 'SELECT 1;',
    onChange: vi.fn(),
    onRun: vi.fn(),
    onSave: vi.fn(),
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders toolbar', () => {
    render(<QueryEditor {...defaultProps} />);
    expect(screen.getByTestId('run-button')).toBeInTheDocument();
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
    expect(screen.getByTestId('clear-button')).toBeInTheDocument();
  });

  it('calls onRun when Execute button clicked', () => {
    render(<QueryEditor {...defaultProps} />);
    fireEvent.click(screen.getByTestId('run-button'));
    expect(defaultProps.onRun).toHaveBeenCalledOnce();
  });

  it('disables Execute button when loading', () => {
    render(<QueryEditor {...defaultProps} loading={true} />);
    expect(screen.getByTestId('run-button')).toBeDisabled();
  });

  it('calls onSave when Save button clicked', () => {
    render(<QueryEditor {...defaultProps} />);
    fireEvent.click(screen.getByTestId('save-button'));
    expect(defaultProps.onSave).toHaveBeenCalledOnce();
  });

  it('renders CodeMirror container', () => {
    render(<QueryEditor {...defaultProps} />);
    expect(screen.getByTestId('cm-editor')).toBeInTheDocument();
  });

  it('shows keyboard shortcut hint', () => {
    render(<QueryEditor {...defaultProps} />);
    expect(screen.getByText(/⌘↵ run/i)).toBeInTheDocument();
  });
});
