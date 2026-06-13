import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as GoApp from '../../wailsjs/go/main/App';
import type { ResultTab } from './ResultsPanel';
import { ResultsPanel } from './ResultsPanel';

vi.mock('../../wailsjs/go/main/App', () => ({
  ExportCSV: vi.fn().mockResolvedValue(undefined),
}));

function makeLiveTab(overrides: Partial<ResultTab> = {}): ResultTab {
  return {
    id: 'live',
    label: 'Result 1',
    data: null,
    error: null,
    rowCount: 0,
    durationMs: 0,
    truncated: false,
    timestamp: new Date(),
    pinned: false,
    sql: '',
    ...overrides,
  };
}

function makePinnedTab(overrides: Partial<ResultTab> = {}): ResultTab {
  return {
    ...makeLiveTab(),
    id: 'pin-1',
    label: 'Result 1',
    pinned: true,
    data: { columns: ['id'], rows: [[1]] },
    ...overrides,
  };
}

const defaultProps = {
  activeResultTabId: 'live' as string,
  loading: false,
  onSelectTab: vi.fn(),
  onPin: vi.fn(),
  onUnpin: vi.fn(),
  onCloseTab: vi.fn(),
  onOpenHistory: vi.fn(),
  onTogglePanel: vi.fn(),
  bottomVisible: true,
  collapsed: false,
};

describe('ResultsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tab strip with live tab label', () => {
    render(<ResultsPanel resultTabs={[makeLiveTab()]} {...defaultProps} />);
    expect(screen.getByText('Result 1')).toBeTruthy();
  });

  it('renders multiple tabs', () => {
    const tabs = [
      makeLiveTab({ id: 'live', label: 'Result 2', pinned: false }),
      makePinnedTab({ id: 'pin-1', label: 'Result 1' }),
    ];
    render(<ResultsPanel resultTabs={tabs} {...defaultProps} activeResultTabId="pin-1" />);
    expect(screen.getAllByText('Result 1').length).toBeGreaterThan(0);
    expect(screen.getByText('Result 2')).toBeTruthy();
  });

  it('calls onSelectTab when a tab is clicked', () => {
    const onSelectTab = vi.fn();
    const tabs = [
      makeLiveTab({ id: 'live', label: 'Live' }),
      makePinnedTab({ id: 'pin-1', label: 'Pinned' }),
    ];
    render(<ResultsPanel resultTabs={tabs} {...defaultProps} onSelectTab={onSelectTab} />);
    fireEvent.click(screen.getByText('Pinned'));
    expect(onSelectTab).toHaveBeenCalledWith('pin-1');
  });

  it('calls onOpenHistory when history button is clicked', () => {
    const onOpenHistory = vi.fn();
    render(
      <ResultsPanel resultTabs={[makeLiveTab()]} {...defaultProps} onOpenHistory={onOpenHistory} />
    );
    fireEvent.click(screen.getByTitle('Query history'));
    expect(onOpenHistory).toHaveBeenCalled();
  });

  it('calls onTogglePanel when results toggle is clicked', () => {
    const onTogglePanel = vi.fn();
    render(
      <ResultsPanel resultTabs={[makeLiveTab()]} {...defaultProps} onTogglePanel={onTogglePanel} />
    );
    fireEvent.click(screen.getByTitle('Hide results panel'));
    expect(onTogglePanel).toHaveBeenCalled();
  });

  it('results toggle shows "Show results panel" title when bottomVisible is false', () => {
    render(<ResultsPanel resultTabs={[makeLiveTab()]} {...defaultProps} bottomVisible={false} />);
    expect(screen.getByTitle('Show results panel')).toBeTruthy();
  });

  it('hides content area when collapsed', () => {
    const tab = makeLiveTab({ error: 'should not appear' });
    render(<ResultsPanel resultTabs={[tab]} {...defaultProps} collapsed={true} />);
    expect(screen.queryByText('should not appear')).toBeNull();
  });

  it('shows content area when not collapsed', () => {
    const tab = makeLiveTab({ error: 'visible error' });
    render(<ResultsPanel resultTabs={[tab]} {...defaultProps} collapsed={false} />);
    expect(screen.getByText('visible error')).toBeTruthy();
  });

  it('shows error text in content area for error tab', () => {
    const tab = makeLiveTab({ error: 'syntax error near SELECT' });
    render(<ResultsPanel resultTabs={[tab]} {...defaultProps} />);
    expect(screen.getByText('syntax error near SELECT')).toBeTruthy();
  });

  it('shows error badge in tab strip for error tab', () => {
    const tab = makeLiveTab({ error: 'something went wrong' });
    render(<ResultsPanel resultTabs={[tab]} {...defaultProps} />);
    expect(screen.getByText('error')).toBeTruthy();
  });

  it('shows close button for pinned tab', () => {
    const tabs = [makeLiveTab({ id: 'live' }), makePinnedTab({ id: 'pin-1' })];
    render(<ResultsPanel resultTabs={tabs} {...defaultProps} activeResultTabId="pin-1" />);
    // Pinned tab has a nested close button with leading-none class
    const closeBtn = document.querySelector('button.leading-none');
    expect(closeBtn).toBeTruthy();
  });

  it('calls onCloseTab when pinned tab X button is clicked', () => {
    const onCloseTab = vi.fn();
    const tabs = [makeLiveTab({ id: 'live' }), makePinnedTab({ id: 'pin-1' })];
    render(
      <ResultsPanel
        resultTabs={tabs}
        {...defaultProps}
        activeResultTabId="pin-1"
        onCloseTab={onCloseTab}
      />
    );
    const closeBtn = document.querySelector('button.leading-none') as HTMLButtonElement;
    fireEvent.click(closeBtn);
    expect(onCloseTab).toHaveBeenCalledWith('pin-1');
  });

  it('renders ResultsTable for non-error active tab', () => {
    render(<ResultsPanel resultTabs={[makeLiveTab()]} {...defaultProps} />);
    expect(screen.getByText('Execute a query to view results')).toBeTruthy();
  });

  it('shows fetching overlay when loading', () => {
    render(<ResultsPanel resultTabs={[makeLiveTab()]} {...defaultProps} loading={true} />);
    expect(screen.getByTestId('fetching-overlay')).toBeTruthy();
    expect(screen.getByText('Fetching data...')).toBeTruthy();
  });

  it('shows fetching overlay on top of previous results when loading', () => {
    const tabWithData = makeLiveTab({ data: { columns: ['id'], rows: [[42]] } });
    render(<ResultsPanel resultTabs={[tabWithData]} {...defaultProps} loading={true} />);
    expect(screen.getByText('Fetching data...')).toBeTruthy();
    // Previous result row still in DOM — overlay does not clear results
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('does not show fetching overlay when not loading', () => {
    render(<ResultsPanel resultTabs={[makeLiveTab()]} {...defaultProps} loading={false} />);
    expect(screen.queryByText('Fetching data...')).toBeNull();
  });

  it('calls ExportCSV with correct CSV content and filename when export button clicked', () => {
    const liveTab = makeLiveTab({
      data: {
        columns: ['id', 'name'],
        rows: [
          [1, 'Alice'],
          [2, null],
        ],
      },
      label: 'Result 1',
    });

    render(<ResultsPanel resultTabs={[liveTab]} {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Export CSV'));

    expect(vi.mocked(GoApp.ExportCSV)).toHaveBeenCalledWith('id,name\n1,Alice\n2,', 'Result 1.csv');
  });

  it('does not call ExportCSV when no active tab data', () => {
    render(<ResultsPanel resultTabs={[makeLiveTab({ data: null })]} {...defaultProps} />);
    // Export button is disabled when no data — ExportCSV must not be called
    expect(vi.mocked(GoApp.ExportCSV)).not.toHaveBeenCalled();
  });

  it('shows filter input when Filter button is clicked', () => {
    const tab = makeLiveTab({ data: { columns: ['name'], rows: [['Alice']] } });
    render(<ResultsPanel resultTabs={[tab]} {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Toggle filter'));
    expect(screen.getByPlaceholderText('Filter rows…')).toBeTruthy();
  });

  it('filter state is independent per tab', () => {
    const tab1 = makeLiveTab({
      id: 'live',
      label: 'T1',
      data: { columns: ['name'], rows: [['Alice'], ['Bob']] },
    });
    const tab2 = makePinnedTab({
      id: 'pin-1',
      label: 'T2',
      data: { columns: ['name'], rows: [['Carol']] },
    });
    const { rerender } = render(
      <ResultsPanel resultTabs={[tab1, tab2]} {...defaultProps} activeResultTabId="live" />
    );
    // Open filter on tab1 and type
    fireEvent.click(screen.getByTitle('Toggle filter'));
    fireEvent.change(screen.getByPlaceholderText('Filter rows…'), { target: { value: 'alice' } });
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.queryByText('Bob')).toBeNull();

    // Switch to tab2 — filter bar should be closed, Bob visible, Alice visible (Carol tab)
    rerender(
      <ResultsPanel resultTabs={[tab1, tab2]} {...defaultProps} activeResultTabId="pin-1" />
    );
    expect(screen.queryByPlaceholderText('Filter rows…')).toBeNull();
    expect(screen.getByText('Carol')).toBeTruthy();

    // Switch back to tab1 — filter still active
    rerender(<ResultsPanel resultTabs={[tab1, tab2]} {...defaultProps} activeResultTabId="live" />);
    expect(screen.getByPlaceholderText('Filter rows…')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.queryByText('Bob')).toBeNull();
  });

  it('filter resets when new query result loads on active tab', () => {
    const tab = makeLiveTab({ data: { columns: ['name'], rows: [['Alice'], ['Bob']] } });
    const { rerender } = render(<ResultsPanel resultTabs={[tab]} {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Toggle filter'));
    fireEvent.change(screen.getByPlaceholderText('Filter rows…'), { target: { value: 'alice' } });
    expect(screen.queryByText('Bob')).toBeNull();

    // Simulate new query: same tab id, new data + new timestamp
    const updatedTab = {
      ...tab,
      data: { columns: ['name'], rows: [['Alice'], ['Bob']] },
      timestamp: new Date(Date.now() + 1000),
    };
    rerender(<ResultsPanel resultTabs={[updatedTab]} {...defaultProps} />);
    expect(screen.queryByPlaceholderText('Filter rows…')).toBeNull();
    expect(screen.getByText('Bob')).toBeTruthy();
  });
});
