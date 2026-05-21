import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTabManager } from './useTabManager';

describe('useTabManager', () => {
  it('starts with empty tabs and null activeTabId', () => {
    const { result } = renderHook(() => useTabManager());
    expect(result.current.tabs).toEqual([]);
    expect(result.current.activeTabId).toBeNull();
    expect(result.current.activeTab).toBeNull();
  });

  it('makeTab creates a tab with sequential ids', () => {
    const { result } = renderHook(() => useTabManager());
    const t1 = result.current.makeTab('foo');
    const t2 = result.current.makeTab('bar');
    expect(t1.id).not.toBe(t2.id);
    expect(t1.label).toBe('foo');
    expect(t1.dirty).toBe(false);
    expect(t1.filename).toBeNull();
  });

  it('makeTab defaults to untitled with empty sql', () => {
    const { result } = renderHook(() => useTabManager());
    const t = result.current.makeTab();
    expect(t.label).toBe('untitled');
    expect(t.sql).toBe('');
  });

  it('makeTab accepts filename', () => {
    const { result } = renderHook(() => useTabManager());
    const t = result.current.makeTab('query.sql', 'SELECT 1', 'query.sql');
    expect(t.filename).toBe('query.sql');
    expect(t.sql).toBe('SELECT 1');
  });

  it('openTab appends tab and sets it active', () => {
    const { result } = renderHook(() => useTabManager());
    const tab = result.current.makeTab('t1');
    act(() => result.current.openTab(tab));
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTabId).toBe(tab.id);
    expect(result.current.activeTab?.label).toBe('t1');
  });

  it('updateActiveTab patches the active tab only', () => {
    const { result } = renderHook(() => useTabManager());
    const t1 = result.current.makeTab('t1');
    const t2 = result.current.makeTab('t2');
    act(() => {
      result.current.openTab(t1);
      result.current.openTab(t2);
    });
    act(() => result.current.updateActiveTab({ dirty: true, sql: 'SELECT 2' }));
    const tabs = result.current.tabs;
    expect(tabs.find((t) => t.id === t2.id)?.dirty).toBe(true);
    expect(tabs.find((t) => t.id === t1.id)?.dirty).toBe(false);
  });

  it('doCloseTab removes the tab and selects adjacent', () => {
    const { result } = renderHook(() => useTabManager());
    const t1 = result.current.makeTab('t1');
    const t2 = result.current.makeTab('t2');
    act(() => {
      result.current.openTab(t1);
      result.current.openTab(t2);
    });
    act(() => result.current.doCloseTab(t2.id));
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTabId).toBe(t1.id);
  });

  it('doCloseTab on last tab sets activeTabId to null', () => {
    const { result } = renderHook(() => useTabManager());
    const tab = result.current.makeTab();
    act(() => result.current.openTab(tab));
    act(() => result.current.doCloseTab(tab.id));
    expect(result.current.tabs).toHaveLength(0);
    expect(result.current.activeTabId).toBeNull();
  });

  it('doCloseTab on non-active tab does not change active', () => {
    const { result } = renderHook(() => useTabManager());
    const t1 = result.current.makeTab('t1');
    const t2 = result.current.makeTab('t2');
    act(() => {
      result.current.openTab(t1);
      result.current.openTab(t2);
      result.current.handleTabSelect(t1.id);
    });
    act(() => result.current.doCloseTab(t2.id));
    expect(result.current.activeTabId).toBe(t1.id);
    expect(result.current.tabs).toHaveLength(1);
  });

  it('handleNewTab opens a new untitled tab', () => {
    const { result } = renderHook(() => useTabManager());
    act(() => result.current.handleNewTab());
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].label).toBe('untitled');
  });

  it('handleTabSelect changes activeTabId', () => {
    const { result } = renderHook(() => useTabManager());
    const t1 = result.current.makeTab();
    const t2 = result.current.makeTab();
    act(() => {
      result.current.openTab(t1);
      result.current.openTab(t2);
    });
    act(() => result.current.handleTabSelect(t1.id));
    expect(result.current.activeTabId).toBe(t1.id);
  });
});
