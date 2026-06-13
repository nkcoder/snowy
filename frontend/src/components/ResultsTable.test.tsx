import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResultsTable } from './ResultsTable';

describe('ResultsTable', () => {
  it('renders empty state when data is null', () => {
    render(<ResultsTable data={null} />);
    expect(screen.getByText('Execute a query to view results')).toBeTruthy();
  });

  it('renders column headers', () => {
    render(<ResultsTable data={{ columns: ['id', 'name', 'email'], rows: [] }} />);
    expect(screen.getByText('id')).toBeTruthy();
    expect(screen.getByText('name')).toBeTruthy();
    expect(screen.getByText('email')).toBeTruthy();
  });

  it('renders row data', () => {
    render(
      <ResultsTable
        data={{
          columns: ['id', 'name'],
          rows: [
            [1, 'Alice'],
            [2, 'Bob'],
          ],
        }}
      />
    );
    // row numbers + data values both contain '1' and '2'
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('renders null cells as italic "null"', () => {
    render(<ResultsTable data={{ columns: ['val'], rows: [[null]] }} />);
    const nullEl = screen.getByText('null');
    expect(nullEl.className).toContain('italic');
  });

  it('renders "Success. 0 rows affected." for empty rows', () => {
    render(<ResultsTable data={{ columns: ['id'], rows: [] }} />);
    expect(screen.getByText('Success. 0 rows affected.')).toBeTruthy();
  });

  it('shows truncation notice when truncated=true', () => {
    render(<ResultsTable data={{ columns: ['id'], rows: [[1]] }} truncated={true} />);
    expect(screen.getByText(/Showing first 1,000 rows/)).toBeTruthy();
  });

  it('does not show truncation notice when truncated=false', () => {
    render(<ResultsTable data={{ columns: ['id'], rows: [[1]] }} truncated={false} />);
    expect(screen.queryByText(/Showing first 1,000 rows/)).toBeNull();
  });

  it('calls onPin when pin button is clicked and pinActive=true', () => {
    const onPin = vi.fn();
    render(
      <ResultsTable
        data={{ columns: ['id'], rows: [[1]] }}
        onPin={onPin}
        pinActive={true}
        activeTabPinned={false}
      />
    );
    fireEvent.click(screen.getByTitle('Pin result'));
    expect(onPin).toHaveBeenCalled();
  });

  it('calls onUnpin when unpin button is clicked for pinned tab', () => {
    const onUnpin = vi.fn();
    render(
      <ResultsTable
        data={{ columns: ['id'], rows: [[1]] }}
        onUnpin={onUnpin}
        pinActive={true}
        activeTabPinned={true}
        activeTabId="pin-1"
      />
    );
    fireEvent.click(screen.getByTitle('Unpin result'));
    expect(onUnpin).toHaveBeenCalledWith('pin-1');
  });

  it('calls onFilterToggle when Filter button clicked', () => {
    const onFilterToggle = vi.fn();
    render(
      <ResultsTable data={{ columns: ['id'], rows: [[1]] }} onFilterToggle={onFilterToggle} />
    );
    fireEvent.click(screen.getByTitle('Toggle filter'));
    expect(onFilterToggle).toHaveBeenCalled();
  });

  it('shows filter input when filterOpen=true', () => {
    render(
      <ResultsTable
        data={{ columns: ['id'], rows: [[1]] }}
        filterOpen={true}
        onFilterChange={vi.fn()}
        onFilterToggle={vi.fn()}
      />
    );
    expect(screen.getByPlaceholderText('Filter rows…')).toBeTruthy();
  });

  it('hides filter input when filterOpen=false', () => {
    render(<ResultsTable data={{ columns: ['id'], rows: [[1]] }} />);
    expect(screen.queryByPlaceholderText('Filter rows…')).toBeNull();
  });

  it('filters rows by filterText (case-insensitive)', () => {
    render(
      <ResultsTable
        data={{ columns: ['name'], rows: [['Alice'], ['Bob'], ['alice smith']] }}
        filterOpen={true}
        filterText="alice"
        onFilterChange={vi.fn()}
        onFilterToggle={vi.fn()}
      />
    );
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('alice smith')).toBeTruthy();
    expect(screen.queryByText('Bob')).toBeNull();
  });

  it('shows original row numbers when filtered', () => {
    render(
      <ResultsTable
        data={{ columns: ['name'], rows: [['Alice'], ['Bob'], ['Carol']] }}
        filterOpen={true}
        filterText="carol"
        onFilterChange={vi.fn()}
        onFilterToggle={vi.fn()}
      />
    );
    // Carol is at original index 3 — that number must appear, not 1
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.queryByText('1')).toBeNull();
  });

  it('shows match count when filter is active', () => {
    render(
      <ResultsTable
        data={{ columns: ['name'], rows: [['Alice'], ['Bob'], ['Alan']] }}
        filterOpen={true}
        filterText="al"
        onFilterChange={vi.fn()}
        onFilterToggle={vi.fn()}
      />
    );
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });

  it('calls onExport when export button is clicked', () => {
    const onExport = vi.fn();
    render(<ResultsTable data={{ columns: ['id'], rows: [[1]] }} onExport={onExport} />);
    fireEvent.click(screen.getByTitle('Export CSV'));
    expect(onExport).toHaveBeenCalled();
  });

  it('column drag registers mousemove/mouseup listeners', () => {
    render(<ResultsTable data={{ columns: ['id', 'name'], rows: [[1, 'Alice']] }} />);
    const addSpy = vi.spyOn(document, 'addEventListener');
    // Find the resize handle (w-[5px] div after column header content)
    const resizeHandles = document.querySelectorAll('.cursor-col-resize');
    fireEvent.mouseDown(resizeHandles[0], { clientX: 200 });
    const events = addSpy.mock.calls.map(([event]) => event);
    expect(events).toContain('mousemove');
    expect(events).toContain('mouseup');
    addSpy.mockRestore();
  });

  it('renders row numbers in first column', () => {
    render(<ResultsTable data={{ columns: ['a'], rows: [['x'], ['y'], ['z']] }} />);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('pin button not rendered when no onPin/onUnpin props', () => {
    render(<ResultsTable data={{ columns: ['id'], rows: [[1]] }} />);
    expect(screen.queryByTitle('Pin result')).toBeNull();
    expect(screen.queryByTitle('Unpin result')).toBeNull();
  });

  it('drag moves column width via mousemove and commits on mouseup', () => {
    render(<ResultsTable data={{ columns: ['id', 'name'], rows: [[1, 'Alice']] }} />);

    const moveListeners: EventListener[] = [];
    const upListeners: EventListener[] = [];

    const origAdd = document.addEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation((event, handler, ...args) => {
      if (event === 'mousemove') moveListeners.push(handler as EventListener);
      else if (event === 'mouseup') upListeners.push(handler as EventListener);
      else origAdd(event, handler as EventListener, ...(args as []));
    });
    vi.spyOn(document, 'removeEventListener').mockImplementation(() => {});

    const resizeHandles = document.querySelectorAll('.cursor-col-resize');
    fireEvent.mouseDown(resizeHandles[0], { clientX: 160 });

    // Simulate mousemove: drag right by 40px
    act(() => {
      for (const l of moveListeners) l(new MouseEvent('mousemove', { clientX: 200 }));
    });

    // Simulate mouseup: commit the new width
    act(() => {
      for (const l of upListeners) l(new MouseEvent('mouseup'));
    });

    vi.restoreAllMocks();

    // After drag, component should still render without crash
    expect(screen.getByText('id')).toBeTruthy();
  });
});
