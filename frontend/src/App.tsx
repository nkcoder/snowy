import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react';
import * as GoApp from '../wailsjs/go/main/App';
import type { main } from '../wailsjs/go/models';
import { ConnectionManager } from './components/ConnectionManager';
import { ConfirmDialog, InputDialog } from './components/Dialog';
import { HistoryDrawer } from './components/HistoryDrawer';
import { QueryEditor } from './components/QueryEditor';
import { ResultsPanel } from './components/ResultsPanel';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { Toast } from './components/Toast';
import { useDatasourceSession } from './hooks/useDatasourceSession';
import { usePanelResize } from './hooks/usePanelResize';
import { useQueryExecution } from './hooks/useQueryExecution';
import { useQueryHistory } from './hooks/useQueryHistory';
import { useTabManager } from './hooks/useTabManager';
import { T } from './lib/tokens';
import type { Datasource, Project } from './types';

// ── Error boundary ────────────────────────────────────────────────────────────
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
        <div
          style={{
            padding: 32,
            color: T.err,
            background: T.bg,
          }}
          className="font-mono text-[13px] h-screen overflow-auto"
        >
          <strong>Workspace render error</strong>
          <pre style={{ color: T.text }} className="mt-3 whitespace-pre-wrap">
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            style={{ background: T.accent, color: '#fff' }}
            className="mt-4 px-3 py-1.5 border-none rounded cursor-pointer"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

type AppView = 'connections' | 'workspace';

type DialogState =
  | { type: 'save-query'; suggestedName: string }
  | { type: 'confirm-close'; tabId: string; tabLabel: string };

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [view, setView] = useState<AppView>('connections');
  const [projects, setProjects] = useState<Project[]>([]);
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [appVersion, setAppVersion] = useState({ version: '0.0.1', buildDate: '' });
  const [cmAddMode, setCmAddMode] = useState(false);
  const [cmEditDsId, setCmEditDsId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  // ── Resize handle hover ───────────────────────────────────────────────────
  const [sidebarHandleHovered, setSidebarHandleHovered] = useState(false);
  const [bottomHandleHovered, setBottomHandleHovered] = useState(false);

  // ── Panel visibility ──────────────────────────────────────────────────────
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [bottomVisible, setBottomVisible] = useState(true);

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const {
    activeDatasourceId,
    savedQueries,
    setSavedQueries,
    completions,
    metadata,
    connectionWarning,
    setConnectionWarning,
    refreshMetadata,
    connect,
    disconnect,
  } = useDatasourceSession();
  const {
    tabs,
    setTabs,
    activeTabId,
    activeTab,
    makeTab,
    openTab,
    updateActiveTab,
    doCloseTab,
    handleTabSelect,
    handleNewTab,
  } = useTabManager();

  const {
    sidebarWidth,
    bottomHeight,
    startSidebarDrag,
    startBottomDrag,
    isSidebarDragging,
    isBottomDragging,
  } = usePanelResize();

  const {
    queryLoading,
    resultTabs,
    activeResultTabId,
    setActiveResultTabId,
    handleRunQuery: runQueryInternal,
    handlePinResult,
    handleCloseResultTab,
    handleUnpinResult,
    resetResults,
  } = useQueryExecution(activeDatasourceId);

  const { historyOpen, historyEntries, historyLoading, openHistory, closeHistory, clearHistory } =
    useQueryHistory(activeDatasourceId);

  const handleRunQuery = (sql: string) => {
    setBottomVisible(true);
    runQueryInternal(sql);
  };

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  const loadConfig = async () => {
    try {
      const config = await GoApp.GetConfig();
      const ds = (config.datasources ?? []).map((d: main.Datasource) => ({
        ...d,
        env: d.env || 'local',
        sslMode: d.sslMode || 'require',
      }));
      setProjects(config.projects ?? []);
      setDatasources(ds);
    } catch (err) {
      console.error('Failed to load config', err);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount; loadConfig is stable but not memoized
  useEffect(() => {
    loadConfig();
    GoApp.GetAppVersion()
      .then((v) => setAppVersion({ version: v.version ?? '0.0.1', buildDate: v.buildDate ?? '' }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const suppress = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', suppress);
    return () => document.removeEventListener('contextmenu', suppress);
  }, []);

  // ── Config actions ────────────────────────────────────────────────────────
  const handleSaveAll = async (updatedProjects: Project[], updatedDatasources: Datasource[]) => {
    await GoApp.SaveConfig({
      projects: updatedProjects,
      datasources: updatedDatasources,
    } as main.Config);
    setProjects(updatedProjects);
    setDatasources(updatedDatasources);
  };

  const handleUpdateDs = async (ds: Datasource) => {
    await GoApp.UpdateDatasource(ds as main.Datasource);
    setDatasources((prev) => prev.map((d) => (d.id === ds.id ? ds : d)));
  };

  // ── Tab close with dirty-check dialog ────────────────────────────────────
  const handleTabClose = (id: string) => {
    const tab = tabs.find((t) => t.id === id);
    if (tab?.dirty) {
      setDialog({ type: 'confirm-close', tabId: id, tabLabel: tab.label });
      return;
    }
    doCloseTab(id);
  };

  // ── Connect ───────────────────────────────────────────────────────────────
  // useDatasourceSession owns the connection/metadata data; App orchestrates the
  // surrounding tab/results/view reset.
  const handleConnect = (dsId: string) => {
    connect(dsId);
    resetResults();
    const initial = makeTab();
    setTabs([initial]);
    handleTabSelect(initial.id);
    setView('workspace');
  };

  const handleDisconnect = () => {
    disconnect();
    setView('connections');
  };

  // ── Sidebar query actions ─────────────────────────────────────────────────
  const handleLoadQuery = async (filename: string) => {
    if (!activeDatasourceId) return;
    const existing = tabs.find((t) => t.filename === filename);
    if (existing) {
      handleTabSelect(existing.id);
      return;
    }
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
      setSavedQueries((prev) => prev.filter((q) => q.filename !== filename));
      const tab = tabs.find((t) => t.filename === filename);
      if (tab) handleTabClose(tab.id);
    } catch (err) {
      console.error('Failed to delete query', err);
    }
  };

  const handleRenameQuery = async (oldFilename: string, newFilename: string) => {
    if (!activeDatasourceId) return;
    try {
      await GoApp.RenameQuery(activeDatasourceId, oldFilename, newFilename);
      setSavedQueries((prev) =>
        prev.map((q) => (q.filename === oldFilename ? { filename: newFilename } : q))
      );
      setTabs((prev) =>
        prev.map((t) =>
          t.filename === oldFilename ? { ...t, filename: newFilename, label: newFilename } : t
        )
      );
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
      const base = activeTab.label.replace(/\.sql$/i, '');
      setDialog({ type: 'save-query', suggestedName: `${base}.sql` });
      return;
    }
    doSaveQuery(activeTab.filename);
  };

  // ── History ───────────────────────────────────────────────────────────────
  const handleHistorySelect = (sql: string) => {
    closeHistory();
    if (activeTab) {
      updateActiveTab({ sql, dirty: true });
    } else {
      openTab(makeTab('from history', sql));
    }
  };

  const activeDatasource = datasources.find((d) => d.id === activeDatasourceId);
  const liveTab = resultTabs.find((t) => !t.pinned);
  const rowCount = liveTab?.rowCount ?? 0;
  const durationMs = liveTab?.durationMs ?? 0;

  // ── Workspace view ────────────────────────────────────────────────────────
  if (view === 'workspace') {
    return (
      <WorkspaceErrorBoundary>
        <Toast />
        <div
          style={{ background: T.bg, color: T.text, fontFamily: T.ui }}
          className="flex flex-col h-screen overflow-hidden"
        >
          {/* Title bar */}
          <div
            style={{
              height: 38,
              background: T.chrome,
              borderBottom: `0.5px solid ${T.border}`,
              // @ts-expect-error Wails drag region
              '--wails-draggable': 'drag',
            }}
            className="flex items-center shrink-0 gap-3.5 pl-5 pr-4"
            data-wails-drag
          >
            <div className="flex items-center gap-2 min-w-0">
              <span style={{ color: T.text }} className="text-[13px] font-semibold tracking-tight">
                Snowy
              </span>
              {activeDatasource && (
                <>
                  <span style={{ color: T.textDim }} className="text-xs">
                    /
                  </span>
                  <span style={{ color: T.textSec, fontFamily: T.mono }} className="text-xs">
                    {activeDatasource.name}
                  </span>
                  <div
                    style={{ background: T.ok, boxShadow: `0 0 5px ${T.ok}` }}
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                  />
                </>
              )}
            </div>
            <button
              type="button"
              data-testid="sidebar-toggle"
              onClick={() => setSidebarVisible((v) => !v)}
              title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
              style={{ color: sidebarVisible ? T.textSec : T.textDim }}
              className="p-1 bg-transparent border-none cursor-pointer flex items-center rounded ml-1"
            >
              {sidebarVisible ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setView('connections')}
              title="Manage connections"
              style={{
                background: T.panelAlt,
                border: `0.5px solid ${T.border}`,
                color: T.textSec,
                fontFamily: T.ui,
              }}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[11.5px] cursor-pointer"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <ellipse cx="8" cy="4" rx="5" ry="1.8" />
                <path d="M3 4v4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4" />
                <path d="M3 8v4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V8" />
              </svg>
              Connections
            </button>
          </div>

          {/* Connection warning banner — live connection failed, showing cached metadata */}
          {connectionWarning && connectionWarning.dsId === activeDatasourceId && (
            <div
              data-testid="connection-warning"
              style={{
                background: 'rgba(229,192,123,0.1)',
                borderBottom: '1px solid rgba(229,192,123,0.3)',
                color: '#e5c07b',
                fontFamily: T.ui,
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-[11.5px] shrink-0"
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                Live connection failed — showing cached metadata. {connectionWarning.message}
              </span>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setConnectionWarning(null)}
                style={{ color: 'inherit' }}
                className="p-0.5 bg-transparent border-none cursor-pointer flex items-center"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Main row */}
          <div className="flex-1 flex min-h-0" style={{ minHeight: 0 }}>
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
              activeQueryFilename={activeTab?.filename ?? null}
              onLoadQuery={handleLoadQuery}
              onDeleteQuery={handleDeleteQuery}
              onRenameQuery={handleRenameQuery}
              onAddConnection={() => {
                setView('connections');
                setCmAddMode(true);
              }}
              appVersion={appVersion.version}
              appBuildDate={appVersion.buildDate}
              onNewConsole={handleNewTab}
              onDisconnect={handleDisconnect}
              onShowProperties={(dsId) => {
                setCmEditDsId(dsId);
                setView('connections');
              }}
              width={sidebarVisible ? sidebarWidth : 0}
              preloadedMetadata={metadata}
              onRefreshMetadata={
                activeDatasourceId ? () => refreshMetadata(activeDatasourceId) : undefined
              }
            />

            {/* Sidebar resize handle — hidden when sidebar is collapsed */}
            {sidebarVisible && (
              <div
                data-testid="sidebar-resize-handle"
                onMouseDown={startSidebarDrag}
                onMouseEnter={() => setSidebarHandleHovered(true)}
                onMouseLeave={() => setSidebarHandleHovered(false)}
                className="w-2.5 shrink-0 cursor-col-resize"
                style={{
                  borderLeft: `${sidebarHandleHovered || isSidebarDragging ? 4 : 1}px solid ${sidebarHandleHovered || isSidebarDragging ? T.accent : T.border}`,
                  transition: isSidebarDragging ? 'none' : 'border 0.1s ease',
                }}
              />
            )}

            <div
              className="flex-1 flex flex-col min-w-0 overflow-hidden"
              style={{ minHeight: 0, minWidth: 0 }}
            >
              {/* Editor area */}
              <div className="flex-1 flex flex-col min-h-0" style={{ minHeight: 0 }}>
                <TabBar
                  tabs={tabs}
                  activeTabId={activeTabId}
                  onSelect={handleTabSelect}
                  onClose={handleTabClose}
                  onNew={handleNewTab}
                />
                <div className="flex-1 min-h-0 overflow-hidden" style={{ minHeight: 0 }}>
                  {activeTab ? (
                    <QueryEditor
                      sql={activeTab.sql}
                      onChange={(sql) => updateActiveTab({ sql, dirty: true })}
                      onRun={handleRunQuery}
                      onSave={handleSaveQuery}
                      onOpenHistory={openHistory}
                      loading={queryLoading}
                      completions={completions}
                    />
                  ) : (
                    <div
                      style={{ color: T.textDim, background: T.panel }}
                      className="flex items-center justify-center h-full text-xs"
                    >
                      Open a query or click + to start
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom resize handle — hidden when results panel is collapsed */}
              {bottomVisible && (
                <div
                  data-testid="bottom-resize-handle"
                  onMouseDown={startBottomDrag}
                  onMouseEnter={() => setBottomHandleHovered(true)}
                  onMouseLeave={() => setBottomHandleHovered(false)}
                  style={{
                    borderTop: `${bottomHandleHovered || isBottomDragging ? 4 : 1}px solid ${bottomHandleHovered || isBottomDragging ? T.accent : T.border}`,
                    zIndex: 10,
                    transition: isBottomDragging ? 'none' : 'border 0.1s ease',
                  }}
                  className="h-2.5 shrink-0 cursor-row-resize"
                />
              )}

              {/* Bottom panel */}
              <div
                style={{ height: bottomVisible ? bottomHeight : 'auto' }}
                className="flex min-h-0 shrink-0"
              >
                {/* Results panel */}
                <div className="flex-1 min-w-0 overflow-hidden" style={{ minWidth: 0 }}>
                  <ResultsPanel
                    resultTabs={resultTabs}
                    activeResultTabId={activeResultTabId}
                    loading={queryLoading}
                    onSelectTab={setActiveResultTabId}
                    onPin={handlePinResult}
                    onUnpin={handleUnpinResult}
                    onCloseTab={handleCloseResultTab}
                    onOpenHistory={openHistory}
                    onTogglePanel={() => setBottomVisible((v) => !v)}
                    bottomVisible={bottomVisible}
                    collapsed={!bottomVisible}
                  />
                </div>
              </div>

              {/* Status bar */}
              <div
                style={{
                  background: T.chrome,
                  borderTop: `0.5px solid ${T.border}`,
                  color: T.textSec,
                  fontFamily: T.mono,
                }}
                className="h-[22px] flex items-center pl-3.5 pr-5 gap-3.5 text-[10.5px] shrink-0"
              >
                <div className="flex items-center gap-1">
                  <div
                    style={{ background: T.ok, boxShadow: `0 0 6px ${T.ok}` }}
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                  />
                  <span>
                    {activeDatasource?.host}:{activeDatasource?.port}
                  </span>
                </div>
                <span style={{ color: T.textDim }}>·</span>
                <span>{activeDatasource?.database}</span>
                <span style={{ color: T.textDim }}>·</span>
                <span>utf-8</span>
                <div className="flex-1" />
                {durationMs > 0 && (
                  <>
                    <span>
                      {rowCount} rows · {durationMs}ms
                    </span>
                    <span style={{ color: T.textDim }}>·</span>
                  </>
                )}
                <span style={{ color: T.textDim }}>UTC</span>
              </div>
            </div>

            {/* History drawer */}
            {historyOpen && (
              <HistoryDrawer
                entries={historyEntries}
                loading={historyLoading}
                onClose={closeHistory}
                onSelect={handleHistorySelect}
                onClear={clearHistory}
              />
            )}
          </div>

          {/* Dialogs */}
          {dialog?.type === 'save-query' && (
            <InputDialog
              title="Save query"
              placeholder="filename.sql"
              defaultValue={dialog.suggestedName}
              confirmLabel="Save"
              onConfirm={(name) => {
                setDialog(null);
                doSaveQuery(name);
              }}
              onCancel={() => setDialog(null)}
            />
          )}
          {dialog?.type === 'confirm-close' && (
            <ConfirmDialog
              message={`"${dialog.tabLabel}" has unsaved changes. Close anyway?`}
              confirmLabel="Close anyway"
              onConfirm={() => {
                setDialog(null);
                doCloseTab(dialog.tabId);
              }}
              onCancel={() => setDialog(null)}
            />
          )}
        </div>
      </WorkspaceErrorBoundary>
    );
  }

  // ── Connection manager view ───────────────────────────────────────────────
  return (
    <>
      <Toast />
      <ConnectionManager
        projects={projects}
        datasources={datasources}
        activeDatasourceId={activeDatasourceId}
        onConnect={handleConnect}
        onSaveAll={handleSaveAll}
        onUpdateDs={handleUpdateDs}
        startInAddMode={cmAddMode}
        onAddModeConsumed={() => setCmAddMode(false)}
        openEditDsId={cmEditDsId}
        onEditModeConsumed={() => setCmEditDsId(null)}
        appVersion={appVersion.version}
        appBuildDate={appVersion.buildDate}
      />
    </>
  );
}

export default App;
