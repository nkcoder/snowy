import { useRef, useState } from 'react';
import type { Tab } from '../components/TabBar';

export function useTabManager() {
  const seqRef = useRef(0);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const makeTab = (label = 'untitled', sql = '', filename: string | null = null): Tab => ({
    id: `tab-${++seqRef.current}`,
    label,
    filename,
    sql,
    dirty: false,
  });

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  const openTab = (tab: Tab) => {
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  };

  const updateTab = (id: string, patch: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const updateActiveTab = (patch: Partial<Tab>) => {
    if (activeTabId) updateTab(activeTabId, patch);
  };

  // Close a tab. If it was the active one, fall back to the neighbour on its
  // left (clamped) so focus lands somewhere sensible rather than jumping to the
  // end; closing the last tab clears the active id.
  const doCloseTab = (id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeTabId === id) {
        if (next.length > 0) {
          const idx = Math.max(0, prev.findIndex((t) => t.id === id) - 1);
          setActiveTabId(next[Math.min(idx, next.length - 1)].id);
        } else {
          setActiveTabId(null);
        }
      }
      return next;
    });
  };

  const handleNewTab = () => openTab(makeTab());

  return {
    tabs,
    setTabs,
    activeTabId,
    activeTab,
    makeTab,
    openTab,
    updateTab,
    updateActiveTab,
    doCloseTab,
    handleTabSelect: setActiveTabId,
    handleNewTab,
  };
}
