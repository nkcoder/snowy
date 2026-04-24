import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabBar, type Tab } from './TabBar';

function makeTab(overrides: Partial<Tab> = {}): Tab {
  return { id: 'tab-1', label: 'untitled', filename: null, sql: '', dirty: false, ...overrides };
}

describe('TabBar', () => {
  const defaultProps = {
    tabs: [makeTab()],
    activeTabId: 'tab-1',
    onSelect: vi.fn(),
    onClose: vi.fn(),
    onNew: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it('renders tab bar', () => {
    render(<TabBar {...defaultProps} />);
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument();
  });

  it('renders tab with label', () => {
    render(<TabBar {...defaultProps} tabs={[makeTab({ label: 'my_query.sql' })]} />);
    expect(screen.getByText('my_query.sql')).toBeInTheDocument();
  });

  it('renders multiple tabs', () => {
    const tabs = [
      makeTab({ id: 'tab-1', label: 'first.sql' }),
      makeTab({ id: 'tab-2', label: 'second.sql' }),
    ];
    render(<TabBar {...defaultProps} tabs={tabs} />);
    expect(screen.getByText('first.sql')).toBeInTheDocument();
    expect(screen.getByText('second.sql')).toBeInTheDocument();
  });

  it('calls onSelect when tab clicked', () => {
    render(<TabBar {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tab-tab-1'));
    expect(defaultProps.onSelect).toHaveBeenCalledWith('tab-1');
  });

  it('calls onClose when × clicked', () => {
    render(<TabBar {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tab-close-tab-1'));
    expect(defaultProps.onClose).toHaveBeenCalledWith('tab-1');
  });

  it('calls onNew when + clicked', () => {
    render(<TabBar {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tab-new'));
    expect(defaultProps.onNew).toHaveBeenCalledOnce();
  });

  it('shows dirty indicator when tab is dirty', () => {
    render(<TabBar {...defaultProps} tabs={[makeTab({ dirty: true })]} />);
    expect(screen.getByTestId('tab-dirty-tab-1')).toBeInTheDocument();
  });

  it('does not show dirty indicator when tab is clean', () => {
    render(<TabBar {...defaultProps} tabs={[makeTab({ dirty: false })]} />);
    expect(screen.queryByTestId('tab-dirty-tab-1')).not.toBeInTheDocument();
  });

  it('active tab has distinct data-testid', () => {
    render(<TabBar {...defaultProps} activeTabId="tab-1" />);
    expect(screen.getByTestId('tab-tab-1')).toBeInTheDocument();
  });
});
