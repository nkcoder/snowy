import { useState, useEffect, Component, type ReactNode, type ErrorInfo } from 'react';
import * as GoApp from '../wailsjs/go/main/App';
import { T } from './lib/tokens';

// ── Error boundary ─────────────────────────────────────────────────────────────
class WorkspaceErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[WorkspaceErrorBoundary]', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: 'var(--t-err)', fontFamily: 'monospace', fontSize: 13, background: 'var(--t-bg)', height: '100vh', overflow: 'auto' }}>
          <strong>Workspace render error</strong>
          <pre style={{ marginTop: 12, whiteSpace: 'pre-wrap', color: 'var(--t-text)' }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 16, padding: '6px 14px', background: 'var(--t-accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { Sidebar } from './components/Sidebar';
import { QueryEditor } from './components/QueryEditor';
import { ConnectionManager } from './components/ConnectionManager';
import { TabBar, type Tab } from './components/TabBar';
import { ResultsPanel, type ResultTab } from './components/ResultsPanel';
import { HistoryDrawer, type HistoryEntry } from './components/HistoryDrawer';
import { InputDialog, ConfirmDialog } from './components/Dialog';
import { Terminal, Folder, ChevronRight } from 'lucide-react';
import './App.css';

// ── Tab helpers ────────────────────────────────────────────────────────────────
let _tabSeq = 0;
function makeTab(label = 'untitled', sql = '', filename: string | null = null): Tab {
  return { id: `tab-${++_tabSeq}`, label, filename, sql, dirty: false };
}

let _resultSeq = 0;

function makeLiveResultTab(): ResultTab {
  return {
    id: 'live',
    label: 'Result 1',
    data: null,
    error: null,
    rowCount: 0,
    durationMs: 0,
    timestamp: new Date(),
    pinned: false,
    sql: '',
  };
}

type Project = {
  id: string;
  name: string;
};

type Datasource = {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  projectId: string;
  env: string;
  sslMode: string;
};

type AppView = 'connections' | 'workspace';

// Aliases for brevity in JSX below
const { chrome, border, borderStrong, accent, textSec, textDim, bg, sidebar, ok, ui, mono } = {
  chrome:       T.chrome,
  border:       T.border,
  borderStrong: T.borderStrong,
  accent:       T.accent,
  textSec:      T.textSec,
  textDim:      T.textDim,
  bg:           T.bg,
  sidebar:      T.sidebar,
  ok:           T.ok,
  ui:           T.ui,
  mono:         T.mono,
};


function ElephantGlyph({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3.5 7.5c0-2.5 2-4.2 4.6-4.2 2.7 0 4.6 1.7 4.6 4 0 1.8-1 3-1 3.8l.6 1.6h-1.7l-.5-1.2c-.4.3-1 .4-1.6.4l.3 1.2H7.2l-.5-1.4c-1.1-.2-1.9-.6-2.4-1.1-.3.4-.7.6-1.1.6"
        stroke={color} strokeWidth="1.2" fill={color + '22'} />
      <circle cx="10.4" cy="6.2" r=".6" fill={color} />
    </svg>
  );
}

function App() {
  const [view, setView] = useState<AppView>('connections');
  const [projects, setProjects] = useState<Project[]>([]);
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [activeDatasourceId, setActiveDatasourceId] = useState<string | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [savedQueries, setSavedQueries] = useState<{ filename: string }[]>([]);
  const [completions, setCompletions] = useState<any[]>([]);

  // ── Result tabs ──────────────────────────────────────────────────────────────
  const [resultTabs, setResultTabs] = useState<ResultTab[]>([makeLiveResultTab()]);
  const [activeResultTabId, setActiveResultTabId] = useState<string>('live');

  // ── History drawer ───────────────────────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Dialogs ──────────────────────────────────────────────────────────────────
  type DialogState =
    | { type: 'save-query' }
    | { type: 'confirm-close'; tabId: string; tabLabel: string };
  const [dialog, setDialog] = useState<DialogState | null>(null);

  useEffect(() => { loadConfig(); }, []);

  useEffect(() => {
    const suppress = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', suppress);
    return () => document.removeEventListener('contextmenu', suppress);
  }, []);

  const loadConfig = async () => {
    try {
      const config = await GoApp.GetConfig();
      const ds = (config.datasources ?? []).map((d: any) => ({
        env: 'local', sslMode: 'disable', ...d,
      }));
      setProjects(config.projects ?? []);
      setDatasources(ds);
    } catch (err) {
      console.error('Failed to load config', err);
    }
  };

  const handleSaveAll = async (updatedProjects: Project[], updatedDatasources: Datasource[]) => {
    await GoApp.SaveConfig({ projects: updatedProjects, datasources: updatedDatasources } as any);
    setProjects(updatedProjects);
    setDatasources(updatedDatasources);
  };

  const handleUpdateDs = async (ds: Datasource) => {
    await (GoApp as any).UpdateDatasource(ds);
    setDatasources(prev => prev.map(d => d.id === ds.id ? ds : d));
  };

  // ── Editor tab helpers ───────────────────────────────────────────────────────
  const activeTab = tabs.find(t => t.id === activeTabId) ?? null;

  const openTab = (tab: Tab) => {
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
  };

  const updateActiveTab = (patch: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...patch } : t));
  };

  const handleTabSelect = (id: string) => setActiveTabId(id);

  const doCloseTab = (id: string) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      if (activeTabId === id && next.length > 0) {
        const idx = Math.max(0, prev.findIndex(t => t.id === id) - 1);
        setActiveTabId(next[Math.min(idx, next.length - 1)].id);
      } else if (next.length === 0) {
        setActiveTabId(null);
      }
      return next;
    });
  };

  const handleTabClose = (id: string) => {
    const tab = tabs.find(t => t.id === id);
    if (tab?.dirty) {
      setDialog({ type: 'confirm-close', tabId: id, tabLabel: tab.label });
      return;
    }
    doCloseTab(id);
  };

  const handleNewTab = () => {
    const tab = makeTab();
    openTab(tab);
  };

  const handleDisconnect = () => {
    setActiveDatasourceId(null);
    setView('connections');
  };

  // ── Connect / workspace ──────────────────────────────────────────────────────
  const handleConnect = (dsId: string) => {
    setActiveDatasourceId(dsId);
    setSavedQueries([]);
    setCompletions([]);
    _resultSeq = 0;
    const liveTab = makeLiveResultTab();
    setResultTabs([liveTab]);
    setActiveResultTabId('live');
    const initial = makeTab();
    setTabs([initial]);
    setActiveTabId(initial.id);
    setView('workspace');
    GoApp.ListSavedQueries(dsId).then(data => setSavedQueries(data ?? [])).catch(() => {});
    GoApp.GetCompletions(dsId)
      .then(data => setCompletions(data?.entries ?? []))
      .catch(err => console.warn('GetCompletions failed', err));
  };

  // ── Result tab actions ───────────────────────────────────────────────────────
  const handlePinResult = () => {
    const liveTab = resultTabs.find(t => !t.pinned);
    if (!liveTab?.data) return;
    // Replace the live tab with a pinned snapshot (new ID so it stays fixed),
    // then append a fresh live tab for the next query result.
    const pinnedId = `result-pin-${Date.now()}`;
    const pinned: ResultTab = { ...liveTab, id: pinnedId, pinned: true };
    const newLive = makeLiveResultTab();
    setResultTabs(prev => [...prev.map(t => t.id === liveTab.id ? pinned : t), newLive]);
    setActiveResultTabId(pinnedId);
  };

  const handleCloseResultTab = (id: string) => {
    setResultTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      if (activeResultTabId === id) {
        setActiveResultTabId(next[next.length - 1]?.id ?? 'live');
      }
      return next;
    });
  };

  const handleUnpinResult = (id: string) => {
    const pinned = resultTabs.find(t => t.id === id);
    if (!pinned) return;
    // Promote the pinned snapshot back to the live slot and remove the pinned tab
    setResultTabs(prev =>
      prev
        .filter(t => t.id !== id)
        .map(t => t.pinned ? t : { ...pinned, id: 'live', pinned: false })
    );
    setActiveResultTabId('live');
  };

  // ── History ──────────────────────────────────────────────────────────────────
  const handleOpenHistory = async () => {
    if (!activeDatasourceId) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const entries = await (GoApp as any).GetQueryHistory(activeDatasourceId, 100);
      setHistoryEntries(entries ?? []);
    } catch (err) {
      console.warn('GetQueryHistory failed', err);
      setHistoryEntries([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleHistorySelect = (sql: string) => {
    setHistoryOpen(false);
    if (activeTab) {
      updateActiveTab({ sql, dirty: true });
    } else {
      const tab = makeTab('from history', sql);
      openTab(tab);
    }
  };

  // ── Sidebar query actions ────────────────────────────────────────────────────
  const handleLoadQuery = async (filename: string) => {
    if (!activeDatasourceId) return;
    const existing = tabs.find(t => t.filename === filename);
    if (existing) { setActiveTabId(existing.id); return; }
    try {
      const sql = await GoApp.LoadSavedQuery(activeDatasourceId, filename);
      openTab(makeTab(filename, sql, filename));
    } catch (err) {
      console.error('Failed to load query', err);
    }
  };

  const handleDeleteQuery = async (filename: string) => {
    if (!activeDatasourceId) return;
    try {
      await GoApp.DeleteSavedQuery(activeDatasourceId, filename);
      setSavedQueries(prev => prev.filter(q => q.filename !== filename));
      const tab = tabs.find(t => t.filename === filename);
      if (tab) handleTabClose(tab.id);
    } catch (err) {
      console.error('Failed to delete query', err);
    }
  };

  const handleRenameQuery = async (oldFilename: string, newFilename: string) => {
    if (!activeDatasourceId) return;
    try {
      await GoApp.RenameQuery(activeDatasourceId, oldFilename, newFilename);
      setSavedQueries(prev => prev.map(q => q.filename === oldFilename ? { filename: newFilename } : q));
      setTabs(prev => prev.map(t =>
        t.filename === oldFilename ? { ...t, filename: newFilename, label: newFilename } : t
      ));
    } catch (err) {
      console.error('Failed to rename query', err);
    }
  };

  const doSaveQuery = async (filename: string) => {
    if (!activeDatasourceId || !activeTab) return;
    try {
      await GoApp.SaveQuery(activeDatasourceId, filename, activeTab.sql);
      const updated = await GoApp.ListSavedQueries(activeDatasourceId);
      setSavedQueries(updated ?? []);
      const savedFilename = filename.endsWith('.sql') ? filename : `${filename}.sql`;
      updateActiveTab({ filename: savedFilename, label: savedFilename, dirty: false });
    } catch (err) {
      console.error('Failed to save query', err);
    }
  };

  const handleSaveQuery = () => {
    if (!activeDatasourceId || !activeTab) return;
    if (!activeTab.filename) {
      setDialog({ type: 'save-query' });
      return;
    }
    doSaveQuery(activeTab.filename);
  };

  const handleRunQuery = async (sql: string) => {
    if (!activeDatasourceId) return;
    setQueryLoading(true);
    try {
      const result = await GoApp.ExecuteQuery(activeDatasourceId, sql);
      const rowCount = result.rowCount ?? result.rows?.length ?? 0;
      const durationMs = result.durationMs ?? 0;
      _resultSeq++;
      const label = `Result ${_resultSeq}`;

      // Update live tab — clear any previous error
      setResultTabs(prev => prev.map(t =>
        !t.pinned
          ? { ...t, label, data: result, error: null, rowCount, durationMs, sql, timestamp: new Date() }
          : t
      ));
      setActiveResultTabId('live');

      // Record history (non-blocking)
      (GoApp as any).RecordHistory(activeDatasourceId, sql, rowCount, durationMs)
        .catch((err: any) => console.warn('RecordHistory failed', err));

    } catch (err: any) {
      const message = typeof err === 'string' ? err : (err?.message ?? String(err));
      _resultSeq++;
      setResultTabs(prev => prev.map(t =>
        !t.pinned
          ? { ...t, label: `Result ${_resultSeq}`, data: null, error: message, rowCount: 0, durationMs: 0, sql, timestamp: new Date() }
          : t
      ));
      setActiveResultTabId('live');
    } finally {
      setQueryLoading(false);
    }
  };

  const handleEditorChange = (sql: string) => {
    updateActiveTab({ sql, dirty: true });
  };

  const activeDatasource = datasources.find(d => d.id === activeDatasourceId);

  // ── Workspace view ──────────────────────────────────────────────────────
  if (view === 'workspace') {
    const liveTab = resultTabs.find(t => !t.pinned);
    const rowCount = liveTab?.rowCount ?? 0;
    const durationMs = liveTab?.durationMs ?? 0;

    return (
      <WorkspaceErrorBoundary>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: bg, color: T.text, fontFamily: ui, overflow: 'hidden' }}>
        {/* ── macOS title bar with drag region ─────────────────────────────── */}
        <div
          style={{
            height: 38,
            background: chrome,
            borderBottom: `0.5px solid ${border}`,
            display: 'flex', alignItems: 'center',
            paddingLeft: 14, paddingRight: 12, gap: 14,
            flexShrink: 0,
            // Wails drag region — allows window dragging from this bar
            // @ts-ignore
            '--wails-draggable': 'drag',
          } as React.CSSProperties}
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          data-wails-drag
        >
          {/* App title + connection indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text, letterSpacing: -0.2 }}>Snowy</span>
            {activeDatasource && (
              <>
                <span style={{ color: textDim, fontSize: 12 }}>/</span>
                <span style={{ fontSize: 12, color: textSec, fontFamily: mono }}>{activeDatasource.name}</span>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: ok, boxShadow: `0 0 5px ${ok}`, flexShrink: 0 }} />
              </>
            )}
          </div>
          <div style={{ flex: 1 }} />
          {/* Connection manager button */}
          <button
            onClick={() => setView('connections')}
            title="Manage connections"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 10px',
              background: T.panelAlt, border: `0.5px solid ${border}`,
              borderRadius: 5, fontSize: 11.5, color: textSec,
              cursor: 'pointer', fontFamily: ui,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <ellipse cx="8" cy="4" rx="5" ry="1.8" />
              <path d="M3 4v4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4" />
              <path d="M3 8v4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V8" />
            </svg>
            Connections
          </button>
        </div>

        {/* ── Main workspace row ────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Sidebar
          datasources={datasources}
          activeDatasourceId={activeDatasourceId}
          onConnect={handleConnect}
          onTableSelect={(s, t) => {
            const q = `SELECT * FROM ${s}.${t} LIMIT 100;`;
            openTab(makeTab(`${s}.${t}`, q));
            handleRunQuery(q);
          }}
          savedQueries={savedQueries}
          onLoadQuery={handleLoadQuery}
          onDeleteQuery={handleDeleteQuery}
          onRenameQuery={handleRenameQuery}
          onAddConnection={() => setView('connections')}
          onNewConsole={handleNewTab}
          onDisconnect={handleDisconnect}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Editor area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <TabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onSelect={handleTabSelect}
              onClose={handleTabClose}
              onNew={handleNewTab}
            />
            <div style={{ flex: 1, minHeight: 0 }}>
              {activeTab ? (
                <QueryEditor
                  sql={activeTab.sql}
                  onChange={handleEditorChange}
                  onRun={handleRunQuery}
                  onSave={handleSaveQuery}
                  loading={queryLoading}
                  completions={completions}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: textDim, fontSize: 12, background: T.panel, height: '100%' }}>
                  Open a query or click + to start
                </div>
              )}
            </div>
          </div>

          {/* Services panel (bottom, 320px) */}
          <div style={{ height: 320, display: 'flex', minHeight: 0, borderTop: `1px solid ${borderStrong}`, flexShrink: 0 }}>
            {/* Mini services tree */}
            <div style={{ width: 220, background: sidebar, borderRight: `0.5px solid ${border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              {/* Services header */}
              <div style={{ height: 24, display: 'flex', alignItems: 'center', padding: '0 10px', background: chrome, borderBottom: `0.5px solid ${border}`, fontSize: 11.5, fontWeight: 600, color: T.text, flexShrink: 0 }}>
                Services
              </div>
              {/* Services tree */}
              <div style={{ flex: 1, overflow: 'hidden', padding: '4px 0', fontSize: 12 }}>
                {/* Database folder */}
                <div style={{ height: 22, display: 'flex', alignItems: 'center', paddingLeft: 6, paddingRight: 8, gap: 5, color: T.text, borderLeft: '2px solid transparent' }}>
                  <ChevronRight size={9} color={textDim} style={{ transform: 'rotate(90deg)' }} />
                  <Folder size={12} color={accent} />
                  <span>Database</span>
                </div>
                {/* Active connection */}
                <div style={{ height: 22, display: 'flex', alignItems: 'center', paddingLeft: 20, paddingRight: 8, gap: 5, color: T.text, borderLeft: '2px solid transparent' }}>
                  <ChevronRight size={9} color={textDim} style={{ transform: 'rotate(90deg)' }} />
                  <ElephantGlyph color={accent} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeDatasource?.name ?? 'connection'}</span>
                </div>
                {/* Console row (selected) */}
                <div style={{ height: 22, display: 'flex', alignItems: 'center', paddingLeft: 34, paddingRight: 8, gap: 5, color: T.text, background: T.hover, borderLeft: `2px solid ${accent}` }}>
                  <div style={{ width: 9 }} />
                  <Terminal size={12} color={accent} />
                  <span style={{ flex: 1 }}>console</span>
                  {durationMs > 0 && <span style={{ fontSize: 10.5, color: textDim, fontFamily: mono }}>{durationMs} ms</span>}
                </div>
              </div>
            </div>

            {/* Results panel */}
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <ResultsPanel
                resultTabs={resultTabs}
                activeResultTabId={activeResultTabId}
                loading={queryLoading}
                onSelectTab={setActiveResultTabId}
                onPin={handlePinResult}
                onUnpin={handleUnpinResult}
                onCloseTab={handleCloseResultTab}
                onOpenHistory={handleOpenHistory}
              />
            </div>
          </div>

          {/* Status bar */}
          <div style={{ height: 22, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 14, background: chrome, borderTop: `0.5px solid ${border}`, fontSize: 10.5, color: textSec, fontFamily: mono, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: ok, boxShadow: `0 0 6px ${ok}`, flexShrink: 0 }} />
              <span>{activeDatasource?.host}:{activeDatasource?.port}</span>
            </div>
            <span>{activeDatasource?.database}</span>
            <span>utf-8</span>
            <div style={{ flex: 1 }} />
            {durationMs > 0 && <span>{rowCount} rows · {durationMs} ms</span>}
            <span style={{ color: textDim }}>UTC</span>
          </div>
        </div>

        {/* History drawer */}
        {historyOpen && (
          <HistoryDrawer
            entries={historyEntries}
            loading={historyLoading}
            onClose={() => setHistoryOpen(false)}
            onSelect={handleHistorySelect}
          />
        )}
        </div>{/* end main workspace row */}

        {/* Dialogs */}
        {dialog?.type === 'save-query' && (
          <InputDialog
            title="Save query"
            placeholder="filename (without .sql)"
            confirmLabel="Save"
            onConfirm={name => { setDialog(null); doSaveQuery(name); }}
            onCancel={() => setDialog(null)}
          />
        )}
        {dialog?.type === 'confirm-close' && (
          <ConfirmDialog
            message={`"${dialog.tabLabel}" has unsaved changes. Close anyway?`}
            confirmLabel="Close anyway"
            onConfirm={() => { setDialog(null); doCloseTab(dialog.tabId); }}
            onCancel={() => setDialog(null)}
          />
        )}
      </div>
      </WorkspaceErrorBoundary>
    );
  }

  // ── Connection manager view ─────────────────────────────────────────────
  return (
    <ConnectionManager
      projects={projects}
      datasources={datasources}
      activeDatasourceId={activeDatasourceId}
      onConnect={handleConnect}
      onSaveAll={handleSaveAll}
      onUpdateDs={handleUpdateDs}
    />
  );
}

export default App;
