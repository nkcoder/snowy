import { useState, useEffect, Component, type ReactNode, type ErrorInfo } from 'react';
import * as GoApp from '../wailsjs/go/main/App';

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
        <div style={{ padding: 32, color: '#ff6b6b', fontFamily: 'monospace', fontSize: 13, background: '#1a1917', height: '100vh', overflow: 'auto' }}>
          <strong>Workspace render error</strong>
          <pre style={{ marginTop: 12, whiteSpace: 'pre-wrap', color: '#ecebe8' }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 16, padding: '6px 14px', background: '#3574f0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
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
import { ResultsTable } from './components/ResultsTable';
import { ConnectionManager } from './components/ConnectionManager';
import { TabBar, type Tab } from './components/TabBar';
import { ChevronRight, Database, LogOut } from 'lucide-react';
import './App.css';

// ── Tab helpers ────────────────────────────────────────────────────────────────
let _tabSeq = 0;
function makeTab(label = 'untitled', sql = '', filename: string | null = null): Tab {
  return { id: `tab-${++_tabSeq}`, label, filename, sql, dirty: false };
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

// Design tokens applied to workspace chrome
const chrome = '#252320';
const border = 'rgba(255,255,255,0.07)';
const accent = 'oklch(0.62 0.17 240)';
const textSec = '#a9a59d';
const textDim = '#6e6a62';
const bg = '#1a1917';
const panel = '#1f1d1b';
const mono = '"SF Mono", ui-monospace, "JetBrains Mono", Menlo, monospace';
const ui = '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';

function App() {
  const [view, setView] = useState<AppView>('connections');
  const [projects, setProjects] = useState<Project[]>([]);
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [activeDatasourceId, setActiveDatasourceId] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<{ columns: string[]; rows: any[][] } | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [savedQueries, setSavedQueries] = useState<{ filename: string }[]>([]);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      const config = await GoApp.GetConfig();
      // Backfill env/sslMode for existing datasources that predate these fields
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

  // ── Tab helpers ──────────────────────────────────────────────────────────────
  const activeTab = tabs.find(t => t.id === activeTabId) ?? null;

  const openTab = (tab: Tab) => {
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
  };

  const updateActiveTab = (patch: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...patch } : t));
  };

  const handleTabSelect = (id: string) => setActiveTabId(id);

  const handleTabClose = (id: string) => {
    const tab = tabs.find(t => t.id === id);
    if (tab?.dirty && !window.confirm(`"${tab.label}" has unsaved changes. Close anyway?`)) return;
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

  const handleNewTab = () => {
    const tab = makeTab();
    openTab(tab);
  };

  // ── Connect / workspace ──────────────────────────────────────────────────────
  const handleConnect = (dsId: string) => {
    setActiveDatasourceId(dsId);
    setQueryResult(null);
    setSavedQueries([]);
    // Start with one empty tab
    const initial = makeTab();
    setTabs([initial]);
    setActiveTabId(initial.id);
    setView('workspace');
    GoApp.ListSavedQueries(dsId).then(data => setSavedQueries(data ?? [])).catch(() => {});
  };

  // ── Sidebar query actions ────────────────────────────────────────────────────
  const handleLoadQuery = async (filename: string) => {
    if (!activeDatasourceId) return;
    // Focus existing tab if already open
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
      // Close any open tab for this file
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
      // Update any open tab referencing the old name
      setTabs(prev => prev.map(t =>
        t.filename === oldFilename ? { ...t, filename: newFilename, label: newFilename } : t
      ));
    } catch (err) {
      console.error('Failed to rename query', err);
    }
  };

  const handleSaveQuery = async () => {
    if (!activeDatasourceId || !activeTab) return;
    // If tab already has a filename, overwrite silently; else prompt
    let filename = activeTab.filename;
    if (!filename) {
      const name = window.prompt('Save query as (without .sql):');
      if (!name?.trim()) return;
      filename = name.trim();
    }
    try {
      await GoApp.SaveQuery(activeDatasourceId, filename, activeTab.sql);
      const updated = await GoApp.ListSavedQueries(activeDatasourceId);
      setSavedQueries(updated ?? []);
      updateActiveTab({ filename, label: filename, dirty: false });
    } catch (err) {
      alert('Failed to save: ' + err);
    }
  };

  const handleRunQuery = async (sql: string) => {
    if (!activeDatasourceId) return;
    setQueryLoading(true);
    try {
      const result = await GoApp.ExecuteQuery(activeDatasourceId, sql);
      setQueryResult(result);
    } catch (err: any) {
      alert('Query failed: ' + err);
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
    return (
      <WorkspaceErrorBoundary>
      <div style={{ display: 'flex', height: '100vh', background: bg, color: '#ecebe8', fontFamily: ui, overflow: 'hidden' }}>
        <Sidebar
          datasourceId={activeDatasourceId}
          datasourceName={activeDatasource?.name}
          datasourceDb={activeDatasource?.database}
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
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Workspace header bar */}
          <div style={{
            height: 36,
            borderBottom: `0.5px solid ${border}`,
            background: chrome,
            padding: '0 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <div style={{ width: 18, height: 18, background: accent + '30', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Database size={11} color={accent} />
              </div>
              <span style={{ color: '#ecebe8', fontWeight: 500 }}>{activeDatasource?.name}</span>
              <ChevronRight size={11} color={textDim} />
              <span style={{ color: textSec, fontFamily: mono, fontSize: 11.5 }}>{activeDatasource?.database}</span>
              <span style={{ color: textDim }}>·</span>
              <span style={{ color: accent, fontFamily: mono, fontSize: 11.5 }}>console</span>
            </div>
            <button
              onClick={() => setView('connections')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3,
                color: textDim, background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <LogOut size={13} />
              Close Workspace
            </button>
          </div>

          {/* Editor + Results */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <TabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onSelect={handleTabSelect}
              onClose={handleTabClose}
              onNew={handleNewTab}
            />
            <div style={{ height: 'calc(50% - 30px)', minHeight: 170 }}>
              {activeTab ? (
                <QueryEditor
                  sql={activeTab.sql}
                  onChange={handleEditorChange}
                  onRun={handleRunQuery}
                  onSave={handleSaveQuery}
                  loading={queryLoading}
                />
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6e6a62', fontSize: 12, background: '#1e1f22', height: '100%' }}>
                  Open a query or click + to start
                </div>
              )}
            </div>
            <div style={{ flex: 1, borderTop: `0.5px solid ${border}`, minHeight: 120, overflow: 'hidden' }}>
              <ResultsTable data={queryResult} loading={queryLoading} />
            </div>
          </div>
        </div>
      </div>
      </WorkspaceErrorBoundary>
    );
  }

  // ── Connection manager view ─────────────────────────────────────────────
  return (
    <ConnectionManager
      projects={projects}
      datasources={datasources}
      onConnect={handleConnect}
      onSaveAll={handleSaveAll}
      onUpdateDs={handleUpdateDs}
    />
  );
}

export default App;
