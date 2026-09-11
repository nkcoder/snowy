import { useRef, useState } from 'react';
import type { Tab } from '../components/TabBar';

type TabPatch = Omit<Partial<Tab>, 'id' | 'externalApplyId'>;

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
    externalApplyId: 0,
  });

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  const openTab = (tab: Tab) => {
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  };

  const updateTab = (id: string, patch: TabPatch) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return { ...t, ...patch, id: t.id, externalApplyId: t.externalApplyId };
      })
    );
  };

  const updateActiveTab = (patch: TabPatch) => {
    if (activeTabId) updateTab(activeTabId, patch);
  };

  const replaceActiveTabSql = (sql: string) => {
    if (!activeTabId) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, sql, dirty: true, externalApplyId: t.externalApplyId + 1 }
          : t
      )
    );
  };

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
    replaceActiveTabSql,
    doCloseTab,
    handleTabSelect: setActiveTabId,
    handleNewTab,
  };
}
