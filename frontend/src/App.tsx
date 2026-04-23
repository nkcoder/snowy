import { useState, useEffect } from 'react';
import * as GoApp from '../wailsjs/go/main/App';
import { Sidebar } from './components/Sidebar';
import { QueryEditor } from './components/QueryEditor';
import { ResultsTable } from './components/ResultsTable';
import { ConnectionManager } from './components/ConnectionManager';
import { ChevronRight, Database, LogOut } from 'lucide-react';
import './App.css';

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

  const handleConnect = (dsId: string) => {
    setActiveDatasourceId(dsId);
    setQueryResult(null);
    setView('workspace');
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

  const activeDatasource = datasources.find(d => d.id === activeDatasourceId);

  // ── Workspace view ──────────────────────────────────────────────────────
  if (view === 'workspace') {
    return (
      <div style={{ display: 'flex', height: '100vh', background: bg, color: '#ecebe8', fontFamily: ui, overflow: 'hidden' }}>
        <Sidebar
          datasourceId={activeDatasourceId}
          datasourceName={activeDatasource?.name}
          datasourceDb={activeDatasource?.database}
          onTableSelect={(s, t) => handleRunQuery(`SELECT * FROM ${s}.${t} LIMIT 100;`)}
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
            <div style={{ height: '50%', minHeight: 200 }}>
              <QueryEditor onRun={handleRunQuery} loading={queryLoading} />
            </div>
            <div style={{ flex: 1, borderTop: `0.5px solid ${border}`, minHeight: 120, overflow: 'hidden' }}>
              <ResultsTable data={queryResult} loading={queryLoading} />
            </div>
          </div>
        </div>
      </div>
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
