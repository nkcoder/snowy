import { useState } from 'react';
import {
  Plus, Settings, X, Wifi, Eye, EyeOff, ChevronDown,
  Database, Check, AlertCircle, Loader,
} from 'lucide-react';
import * as GoApp from '../../wailsjs/go/main/App';

// ── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:             '#1a1917',
  chrome:         '#252320',
  panel:          '#1f1d1b',
  panelAlt:       '#232120',
  sidebar:        '#1d1b19',
  border:         'rgba(255,255,255,0.07)',
  borderStrong:   'rgba(255,255,255,0.13)',
  divider:        'rgba(255,255,255,0.05)',
  text:           '#ecebe8',
  textSec:        '#a9a59d',
  textDim:        '#6e6a62',
  hover:          'rgba(255,255,255,0.04)',
  selected:       'oklch(0.28 0.07 240)',
  selectedBorder: 'oklch(0.62 0.17 240)',
  accent:         'oklch(0.62 0.17 240)',
  accentHover:    'oklch(0.68 0.17 240)',
  ok:             'oklch(0.60 0.14 155)',
  err:            'oklch(0.58 0.19 25)',
  warn:           'oklch(0.70 0.15 75)',
  mono:           '"SF Mono", ui-monospace, "JetBrains Mono", Menlo, monospace',
  ui:             '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
};

const ENV_COLORS: Record<string, string> = {
  prod:  T.err,
  stg:   T.warn,
  dev:   T.ok,
  local: T.accent,
};

const PROJECT_COLORS = [
  'oklch(0.62 0.17 240)',  // blue
  'oklch(0.60 0.18 320)',  // magenta
  'oklch(0.60 0.14 155)',  // green
  'oklch(0.70 0.15 75)',   // amber
  'oklch(0.58 0.17 290)',  // purple
  'oklch(0.58 0.19 25)',   // red
];

// ── Types ────────────────────────────────────────────────────────────────────
interface Project {
  id: string;
  name: string;
}

interface Datasource {
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
}

type FormMode = null | 'add' | 'edit';

interface TestResult {
  success: boolean;
  message: string;
}

interface Props {
  projects: Project[];
  datasources: Datasource[];
  onConnect: (dsId: string) => void;
  onSaveAll: (projects: Project[], datasources: Datasource[]) => Promise<void>;
  onUpdateDs: (ds: Datasource) => Promise<void>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function projectColor(projects: Project[], id: string): string {
  const idx = projects.findIndex(p => p.id === id);
  return PROJECT_COLORS[idx % PROJECT_COLORS.length];
}

const emptyForm = (): Omit<Datasource, 'id' | 'projectId'> => ({
  name: '',
  host: 'localhost',
  port: 5432,
  database: '',
  username: '',
  password: '',
  env: 'local',
  sslMode: 'disable',
});

// ── Sub-components ───────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: T.textDim, fontFamily: T.ui,
      display: 'flex', alignItems: 'center',
    }}>
      {children}
    </div>
  );
}

function FieldInput({
  value, onChange, type = 'text', mono = false, readOnly = false,
  placeholder, style: extraStyle = {},
}: {
  value: string | number;
  onChange?: (v: string) => void;
  type?: string;
  mono?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  return (
    <input
      type={type}
      readOnly={readOnly}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange?.(e.target.value)}
      style={{
        background: T.panelAlt,
        border: `0.5px solid ${T.borderStrong}`,
        borderRadius: 5,
        padding: '5px 8px',
        fontSize: 12,
        color: readOnly ? T.textSec : T.text,
        fontFamily: mono ? T.mono : T.ui,
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
        ...extraStyle,
      }}
      onFocus={e => { if (!readOnly) e.target.style.borderColor = T.accent; }}
      onBlur={e => { e.target.style.borderColor = T.borderStrong; }}
    />
  );
}

function SelectInput({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: T.panelAlt,
        border: `0.5px solid ${T.borderStrong}`,
        borderRadius: 5,
        padding: '5px 8px',
        fontSize: 12,
        color: T.text,
        fontFamily: T.ui,
        outline: 'none',
        width: '100%',
        appearance: 'none',
        cursor: 'pointer',
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Edit / Add form ──────────────────────────────────────────────────────────
function ConnectionForm({
  initial, projectId, onSave, onCancel, onTest,
}: {
  initial: Partial<Datasource>;
  projectId: string;
  onSave: (ds: Datasource) => Promise<void>;
  onCancel: () => void;
  onTest: (ds: Partial<Datasource>) => Promise<TestResult>;
}) {
  const [form, setForm] = useState<Omit<Datasource, 'id' | 'projectId'>>({
    name:     initial.name     ?? '',
    host:     initial.host     ?? 'localhost',
    port:     initial.port     ?? 5432,
    database: initial.database ?? '',
    username: initial.username ?? '',
    password: initial.password ?? '',
    env:      initial.env      ?? 'local',
    sslMode:  initial.sslMode  ?? 'disable',
  });
  const [showPass, setShowPass] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const derivedUrl = `postgres://${form.username}:${form.password ? '••••' : ''}@${form.host}:${form.port}/${form.database}?sslmode=${form.sslMode}`;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const r = await onTest(form);
    setTestResult(r);
    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      id:        initial.id ?? `${Date.now()}`,
      projectId,
      ...form,
    });
    setSaving(false);
  };

  const tabs = ['General', 'SSH / TLS', 'Schemas', 'Advanced'];

  return (
    <div style={{
      border: `0.5px solid ${T.border}`,
      borderRadius: 8,
      background: T.panel,
      overflow: 'hidden',
    }}>
      {/* Form header */}
      <div style={{
        padding: '8px 14px',
        background: T.chrome,
        borderBottom: `0.5px solid ${T.border}`,
        fontSize: 12, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 8,
        color: T.text,
      }}>
        <Settings size={12} color={T.textSec} />
        {initial.id ? (
          <span>Editing · <span style={{ color: T.accent }}>{initial.name}</span></span>
        ) : (
          <span>New connection</span>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', padding: '0 14px',
        borderBottom: `0.5px solid ${T.divider}`,
        background: T.panel,
      }}>
        {tabs.map((tab, i) => (
          <div
            key={tab}
            onClick={() => setActiveTab(i)}
            style={{
              padding: '7px 12px',
              fontSize: 11.5,
              fontWeight: i === activeTab ? 600 : 500,
              color: i === activeTab ? T.text : T.textSec,
              borderBottom: i === activeTab ? `2px solid ${T.accent}` : '2px solid transparent',
              marginBottom: -1,
              cursor: 'pointer',
              opacity: i > 0 ? 0.4 : 1,
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* General tab */}
      {activeTab === 0 && (
        <div style={{
          padding: 14,
          display: 'grid',
          gridTemplateColumns: '110px 1fr 60px 1fr',
          gap: '10px 10px',
          alignItems: 'center',
        }}>
          {/* Name */}
          <FieldLabel>Name</FieldLabel>
          <div style={{ gridColumn: 'span 3' }}>
            <FieldInput value={form.name} onChange={v => set('name', v)} placeholder="e.g. production" />
          </div>

          {/* Host + Port */}
          <FieldLabel>Host</FieldLabel>
          <FieldInput value={form.host} onChange={v => set('host', v)} mono placeholder="localhost" />
          <FieldLabel>Port</FieldLabel>
          <FieldInput value={form.port} onChange={v => set('port', Number(v))} mono type="number" />

          {/* Database */}
          <FieldLabel>Database</FieldLabel>
          <div style={{ gridColumn: 'span 3' }}>
            <FieldInput value={form.database} onChange={v => set('database', v)} mono placeholder="mydb" />
          </div>

          {/* Authentication */}
          <FieldLabel>Authentication</FieldLabel>
          <div style={{ gridColumn: 'span 3' }}>
            <SelectInput value="password" onChange={() => {}} options={[{ value: 'password', label: 'User & Password' }]} />
          </div>

          {/* User */}
          <FieldLabel>User</FieldLabel>
          <div style={{ gridColumn: 'span 3' }}>
            <FieldInput value={form.username} onChange={v => set('username', v)} mono placeholder="postgres" />
          </div>

          {/* Password */}
          <FieldLabel>Password</FieldLabel>
          <div style={{ gridColumn: 'span 3', display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="••••••••"
                style={{
                  background: T.panelAlt,
                  border: `0.5px solid ${T.borderStrong}`,
                  borderRadius: 5,
                  padding: '5px 30px 5px 8px',
                  fontSize: 12,
                  color: T.text,
                  fontFamily: T.mono,
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={() => setShowPass(s => !s)}
                style={{
                  position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: T.textDim, padding: 0,
                  display: 'flex', alignItems: 'center',
                }}
              >
                {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          {/* Env */}
          <FieldLabel>Environment</FieldLabel>
          <div style={{ gridColumn: 'span 3' }}>
            <SelectInput
              value={form.env}
              onChange={v => set('env', v)}
              options={[
                { value: 'local', label: 'Local' },
                { value: 'dev',   label: 'Development' },
                { value: 'stg',   label: 'Staging' },
                { value: 'prod',  label: 'Production' },
              ]}
            />
          </div>

          {/* SSL mode */}
          <FieldLabel>SSL mode</FieldLabel>
          <div style={{ gridColumn: 'span 3' }}>
            <SelectInput
              value={form.sslMode}
              onChange={v => set('sslMode', v)}
              options={[
                { value: 'disable',     label: 'Disable' },
                { value: 'require',     label: 'Require' },
                { value: 'verify-ca',   label: 'Verify CA' },
                { value: 'verify-full', label: 'Verify Full' },
              ]}
            />
          </div>

          {/* Derived URL */}
          <FieldLabel>URL</FieldLabel>
          <div style={{ gridColumn: 'span 3' }}>
            <div style={{
              background: T.panelAlt,
              border: `0.5px solid ${T.border}`,
              borderRadius: 5,
              padding: '5px 8px',
              fontSize: 11,
              color: T.textSec,
              fontFamily: T.mono,
              wordBreak: 'break-all',
            }}>
              {derivedUrl}
            </div>
          </div>
        </div>
      )}

      {/* Other tabs — placeholder */}
      {activeTab > 0 && (
        <div style={{ padding: 24, color: T.textDim, fontSize: 12, textAlign: 'center', fontStyle: 'italic' }}>
          Not yet implemented
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div style={{
          margin: '0 14px 10px',
          padding: '7px 10px',
          background: (testResult.success ? T.ok : T.err) + '18',
          border: `0.5px solid ${(testResult.success ? T.ok : T.err)}55`,
          borderRadius: 5,
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11.5,
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: 8,
            background: testResult.success ? T.ok : T.err,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 9, fontWeight: 800, flexShrink: 0,
          }}>
            {testResult.success ? '✓' : '✕'}
          </div>
          <span style={{ color: T.text, fontWeight: 600 }}>
            {testResult.success ? 'Connection succeeded' : 'Connection failed'}
          </span>
          <span style={{ color: T.textSec, fontFamily: T.mono, fontSize: 11 }}>
            {testResult.message}
          </span>
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: '10px 14px',
        borderTop: `0.5px solid ${T.divider}`,
        display: 'flex', gap: 6, alignItems: 'center',
      }}>
        <button
          onClick={handleTest}
          disabled={testing || !form.host || !form.database}
          style={{
            padding: '4px 10px',
            background: T.panelAlt,
            border: `0.5px solid ${T.border}`,
            borderRadius: 4,
            fontSize: 11.5,
            color: T.textSec,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            opacity: testing ? 0.6 : 1,
          }}
        >
          {testing
            ? <Loader size={11} className="animate-spin" />
            : <Wifi size={11} color={testResult?.success ? T.ok : T.textSec} />
          }
          Test connection
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={onCancel}
          style={{
            padding: '4px 10px',
            border: `0.5px solid ${T.border}`,
            borderRadius: 4,
            fontSize: 11.5,
            color: T.textSec,
            background: 'none',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !form.name || !form.host || !form.database}
          style={{
            padding: '4px 12px',
            background: T.accent,
            color: '#fff',
            borderRadius: 4,
            fontSize: 11.5,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            opacity: saving || !form.name || !form.host || !form.database ? 0.5 : 1,
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          {saving && <Loader size={11} className="animate-spin" />}
          Save changes
        </button>
      </div>
    </div>
  );
}

// ── ConnectionManager ────────────────────────────────────────────────────────
export function ConnectionManager({ projects, datasources, onConnect, onSaveAll, onUpdateDs }: Props) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    projects[0]?.id ?? null
  );
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingDs, setEditingDs] = useState<Datasource | null>(null);

  // Project form
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectName, setProjectName] = useState('');

  const projectDs = datasources.filter(d => d.projectId === selectedProjectId);
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // ── Project CRUD ──
  const handleAddProject = async () => {
    if (!projectName.trim()) return;
    const newProj: Project = { id: `${Date.now()}`, name: projectName.trim() };
    await onSaveAll([...projects, newProj], datasources);
    setSelectedProjectId(newProj.id);
    setProjectName('');
    setShowProjectModal(false);
  };

  const handleDeleteProject = async (id: string) => {
    const newDs = datasources.filter(d => d.projectId !== id);
    await onSaveAll(projects.filter(p => p.id !== id), newDs);
    if (selectedProjectId === id) setSelectedProjectId(projects.find(p => p.id !== id)?.id ?? null);
  };

  // ── Datasource CRUD ──
  const handleTest = async (form: Partial<Datasource>): Promise<TestResult> => {
    try {
      const r = await GoApp.TestDatasource(
        form.host ?? '', form.port ?? 5432,
        form.database ?? '', form.username ?? '', form.password ?? '',
      );
      return { success: r.Success, message: r.Message };
    } catch (e: any) {
      return { success: false, message: String(e) };
    }
  };

  const handleSaveNew = async (ds: Datasource) => {
    await onSaveAll(projects, [...datasources, ds]);
    setFormMode(null);
  };

  const handleSaveEdit = async (ds: Datasource) => {
    await onUpdateDs(ds);
    setFormMode(null);
    setEditingDs(null);
  };

  const handleDuplicate = async (ds: Datasource) => {
    const copy: Datasource = { ...ds, id: `${Date.now()}`, name: `${ds.name} (copy)` };
    await onSaveAll(projects, [...datasources, copy]);
  };

  const handleDeleteDs = async (id: string) => {
    await onSaveAll(projects, datasources.filter(d => d.id !== id));
    if (editingDs?.id === id) { setFormMode(null); setEditingDs(null); }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: T.bg, fontFamily: T.ui, color: T.text }}>

      {/* ── Left: Projects panel ──────────────────────────────────────── */}
      <div style={{
        width: 240, flexShrink: 0,
        borderRight: `0.5px solid ${T.border}`,
        background: T.sidebar,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 14px 8px',
          display: 'flex', alignItems: 'center', gap: 8,
          borderBottom: `0.5px solid ${T.divider}`,
        }}>
          <div style={{ flex: 1, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, color: T.textDim, textTransform: 'uppercase' }}>
            Projects
          </div>
          <button
            onClick={() => setShowProjectModal(true)}
            style={{
              padding: '2px 8px',
              background: T.accent,
              color: '#fff',
              borderRadius: 4,
              fontSize: 10.5, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 3,
            }}
          >
            <Plus size={10} color="#fff" /> New
          </button>
        </div>

        {/* Project list */}
        <div style={{ flex: 1, padding: '6px', overflowY: 'auto' }}>
          {projects.map((p) => {
            const active = p.id === selectedProjectId;
            const color = projectColor(projects, p.id);
            const connCount = datasources.filter(d => d.projectId === p.id).length;
            return (
              <div
                key={p.id}
                onClick={() => { setSelectedProjectId(p.id); setFormMode(null); setEditingDs(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '7px 10px',
                  borderRadius: 6,
                  background: active ? T.selected : 'transparent',
                  borderLeft: `2px solid ${active ? T.selectedBorder : 'transparent'}`,
                  marginBottom: 2,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                className="group"
              >
                <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12.5, color: T.text,
                    fontWeight: active ? 600 : 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 10.5, color: T.textDim, fontFamily: T.mono }}>
                    {connCount} connection{connCount !== 1 ? 's' : ''}
                  </div>
                </div>
                {active && (
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteProject(p.id); }}
                    title="Delete project"
                    style={{
                      width: 18, height: 18, borderRadius: 3,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: T.hover, color: T.err,
                      border: 'none', cursor: 'pointer', padding: 0,
                    }}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            );
          })}
          {projects.length === 0 && (
            <div style={{ padding: '16px 10px', color: T.textDim, fontSize: 12, fontStyle: 'italic', textAlign: 'center' }}>
              No projects yet
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Connections ───────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {selectedProject ? (
          <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: projectColor(projects, selectedProject.id), flexShrink: 0 }} />
              <div style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.4 }}>
                {selectedProject.name}
              </div>
              <div style={{ fontSize: 12, color: T.textDim, fontFamily: T.mono }}>
                {projectDs.length} connection{projectDs.length !== 1 ? 's' : ''}
              </div>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => { setFormMode('add'); setEditingDs(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px',
                  background: T.accent, color: '#fff',
                  borderRadius: 5, fontSize: 12, fontWeight: 500,
                  border: 'none', cursor: 'pointer',
                }}
              >
                <Plus size={11} color="#fff" /> Add connection
              </button>
            </div>

            {/* Connection table */}
            {projectDs.length > 0 && (
              <div style={{
                border: `0.5px solid ${T.border}`,
                borderRadius: 8,
                background: T.panel,
                overflow: 'hidden',
              }}>
                {/* Table head */}
                <div style={{
                  display: 'flex', padding: '7px 14px',
                  background: T.chrome,
                  fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4,
                  color: T.textDim, textTransform: 'uppercase',
                  borderBottom: `0.5px solid ${T.border}`,
                }}>
                  <div style={{ width: 20 }} />
                  <div style={{ flex: 1.4 }}>Name</div>
                  <div style={{ flex: 1.6 }}>Host</div>
                  <div style={{ flex: 1.2 }}>Database</div>
                  <div style={{ width: 58 }}>Env</div>
                  <div style={{ width: 150, textAlign: 'right' }}>Actions</div>
                </div>

                {/* Rows */}
                {projectDs.map((ds, i) => {
                  const envColor = ENV_COLORS[ds.env] ?? T.textSec;
                  const isEditing = editingDs?.id === ds.id;
                  return (
                    <div
                      key={ds.id}
                      style={{
                        display: 'flex', alignItems: 'center',
                        padding: '10px 14px',
                        borderBottom: i < projectDs.length - 1 ? `0.5px solid ${T.divider}` : 'none',
                        background: isEditing ? T.selected : 'transparent',
                        borderLeft: `2px solid ${isEditing ? T.accent : 'transparent'}`,
                        fontSize: 12.5,
                      }}
                    >
                      {/* Status dot */}
                      <div style={{ width: 20 }}>
                        <div style={{ width: 7, height: 7, borderRadius: 4, background: T.textDim }} />
                      </div>

                      {/* Name */}
                      <div style={{ flex: 1.4, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ds.name}
                      </div>

                      {/* Host */}
                      <div style={{ flex: 1.6, fontFamily: T.mono, fontSize: 11.5, color: T.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ds.host}:{ds.port}
                      </div>

                      {/* Database */}
                      <div style={{ flex: 1.2, fontFamily: T.mono, fontSize: 11.5, color: T.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ds.database}
                      </div>

                      {/* Env badge */}
                      <div style={{ width: 58 }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '1px 6px', borderRadius: 3,
                          fontSize: 10, fontWeight: 700,
                          background: envColor + '22',
                          color: envColor,
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                          fontFamily: T.ui,
                        }}>
                          {ds.env}
                        </span>
                      </div>

                      {/* Actions */}
                      <div style={{ width: 150, display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                        <button
                          onClick={() => onConnect(ds.id)}
                          style={{
                            padding: '3px 8px',
                            background: T.accent,
                            color: '#fff',
                            borderRadius: 4, fontSize: 11, fontWeight: 500,
                            border: 'none', cursor: 'pointer',
                          }}
                        >
                          Connect
                        </button>
                        <button
                          onClick={() => { setEditingDs(ds); setFormMode('edit'); }}
                          title="Edit"
                          style={{ width: 22, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.panelAlt, border: `0.5px solid ${T.border}`, color: T.textSec, cursor: 'pointer' }}
                        >
                          <Settings size={12} />
                        </button>
                        <button
                          onClick={() => handleDuplicate(ds)}
                          title="Duplicate"
                          style={{ width: 22, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.panelAlt, border: `0.5px solid ${T.border}`, color: T.textSec, cursor: 'pointer' }}
                        >
                          <Plus size={11} />
                        </button>
                        <button
                          onClick={() => handleDeleteDs(ds.id)}
                          title="Delete"
                          style={{ width: 22, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.panelAlt, border: `0.5px solid ${T.border}`, color: T.err, cursor: 'pointer' }}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {projectDs.length === 0 && formMode !== 'add' && (
              <div style={{
                padding: '48px 0',
                border: `1px dashed ${T.border}`,
                borderRadius: 12,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                color: T.textDim,
              }}>
                <Database size={32} style={{ opacity: 0.2 }} />
                <div style={{ fontSize: 13, fontWeight: 500 }}>No connections yet</div>
                <button
                  onClick={() => setFormMode('add')}
                  style={{ fontSize: 12, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                >
                  Add your first connection
                </button>
              </div>
            )}

            {/* Form */}
            {formMode === 'add' && (
              <ConnectionForm
                initial={{ projectId: selectedProjectId! }}
                projectId={selectedProjectId!}
                onSave={handleSaveNew}
                onCancel={() => setFormMode(null)}
                onTest={handleTest}
              />
            )}
            {formMode === 'edit' && editingDs && (
              <ConnectionForm
                initial={editingDs}
                projectId={selectedProjectId!}
                onSave={handleSaveEdit}
                onCancel={() => { setFormMode(null); setEditingDs(null); }}
                onTest={handleTest}
              />
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textDim, fontSize: 13, fontStyle: 'italic' }}>
            Select or create a project to get started
          </div>
        )}
      </div>

      {/* ── New Project modal ─────────────────────────────────────────── */}
      {showProjectModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
        }}>
          <div style={{
            background: T.panel,
            border: `0.5px solid ${T.border}`,
            borderRadius: 12,
            padding: 28,
            width: 380,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: T.text }}>New Project</div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textDim, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>
                Project Name
              </div>
              <input
                autoFocus
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddProject()}
                placeholder="e.g. Production Cluster"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: T.panelAlt,
                  border: `0.5px solid ${T.borderStrong}`,
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 13, color: T.text,
                  fontFamily: T.ui, outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleAddProject}
                style={{
                  flex: 1, padding: '9px 0',
                  background: T.accent, color: '#fff',
                  borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                }}
              >
                Create Project
              </button>
              <button
                onClick={() => { setShowProjectModal(false); setProjectName(''); }}
                style={{
                  flex: 1, padding: '9px 0',
                  background: T.panelAlt, color: T.textSec,
                  borderRadius: 8, fontSize: 13,
                  border: `0.5px solid ${T.border}`, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
