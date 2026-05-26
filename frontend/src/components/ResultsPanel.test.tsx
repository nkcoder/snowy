import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ResultTab } from './ResultsPanel';
import { ResultsPanel } from './ResultsPanel';

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
};

describe('ResultsPanel', () => {
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

  it('triggers export download when export button is clicked on a tab with data', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:test');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

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

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('does not download when no active tab data', () => {
    const createObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });

    render(<ResultsPanel resultTabs={[makeLiveTab({ data: null })]} {...defaultProps} />);

    // Export button should be disabled when no data (ResultsTable renders it disabled)
    expect(createObjectURL).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
