import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { HistoryEntry } from './HistoryDrawer';
import { HistoryDrawer } from './HistoryDrawer';

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 'e1',
    sql: 'SELECT 1',
    rowCount: 5,
    durationMs: 42,
    executedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('HistoryDrawer', () => {
  it('renders loading state', () => {
    render(<HistoryDrawer entries={[]} loading={true} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('renders empty state when not loading and no entries', () => {
    render(<HistoryDrawer entries={[]} loading={false} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText(/No history yet/)).toBeTruthy();
  });

  it('renders entry list', () => {
    const entries = [
      makeEntry({ id: 'e1', sql: 'SELECT 1' }),
      makeEntry({ id: 'e2', sql: 'SELECT 2' }),
    ];
    render(
      <HistoryDrawer entries={entries} loading={false} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    expect(screen.getByText('SELECT 1')).toBeTruthy();
    expect(screen.getByText('SELECT 2')).toBeTruthy();
  });

  it('calls onSelect with sql when entry is clicked', () => {
    const onSelect = vi.fn();
    const entry = makeEntry({ sql: 'SELECT id FROM users' });
    render(
      <HistoryDrawer entries={[entry]} loading={false} onClose={vi.fn()} onSelect={onSelect} />
    );
    fireEvent.click(screen.getByText('SELECT id FROM users'));
    expect(onSelect).toHaveBeenCalledWith('SELECT id FROM users');
  });

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn();
    render(<HistoryDrawer entries={[]} loading={false} onClose={onClose} onSelect={vi.fn()} />);
    // The X button is the close button in the header
    const closeBtn = document.querySelector('button[type="button"]') as HTMLButtonElement;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<HistoryDrawer entries={[]} loading={false} onClose={onClose} onSelect={vi.fn()} />);
    const backdrop = screen.getByTestId('history-backdrop');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows footer with count when entries exist', () => {
    const entries = [makeEntry({ id: 'e1' }), makeEntry({ id: 'e2' }), makeEntry({ id: 'e3' })];
    render(
      <HistoryDrawer entries={entries} loading={false} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    expect(screen.getByText(/3 recent entr/)).toBeTruthy();
  });

  it('shows singular footer for one entry', () => {
    render(
      <HistoryDrawer
        entries={[makeEntry({ id: 'e1' })]}
        loading={false}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText(/1 recent entry/)).toBeTruthy();
  });

  it('does not show footer when no entries', () => {
    render(<HistoryDrawer entries={[]} loading={false} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.queryByText(/recent entr/)).toBeNull();
  });

  it('truncates long sql in entry display', () => {
    const longSql = 'SELECT ' + 'a, '.repeat(40) + 'b FROM table_name';
    render(
      <HistoryDrawer
        entries={[makeEntry({ sql: longSql })]}
        loading={false}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );
    // Snippet is max 90 chars + ellipsis, but full sql is stored and passed to onSelect
    const entry = screen
      .getAllByRole('button')
      .find((b) => b.textContent && b.textContent.includes('…'));
    expect(entry).toBeTruthy();
  });

  it('does not show loading text when entries present and not loading', () => {
    render(
      <HistoryDrawer
        entries={[makeEntry({ id: 'e1' })]}
        loading={false}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('triggers hover styles on mouse enter/leave', () => {
    const entry = makeEntry({ id: 'e1', sql: 'SELECT 1' });
    render(
      <HistoryDrawer entries={[entry]} loading={false} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    const btn = screen.getByText('SELECT 1').closest('button')!;
    fireEvent.mouseEnter(btn);
    fireEvent.mouseLeave(btn);
    // No assertion needed — just verifying no throw
    expect(btn).toBeTruthy();
  });

  it('shows "just now" for very recent entries', () => {
    const entry = makeEntry({ executedAt: new Date().toISOString() });
    render(
      <HistoryDrawer entries={[entry]} loading={false} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    expect(screen.getByText('just now')).toBeTruthy();
  });

  it('shows seconds ago for entries within a minute', () => {
    const past = new Date(Date.now() - 30 * 1000).toISOString();
    const entry = makeEntry({ executedAt: past });
    render(
      <HistoryDrawer entries={[entry]} loading={false} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    expect(screen.getByText(/s ago/)).toBeTruthy();
  });

  it('shows minutes ago for entries within an hour', () => {
    const past = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const entry = makeEntry({ executedAt: past });
    render(
      <HistoryDrawer entries={[entry]} loading={false} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    expect(screen.getByText(/m ago/)).toBeTruthy();
  });

  it('shows hours ago for entries within a day', () => {
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const entry = makeEntry({ executedAt: past });
    render(
      <HistoryDrawer entries={[entry]} loading={false} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    expect(screen.getByText(/h ago/)).toBeTruthy();
  });

  it('shows days ago for entries older than a day', () => {
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const entry = makeEntry({ executedAt: past });
    render(
      <HistoryDrawer entries={[entry]} loading={false} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    expect(screen.getByText(/d ago/)).toBeTruthy();
  });
});
