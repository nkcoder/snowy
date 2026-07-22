import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { T } from '../lib/tokens';
import { cellCopyValue, ResultsTable, rowCopyJson } from './ResultsTable';

describe('cellCopyValue', () => {
  it('returns empty string for null', () => {
    expect(cellCopyValue(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(cellCopyValue(undefined)).toBe('');
  });

  it('stringifies numbers and booleans', () => {
    expect(cellCopyValue(42)).toBe('42');
    expect(cellCopyValue(0)).toBe('0');
    expect(cellCopyValue(true)).toBe('true');
    expect(cellCopyValue(false)).toBe('false');
  });

  it('passes strings through unchanged', () => {
    expect(cellCopyValue('Alice')).toBe('Alice');
    expect(cellCopyValue('')).toBe('');
  });
});

describe('rowCopyJson', () => {
  it('builds a JSON object keyed by column name', () => {
    const json = rowCopyJson(['id', 'name'], [1, 'Alice']);
    expect(JSON.parse(json)).toEqual({ id: 1, name: 'Alice' });
  });

  it('preserves real types: numbers, booleans, null', () => {
    const json = rowCopyJson(['n', 'active', 'note'], [42, false, null]);
    // Parsing back confirms the raw JSON keeps native types, not strings.
    expect(JSON.parse(json)).toEqual({ n: 42, active: false, note: null });
    expect(json).toContain('"n":42');
    expect(json).toContain('"active":false');
    expect(json).toContain('"note":null');
  });

  it('maps a missing (undefined) cell to null', () => {
    const json = rowCopyJson(['a', 'b'], [1]);
    expect(JSON.parse(json)).toEqual({ a: 1, b: null });
  });
});

describe('ResultsTable selection', () => {
  const data = {
    columns: ['id', 'name'],
    rows: [
      [10, 'Alice'],
      [20, 'Bob'],
    ],
  };

  it('clicking a cell strongly marks that cell and faintly tints its row', () => {
    render(<ResultsTable data={data} />);
    const aliceCell = screen.getByText('Alice').closest('td') as HTMLTableCellElement;
    fireEvent.click(aliceCell);

    // active cell: strong fill + outline
    expect(aliceCell.style.background).toBe(T.selected);
    expect(aliceCell.style.boxShadow).toContain(T.selectedBorder);

    // sibling cell in the same row: faint row tint, not the strong fill, no outline
    const idCell = screen.getByText('10').closest('td') as HTMLTableCellElement;
    expect(idCell.style.background).toBe(T.hover);
    expect(idCell.style.boxShadow).toBe('');

    // a different row is not highlighted at all
    const bobCell = screen.getByText('Bob').closest('td') as HTMLTableCellElement;
    expect(bobCell.style.background).toBe('');
  });

  // Fires a copy event on the grid container and returns what was written to the
  // clipboard's text/plain slot (null if the handler didn't intercept).
  function copyFrom(container: HTMLElement): string | null {
    const grid = container.querySelector('.overflow-auto') as HTMLElement;
    let written: string | null = null;
    const clipboardData = { setData: (_type: string, value: string) => (written = value) };
    fireEvent.copy(grid, { clipboardData });
    return written;
  }

  it('clicking a cell selects it; copy writes the raw value', () => {
    const { container } = render(<ResultsTable data={data} />);
    const aliceCell = screen.getByText('Alice').closest('td') as HTMLTableCellElement;
    fireEvent.click(aliceCell);
    expect(copyFrom(container)).toBe('Alice');
  });

  it('clicking a null cell copies an empty string', () => {
    const { container } = render(<ResultsTable data={{ columns: ['note'], rows: [[null]] }} />);
    const nullCell = screen.getByText('null').closest('td') as HTMLTableCellElement;
    fireEvent.click(nullCell);
    expect(copyFrom(container)).toBe('');
  });

  it('double/triple-clicking a cell just re-selects that cell, not the row', () => {
    const { container } = render(<ResultsTable data={data} />);
    const aliceCell = screen.getByText('Alice').closest('td') as HTMLTableCellElement;
    fireEvent.click(aliceCell, { detail: 3 });
    // still a cell selection: copies the cell value, not row JSON
    expect(copyFrom(container)).toBe('Alice');
  });

  it('clicking the # gutter cell selects the whole row', () => {
    const { container } = render(<ResultsTable data={data} />);
    // Row 1's gutter shows "1"; no data cell in this fixture is "1".
    const gutter = screen.getByText('1').closest('td') as HTMLTableCellElement;
    fireEvent.click(gutter);

    // whole row filled: every data cell (not just one) plus the gutter itself
    const aliceCell = screen.getByText('Alice').closest('td') as HTMLTableCellElement;
    const idCell = screen.getByText('10').closest('td') as HTMLTableCellElement;
    expect(aliceCell.style.background).toBe(T.selected);
    expect(idCell.style.background).toBe(T.selected);
    expect(gutter.style.background).toBe(T.selected);
    // no single active-cell outline for a row selection
    expect(aliceCell.style.boxShadow).toBe('');

    // copy yields the row as JSON
    expect(JSON.parse(copyFrom(container) as string)).toEqual({ id: 10, name: 'Alice' });
  });

  it('freezes the # gutter column (sticky) for horizontal scroll', () => {
    render(<ResultsTable data={data} />);
    const gutter = screen.getByText('1').closest('td') as HTMLTableCellElement;
    expect(gutter.style.position).toBe('sticky');
    expect(gutter.style.left).toBe('0px');
    // header corner too
    const corner = screen.getByText('#').closest('th') as HTMLTableCellElement;
    expect(corner.style.position).toBe('sticky');
    expect(corner.style.left).toBe('0px');
  });

  it('keeps the # gutter fixed at 40px and adds an auto-width spacer column', () => {
    render(<ResultsTable data={data} />);
    // The # header keeps its fixed width; a trailing spacer <th> with no width
    // absorbs leftover space so the gutter and data columns never inflate (#156).
    const corner = screen.getByText('#').closest('th') as HTMLTableCellElement;
    expect(corner.style.width).toBe('40px');

    const headerCells = corner.closest('tr')?.querySelectorAll('th') ?? [];
    // # + 2 data columns + 1 spacer = 4 header cells
    expect(headerCells.length).toBe(data.columns.length + 2);
    const spacer = headerCells[headerCells.length - 1] as HTMLTableCellElement;
    expect(spacer.style.width).toBe('');
  });

  it('spacer cell carries the row highlight so selection fills the panel', () => {
    render(<ResultsTable data={data} />);
    const gutter = screen.getByText('1').closest('td') as HTMLTableCellElement;
    fireEvent.click(gutter);

    const cells = gutter.closest('tr')?.querySelectorAll('td') ?? [];
    const spacer = cells[cells.length - 1] as HTMLTableCellElement;
    expect(spacer.style.background).toBe(T.selected);
  });

  it('clears selection when a new result set loads', () => {
    const { rerender } = render(<ResultsTable data={data} />);
    const aliceCell = screen.getByText('Alice').closest('td') as HTMLTableCellElement;
    fireEvent.click(aliceCell);
    expect(aliceCell.style.background).toBe(T.selected);

    rerender(
      <ResultsTable
        data={{
          columns: ['id', 'name'],
          rows: [
            [10, 'Alice'],
            [20, 'Bob'],
          ],
        }}
      />
    );
    const aliceCellAfter = screen.getByText('Alice').closest('td') as HTMLTableCellElement;
    expect(aliceCellAfter.style.background).toBe('');
  });
});

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

  it('renders "No rows." for an empty SELECT result', () => {
    render(<ResultsTable data={{ columns: ['id'], rows: [] }} />);
    expect(screen.getByText('No rows.')).toBeTruthy();
  });

  it('reports affected rows for DML statements', () => {
    render(<ResultsTable data={{ columns: [], rows: [], command: 'UPDATE', rowsAffected: 3 }} />);
    expect(screen.getByText('Success. 3 rows affected.')).toBeTruthy();
  });

  it('reports "Statement executed." for DDL statements', () => {
    render(<ResultsTable data={{ columns: [], rows: [], command: 'DROP', rowsAffected: 0 }} />);
    expect(screen.getByText('Statement executed.')).toBeTruthy();
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

  it('shows the accent separator line only while hovering the resize handle', () => {
    render(<ResultsTable data={{ columns: ['id', 'name'], rows: [[1, 'Alice']] }} />);
    const handle = document.querySelectorAll('.cursor-col-resize')[0] as HTMLElement;
    const line = handle.firstElementChild as HTMLElement;
    // Idle: transparent line
    expect(line.style.background).toBe('transparent');
    // Hover: accent line
    fireEvent.mouseEnter(handle);
    expect(line.style.background).toBe(T.accent);
    // Leave: transparent again
    fireEvent.mouseLeave(handle);
    expect(line.style.background).toBe('transparent');
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
