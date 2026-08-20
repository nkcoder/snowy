import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryEditor } from './QueryEditor';

// CodeMirror uses complex DOM APIs (contenteditable, ResizeObserver, etc.)
// that jsdom doesn't implement. Mock the entire @codemirror/* stack so we can
// test toolbar behaviour without a real editor instance.

// vi.hoisted ensures these are available inside the hoisted vi.mock factory.
const cmMockState = vi.hoisted(() => ({
  capturedKeyHandlers: [] as Array<{ key: string; run: (v: unknown) => boolean }>,
  lastView: null as {
    dispatch: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    state: { doc: { toString: () => string }; selection: { main: { from: number } } };
  } | null,
}));

vi.mock('@codemirror/view', () => ({
  EditorView: class {
    static theme = () => ({});
    static updateListener = { of: () => ({}) };
    dom = document.createElement('div');
    state = {
      doc: { toString: () => 'SELECT 1;', length: 9 },
      selection: { main: { from: 0, to: 0, empty: true } },
    };
    dispatch = vi.fn();
    destroy = vi.fn();
    focus = vi.fn();
    constructor({ parent }: { parent?: Element }) {
      if (parent) parent.appendChild(this.dom);
      // biome-ignore lint/suspicious/noExplicitAny: store ref for tests
      cmMockState.lastView = this as any;
    }
  },
  keymap: {
    of: (handlers: Array<{ key: string; run: (v: unknown) => boolean }>) => {
      cmMockState.capturedKeyHandlers.push(...handlers);
      return {};
    },
  },
  tooltips: () => ({}),
  lineNumbers: () => ({}),
  scrollPastEnd: () => ({}),
  highlightActiveLine: () => ({}),
  highlightActiveLineGutter: () => ({}),
  Decoration: { mark: () => ({}) },
  ViewPlugin: { fromClass: () => ({}) },
}));

vi.mock('@codemirror/state', () => ({
  EditorState: {
    create: () => ({}),
  },
  Compartment: class {
    of = () => ({});
    reconfigure = () => ({});
  },
  Prec: {
    high: (ext: unknown) => ext,
    highest: (ext: unknown) => ext,
  },
}));

vi.mock('@codemirror/autocomplete', () => ({ autocompletion: () => ({}) }));
vi.mock('@codemirror/lang-sql', () => ({ sql: () => ({}), PostgreSQL: {} }));
vi.mock('@codemirror/theme-one-dark', () => ({ oneDark: {} }));
vi.mock('@codemirror/commands', () => ({
  defaultKeymap: [],
  history: () => ({}),
  historyKeymap: [],
  insertNewline: () => false,
}));

vi.mock('@codemirror/language', () => ({
  HighlightStyle: { define: () => ({}) },
  syntaxHighlighting: () => ({}),
}));

vi.mock('@codemirror/search', () => ({
  search: () => ({}),
  searchKeymap: [],
  SearchQuery: class {},
  setSearchQuery: { of: vi.fn() },
  findNext: vi.fn(),
  findPrevious: vi.fn(),
  openSearchPanel: vi.fn(),
  closeSearchPanel: vi.fn(),
}));

describe('QueryEditor', () => {
  const defaultProps = {
    sql: 'SELECT 1;',
    onChange: vi.fn(),
    onRun: vi.fn(),
    onSave: vi.fn(),
    onOpenHistory: vi.fn(),
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cmMockState.capturedKeyHandlers.length = 0;
    cmMockState.lastView = null;
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

  it('calls onOpenHistory when History button clicked', () => {
    render(<QueryEditor {...defaultProps} />);
    fireEvent.click(screen.getByTitle('History'));
    expect(defaultProps.onOpenHistory).toHaveBeenCalledOnce();
  });

  it('renders CodeMirror container', () => {
    render(<QueryEditor {...defaultProps} />);
    expect(screen.getByTestId('cm-editor')).toBeInTheDocument();
  });

  it('shows keyboard shortcut hint', () => {
    render(<QueryEditor {...defaultProps} />);
    expect(screen.getByText(/⌘↵ run/i)).toBeInTheDocument();
  });

  it('does not show find bar initially', () => {
    render(<QueryEditor {...defaultProps} />);
    expect(screen.queryByTestId('find-bar')).not.toBeInTheDocument();
  });

  describe('content reconciliation', () => {
    it('applies external sql changes as a minimal edit, not a full-document replace', () => {
      // Mock doc is fixed at 'SELECT 1;'. Rerendering with 'SELECT 2;' should
      // patch only the differing character so CodeMirror keeps the caret put,
      // instead of replacing the whole document (which collapses the caret).
      const { rerender } = render(<QueryEditor {...defaultProps} sql="SELECT 1;" />);
      const view = cmMockState.lastView!;
      view.dispatch.mockClear();

      rerender(<QueryEditor {...defaultProps} sql="SELECT 2;" />);

      expect(view.dispatch).toHaveBeenCalledWith({
        changes: { from: 7, to: 8, insert: '2' },
      });
    });

    it('does not dispatch when the sql prop matches the current document', () => {
      const { rerender } = render(<QueryEditor {...defaultProps} sql="SELECT 1;" />);
      const view = cmMockState.lastView!;
      view.dispatch.mockClear();

      rerender(<QueryEditor {...defaultProps} sql="SELECT 1;" />);

      expect(view.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('find bar integration', () => {
    function openFindBar() {
      render(<QueryEditor {...defaultProps} />);
      act(() => {
        const modF = cmMockState.capturedKeyHandlers.find((h) => h.key === 'Mod-f');
        modF?.run(cmMockState.lastView!);
      });
    }

    it('opens find bar when Mod-f keymap handler is invoked', () => {
      openFindBar();
      expect(screen.getByTestId('find-bar')).toBeInTheDocument();
    });

    it('handleFindChange updates query and dispatches search effect', async () => {
      openFindBar();
      await userEvent.type(screen.getByTestId('find-input'), 'sel');
      expect(cmMockState.lastView!.dispatch).toHaveBeenCalled();
    });

    it('handleFindNext dispatches after find-next click', async () => {
      openFindBar();
      await userEvent.type(screen.getByTestId('find-input'), 'sel');
      await userEvent.click(screen.getByTestId('find-next'));
      expect(cmMockState.lastView!.dispatch).toHaveBeenCalled();
    });

    it('handleFindPrev dispatches after find-prev click', async () => {
      openFindBar();
      await userEvent.type(screen.getByTestId('find-input'), 'sel');
      await userEvent.click(screen.getByTestId('find-prev'));
      expect(cmMockState.lastView!.dispatch).toHaveBeenCalled();
    });

    it('handleFindClose hides bar and focuses editor', async () => {
      openFindBar();
      await userEvent.click(screen.getByTestId('find-close'));
      expect(screen.queryByTestId('find-bar')).not.toBeInTheDocument();
      expect(cmMockState.lastView!.focus).toHaveBeenCalled();
    });
  });
});
