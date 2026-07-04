import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FindBar, findMatchInfo, type MatchInfo } from './FindBar';

describe('FindBar', () => {
  function renderFindBar(query = '', overrides: Partial<Parameters<typeof FindBar>[0]> = {}) {
    const onQueryChange = vi.fn();
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const onClose = vi.fn();
    render(
      <FindBar
        query={query}
        onQueryChange={onQueryChange}
        onNext={onNext}
        onPrev={onPrev}
        onClose={onClose}
        {...overrides}
      />
    );
    return { onQueryChange, onNext, onPrev, onClose };
  }

  it('renders input, navigation buttons, and close button', () => {
    renderFindBar();
    expect(screen.getByTestId('find-input')).toBeInTheDocument();
    expect(screen.getByTestId('find-prev')).toBeInTheDocument();
    expect(screen.getByTestId('find-next')).toBeInTheDocument();
    expect(screen.getByTestId('find-close')).toBeInTheDocument();
  });

  it('prev/next buttons are disabled when query is empty', () => {
    renderFindBar('');
    expect(screen.getByTestId('find-prev')).toBeDisabled();
    expect(screen.getByTestId('find-next')).toBeDisabled();
  });

  it('prev/next buttons are enabled when query is non-empty', () => {
    renderFindBar('select');
    expect(screen.getByTestId('find-prev')).not.toBeDisabled();
    expect(screen.getByTestId('find-next')).not.toBeDisabled();
  });

  it('calls onQueryChange when input changes', async () => {
    const { onQueryChange } = renderFindBar('');
    await userEvent.type(screen.getByTestId('find-input'), 'a');
    expect(onQueryChange).toHaveBeenCalledWith('a');
  });

  it('calls onNext when next button clicked', async () => {
    const { onNext } = renderFindBar('select');
    await userEvent.click(screen.getByTestId('find-next'));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('calls onPrev when prev button clicked', async () => {
    const { onPrev } = renderFindBar('select');
    await userEvent.click(screen.getByTestId('find-prev'));
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it('calls onNext on Enter key in input', async () => {
    const { onNext } = renderFindBar('sel');
    await userEvent.type(screen.getByTestId('find-input'), '{Enter}');
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('calls onPrev on Shift+Enter key in input', async () => {
    const { onPrev } = renderFindBar('sel');
    const input = screen.getByTestId('find-input');
    await userEvent.click(input);
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it('calls onClose on Escape key in input', async () => {
    const { onClose } = renderFindBar('sel');
    await userEvent.type(screen.getByTestId('find-input'), '{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when close button clicked', async () => {
    const { onClose } = renderFindBar('sel');
    await userEvent.click(screen.getByTestId('find-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not show match count when matchInfo is null', () => {
    renderFindBar('sel', { matchInfo: null });
    expect(screen.queryByTestId('find-match-count')).not.toBeInTheDocument();
  });

  it('shows "No matches" when matchInfo.total is 0', () => {
    const matchInfo: MatchInfo = { current: 0, total: 0 };
    renderFindBar('xyz', { matchInfo });
    expect(screen.getByTestId('find-match-count')).toHaveTextContent('No matches');
  });

  it('shows "N of M" when matchInfo has matches', () => {
    const matchInfo: MatchInfo = { current: 2, total: 5 };
    renderFindBar('sel', { matchInfo });
    expect(screen.getByTestId('find-match-count')).toHaveTextContent('2 of 5');
  });
});

// Minimal EditorView stub for findMatchInfo tests
function makeView(docText: string, selFrom = 0) {
  return {
    state: {
      doc: { toString: () => docText },
      selection: { main: { from: selFrom } },
    },
    // biome-ignore lint/suspicious/noExplicitAny: test stub
  } as any;
}

describe('findMatchInfo', () => {
  it('returns null for empty search', () => {
    expect(findMatchInfo(makeView('SELECT 1'), '')).toBeNull();
  });

  it('returns { current: 0, total: 0 } when no matches', () => {
    expect(findMatchInfo(makeView('SELECT 1'), 'xyz')).toEqual({ current: 0, total: 0 });
  });

  it('returns correct total and current when selection is on a match', () => {
    const doc = 'SELECT select SELECT';
    // "select" matches at index 0, 7, 14 (case-insensitive)
    const result = findMatchInfo(makeView(doc, 7), 'select');
    expect(result?.total).toBe(3);
    expect(result?.current).toBe(2);
  });

  it('returns current 1 for the first match', () => {
    const result = findMatchInfo(makeView('foo bar foo', 0), 'foo');
    expect(result).toEqual({ current: 1, total: 2 });
  });

  it('returns current 0 when selection is not on any match', () => {
    // selection at position 3 which is between matches
    const result = findMatchInfo(makeView('foo bar foo', 3), 'foo');
    expect(result).toEqual({ current: 0, total: 2 });
  });
});
