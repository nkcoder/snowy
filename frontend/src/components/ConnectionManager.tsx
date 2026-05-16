import { useState, useEffect } from 'react';
import { Plus, Wifi, Eye, EyeOff, Loader, Copy, X, ChevronDown } from 'lucide-react';
import * as GoApp from '../../wailsjs/go/main/App';
import { T, ENV_COLORS } from '../lib/tokens';
import type { Project, Datasource } from '../types';

// ── Types ────────────────────────────────────────────────────────────────────
type FormMode = null | 'add' | 'edit';

interface TestResult {
  success: boolean;
  message: string;
}

export interface ConnectionManagerProps {
  projects: Project[];
  datasources: Datasource[];
  activeDatasourceId?: string | null;
  onConnect: (dsId: string) => void;
  onSaveAll: (projects: Project[], datasources: Datasource[]) => Promise<void>;
  onUpdateDs: (ds: Datasource) => Promise<void>;
  startInAddMode?: boolean;
  onAddModeConsumed?: () => void;
  appVersion?: string;
  appBuildDate?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export function makeEmptyForm(): Omit<Datasource, 'id' | 'projectId'> {
  return {
    name: '',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    env: 'local',
    sslMode: 'require',
  };
}

// ── Sub-components ───────────────────────────────────────────────────────────
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.3, color: T.textDim, textTransform: 'uppercase' as const, marginBottom: 5 }}>
      {children}
    </div>
  );
}

export function FieldInput({
  value, onChange, type = 'text', mono = false, readOnly = false,
  placeholder, 'data-testid': testId,
}: {
  value: string | number;
  onChange?: (v: string) => void;
  type?: string;
  mono?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  'data-testid'?: string;
}) {
  return (
    <input
      type={type}
      readOnly={readOnly}
      value={value}
      placeholder={placeholder}
      data-testid={testId}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      onChange={e => onChange?.(e.target.value)}
      style={{
        background: T.panelAlt,
        border: `0.5px solid ${T.border}`,
        borderRadius: 4,
        padding: '7px 10px',
        fontSize: 12,
        color: readOnly ? T.textSec : T.text,
        fontFamily: mono ? T.mono : T.ui,
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box' as const,
      }}
      onFocus={e => { if (!readOnly) e.target.style.borderColor = T.accent; }}
      onBlur={e => { e.target.style.borderColor = T.border; }}
    />
  );
}

export function SelectInput({
  value, onChange, options, 'data-testid': testId,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  'data-testid'?: string;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        data-testid={testId}
        style={{
          background: T.panelAlt,
          border: `0.5px solid ${T.border}`,
          borderRadius: 4,
          padding: '7px 28px 7px 10px',
          fontSize: 12,
          color: T.text,
          fontFamily: T.ui,
          outline: 'none',
          width: '100%',
          appearance: 'none' as const,
          cursor: 'pointer',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.textDim, display: 'flex', alignItems: 'center' }}>
        <ChevronDown size={11} />
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: T.accent, textTransform: 'uppercase' as const }}>{children}</div>
      <div style={{ flex: 1, height: 1, background: T.divider }} />
    </div>
  );
}

function ElephantIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M3.5 7.5c0-2.5 2-4.2 4.6-4.2 2.7 0 4.6 1.7 4.6 4 0 1.8-1 3-1 3.8l.6 1.6h-1.7l-.5-1.2c-.4.3-1 .4-1.6.4l.3 1.2H7.2l-.5-1.4c-1.1-.2-1.9-.6-2.4-1.1-.3.4-.7.6-1.1.6"
        stroke={color}
        strokeWidth="1.2"
        fill={color + '22'}
      />
    </svg>
  );
}

// ── Confirm delete dialog ────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      data-testid="confirm-dialog"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div style={{
        background: T.panel,
        border: `0.5px solid ${T.borderStrong}`,
        borderRadius: 10,
        padding: '24px 28px',
        width: 360,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 14, color: T.text, marginBottom: 20, lineHeight: 1.5 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            data-testid="confirm-cancel"
            onClick={onCancel}
            style={{ padding: '5px 14px', background: T.panelAlt, color: T.textSec, border: `0.5px solid ${T.border}`, borderRadius: 5, fontSize: 12, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            data-testid="confirm-ok"
            onClick={onConfirm}
            style={{ padding: '5px 14px', background: T.err, color: '#fff', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FormRow — DataGrip-style label:value row ─────────────────────────────────
function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '4px 24px', gap: 0 }}>
      <div style={{ width: 136, flexShrink: 0, fontSize: 12, color: T.textSec, textAlign: 'right', paddingRight: 14 }}>
        {label}:
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

// ── Connection form ──────────────────────────────────────────────────────────
export function ConnectionForm({
  initial, projectId, onSave, onCancel, onApply, onTest,
}: {
  initial: Partial<Datasource>;
  projectId: string;
  onSave: (ds: Datasource) => Promise<void>;
  onCancel: () => void;
  onApply?: (ds: Datasource) => Promise<void>;
  onTest: (ds: Partial<Datasource>) => Promise<TestResult>;
}) {
  const [form, setForm] = useState<Omit<Datasource, 'id' | 'projectId'>>({
    ...makeEmptyForm(),
    name:     initial.name     ?? '',
    host:     initial.host     ?? 'localhost',
    port:     initial.port     ?? 5432,
    database: initial.database ?? '',
    username: initial.username ?? '',
    password: initial.password ?? '',
    env:      initial.env      ?? 'local',
    sslMode:  initial.sslMode  ?? 'require',
  });
  const [showPass, setShowPass] = useState(false);
  const [saveMode, setSaveMode] = useState<'forever' | 'until_restart' | 'never'>(
    initial.password ? 'forever' : 'never'
  );
  const [activeTab, setActiveTab] = useState(0);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const derivedUrl = `postgres://${form.username}@${form.host}:${form.port}/${form.database}?sslmode=${form.sslMode}`;

  const buildDs = (): Datasource => ({
    id: initial.id ?? `${Date.now()}`,
    projectId,
    ...form,
    password: saveMode === 'forever' ? form.password : '',
  });

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const r = await onTest(form);
    setTestResult(r);
    setTesting(false);
  };

  const handleSave = async () => {
    setError(null); setSaving(true);
    try { await onSave(buildDs()); }
    catch (e: any) { setError(String(e)); }
    finally { setSaving(false); }
  };

  const handleApply = async () => {
    setError(null); setSaving(true);
    try { await onApply?.(buildDs()); }
    catch (e: any) { setError(String(e)); }
    finally { setSaving(false); }
  };

  const tabs = ['General', 'Options', 'SSL'];
  const canSave = !saving && !!form.name && !!form.host && !!form.database;
  const isNew = !initial.id;

  return (
    <div data-testid="connection-form" style={{
      flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
      background: T.panel, overflow: 'hidden',
      borderLeft: isNew ? `3px solid ${T.accent}` : 'none',
    }}>
      {/* Tabs */}
      <div style={{ display: 'flex', padding: '0 24px', borderBottom: `0.5px solid ${T.divider}`, background: T.panel, flexShrink: 0 }}>
        {tabs.map((tab, i) => (
          <div
            key={tab}
            role="tab"
            aria-selected={i === activeTab}
            onClick={() => setActiveTab(i)}
            style={{
              padding: '10px 14px', fontSize: 12,
              color: i === activeTab ? T.text : T.textSec,
              fontWeight: i === activeTab ? 600 : 400,
              borderBottom: i === activeTab ? `2px solid ${T.accent}` : '2px solid transparent',
              marginBottom: -0.5, cursor: 'pointer',
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* General tab — DataGrip row layout */}
      {activeTab === 0 && (
        <div style={{ flex: 1, paddingTop: 16, paddingBottom: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>

          {/* Name + Environment */}
          <FormRow label="Name">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <FieldInput value={form.name} onChange={v => set('name', v)} placeholder="e.g. postgres@localhost" data-testid="field-name" />
              </div>
              {isNew && (
                <div style={{ padding: '1px 7px', borderRadius: 3, fontSize: 10, fontWeight: 700, background: T.accent + '33', color: T.accent, letterSpacing: 0.4, textTransform: 'uppercase' as const, border: `0.5px solid ${T.accent}55`, flexShrink: 0 }}>
                  Unsaved
                </div>
              )}
              <span style={{ fontSize: 11, color: T.textSec, flexShrink: 0 }}>Environment:</span>
              <div style={{ width: 130, flexShrink: 0 }}>
                <SelectInput
                  value={form.env}
                  onChange={v => set('env', v)}
                  data-testid="field-env"
                  options={[
                    { value: 'local', label: 'Local' },
                    { value: 'dev',   label: 'Development' },
                    { value: 'stg',   label: 'Staging' },
                    { value: 'prod',  label: 'Production' },
                  ]}
                />
              </div>
            </div>
          </FormRow>

          {/* Driver */}
          <FormRow label="Driver">
            <SelectInput value="postgresql" onChange={() => {}} options={[{ value: 'postgresql', label: 'PostgreSQL' }]} />
          </FormRow>

          {/* Host + Port */}
          <FormRow label="Host">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <FieldInput value={form.host} onChange={v => set('host', v)} mono placeholder="localhost" data-testid="field-host" />
              </div>
              <span style={{ fontSize: 11, color: T.textSec, flexShrink: 0 }}>Port:</span>
              <div style={{ width: 80, flexShrink: 0 }}>
                <FieldInput value={form.port} onChange={v => set('port', Number(v))} mono type="number" data-testid="field-port" />
              </div>
            </div>
          </FormRow>

          {/* Authentication */}
          <FormRow label="Authentication">
            <SelectInput value="password" onChange={() => {}} options={[{ value: 'password', label: 'User & Password' }]} />
          </FormRow>

          {/* User */}
          <FormRow label="User">
            <FieldInput value={form.username} onChange={v => set('username', v)} mono placeholder="postgres" data-testid="field-username" />
          </FormRow>

          {/* Password + Save dropdown */}
          <FormRow label="Password">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  data-testid="field-password"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  onChange={e => set('password', e.target.value)}
                  placeholder="<hidden>"
                  style={{
                    background: T.panelAlt, border: `0.5px solid ${T.border}`, borderRadius: 4,
                    padding: '7px 30px 7px 10px', fontSize: 12, color: T.text, fontFamily: T.mono,
                    outline: 'none', width: '100%', boxSizing: 'border-box' as const,
                  }}
                />
                <button
                  data-testid="toggle-password"
                  onClick={() => setShowPass(s => !s)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.textDim, padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <span style={{ fontSize: 11, color: T.textSec, flexShrink: 0 }}>Save:</span>
              <div style={{ width: 120, flexShrink: 0 }}>
                <SelectInput
                  value={saveMode}
                  onChange={v => setSaveMode(v as typeof saveMode)}
                  options={[
                    { value: 'forever',       label: 'Forever' },
                    { value: 'until_restart', label: 'Until restart' },
                    { value: 'never',         label: 'Never' },
                  ]}
                />
              </div>
            </div>
          </FormRow>

          {/* Database */}
          <FormRow label="Database">
            <FieldInput value={form.database} onChange={v => set('database', v)} mono placeholder="postgres" data-testid="field-database" />
          </FormRow>

          {/* URL (read-only) */}
          <FormRow label="URL">
            <div>
              <div style={{ padding: '7px 10px', background: T.panelAlt, border: `0.5px solid ${T.border}`, borderRadius: 4, fontFamily: T.mono, fontSize: 11.5, color: T.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {derivedUrl}
              </div>
              <div style={{ fontSize: 10.5, color: T.textDim, fontStyle: 'italic', marginTop: 3 }}>
                Overrides settings above
              </div>
            </div>
          </FormRow>
        </div>
      )}

      {/* Options tab */}
      {activeTab === 1 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textDim, fontSize: 12, fontStyle: 'italic' }}>
          Not yet implemented
        </div>
      )}

      {/* SSL tab */}
      {activeTab === 2 && (
        <div style={{ flex: 1, paddingTop: 16, paddingBottom: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <FormRow label="SSL mode">
            <SelectInput
              value={form.sslMode}
              onChange={v => set('sslMode', v)}
              data-testid="field-ssl"
              options={[
                { value: 'disable',     label: 'Disable' },
                { value: 'require',     label: 'Require' },
                { value: 'verify-ca',   label: 'Verify CA' },
                { value: 'verify-full', label: 'Verify Full' },
              ]}
            />
          </FormRow>
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div
          data-testid="test-result"
          style={{
            margin: '0 24px 10px',
            padding: '7px 10px',
            background: (testResult.success ? T.ok : T.err) + '18',
            border: `0.5px solid ${(testResult.success ? T.ok : T.err)}55`,
            borderRadius: 5, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5,
          }}
        >
          <div style={{ width: 16, height: 16, borderRadius: 8, background: testResult.success ? T.ok : T.err, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
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

      {error && (
        <div data-testid="save-error" style={{ margin: '0 24px 10px', padding: '6px 10px', background: T.err + '18', border: `0.5px solid ${T.err}55`, borderRadius: 5, fontSize: 11.5, color: T.err }}>
          {error}
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '10px 24px', borderTop: `0.5px solid ${T.divider}`, background: T.chrome, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          data-testid="btn-test"
          onClick={handleTest}
          disabled={testing || !form.host || !form.database}
          style={{ padding: '5px 12px', background: T.panelAlt, border: `0.5px solid ${T.border}`, borderRadius: 4, fontSize: 12, color: T.text, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, opacity: testing ? 0.6 : 1 }}
        >
          {testing ? <Loader size={11} className="animate-spin" /> : <Wifi size={11} color={testResult?.success ? T.ok : T.textSec} />}
          Test Connection
        </button>
        <span style={{ fontSize: 11, color: T.textDim }}>PostgreSQL</span>
        <div style={{ flex: 1 }} />
        <button
          data-testid="btn-cancel"
          onClick={onCancel}
          style={{ padding: '5px 12px', border: `0.5px solid ${T.border}`, borderRadius: 4, fontSize: 12, color: T.textSec, background: 'none', cursor: 'pointer' }}
        >
          Cancel
        </button>
        {onApply && (
          <button
            data-testid="btn-apply"
            onClick={handleApply}
            disabled={!canSave}
            style={{ padding: '5px 14px', background: T.panelAlt, color: canSave ? T.text : T.textDim, border: `0.5px solid ${T.border}`, borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: canSave ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            {saving && <Loader size={11} className="animate-spin" />}
            Apply
          </button>
        )}
        <button
          data-testid="btn-save"
          onClick={handleSave}
          disabled={!canSave}
          style={{ padding: '5px 16px', background: T.accent, color: '#fff', borderRadius: 4, fontSize: 12, fontWeight: 600, border: 'none', cursor: canSave ? 'pointer' : 'not-allowed', opacity: canSave ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 5 }}
        >
          {saving && <Loader size={11} className="animate-spin" />}
          OK
        </button>
      </div>
    </div>
  );
}

// ── ConnectionManager ────────────────────────────────────────────────────────
export function ConnectionManager({ projects, datasources, activeDatasourceId, onConnect, onSaveAll, onUpdateDs, startInAddMode, onAddModeConsumed, appVersion, appBuildDate }: ConnectionManagerProps) {
  const [selectedDsId, setSelectedDsId] = useState<string | null>(datasources[0]?.id ?? null);
  const [formMode, setFormMode] = useState<FormMode>(datasources.length === 0 ? 'add' : null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    if (startInAddMode) {
      setFormMode('add');
      setSelectedDsId(null);
      onAddModeConsumed?.();
    }
  }, [startInAddMode]);

  const selectedDs = datasources.find(d => d.id === selectedDsId) ?? null;
  const defaultProjectId = projects[0]?.id ?? 'default';

  // ── Datasource CRUD ──
  const handleTest = async (form: Partial<Datasource>): Promise<TestResult> => {
    try {
      const r = await GoApp.TestDatasource(
        form.host ?? '', form.port ?? 5432,
        form.database ?? '', form.username ?? '', form.password ?? '',
        form.sslMode ?? 'disable',
      );
      return { success: r.Success, message: r.Message };
    } catch (e: any) {
      return { success: false, message: String(e) };
    }
  };

  const handleSaveNew = async (ds: Datasource) => {
    const withProject = { ...ds, projectId: ds.projectId || defaultProjectId };
    await onSaveAll(projects, [...datasources, withProject]);
    setSelectedDsId(ds.id);
    setFormMode(null);
    onConnect(ds.id);
  };

  const handleApplyNew = async (ds: Datasource) => {
    const withProject = { ...ds, projectId: ds.projectId || defaultProjectId };
    await onSaveAll(projects, [...datasources, withProject]);
    setSelectedDsId(ds.id);
    setFormMode('edit');
  };

  const handleSaveEdit = async (ds: Datasource) => {
    await onUpdateDs(ds);
    setFormMode(null);
    onConnect(ds.id);
  };

  const handleApplyEdit = async (ds: Datasource) => {
    await onUpdateDs(ds);
  };

  const handleDuplicate = async (ds: Datasource) => {
    const copy: Datasource = { ...ds, id: `${Date.now()}`, name: `${ds.name} (copy)` };
    await onSaveAll(projects, [...datasources, copy]);
  };

  const handleDeleteDs = async (id: string) => {
    await onSaveAll(projects, datasources.filter(d => d.id !== id));
    if (selectedDsId === id) {
      const remaining = datasources.filter(d => d.id !== id);
      setSelectedDsId(remaining[0]?.id ?? null);
      setFormMode(remaining.length === 0 ? 'add' : null);
    }
  };

  const handleConfirm = async () => {
    if (!confirmDelete) return;
    await handleDeleteDs(confirmDelete.id);
    setConfirmDelete(null);
  };

  const showForm = formMode === 'add' || (formMode === 'edit' && selectedDs);

  return (
    <div style={{ display: 'flex', height: '100vh', background: T.bg, fontFamily: T.ui, color: T.text }}>

      {/* ── Data sources list ────────────────────────────────────────── */}
      <div style={{ width: 260, flexShrink: 0, borderRight: `0.5px solid ${T.border}`, background: T.sidebar, display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <div style={{ padding: '10px 12px 6px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: `0.5px solid ${T.divider}` }}>
          <div style={{ flex: 1, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, color: T.textDim, textTransform: 'uppercase' as const }}>
            Data sources
          </div>
          <button
            data-testid="btn-add-connection"
            title="Add"
            onClick={() => { setFormMode('add'); setSelectedDsId(null); }}
            style={{ width: 22, height: 22, borderRadius: 4, background: T.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <Plus size={12} color="#fff" />
          </button>
          <button
            data-testid="btn-duplicate-selected"
            title="Duplicate"
            disabled={!selectedDs}
            onClick={() => selectedDs && handleDuplicate(selectedDs)}
            style={{ width: 22, height: 22, borderRadius: 4, color: selectedDs ? T.textSec : T.textDim, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: selectedDs ? 'pointer' : 'default', padding: 0 }}
          >
            <Copy size={11} />
          </button>
          <button
            data-testid="btn-delete-selected"
            title="Delete"
            disabled={!selectedDs}
            onClick={() => selectedDs && setConfirmDelete({ id: selectedDs.id, message: `Delete connection "${selectedDs.name}"? This cannot be undone.` })}
            style={{ width: 22, height: 22, borderRadius: 4, color: selectedDs ? T.err : T.textDim, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: selectedDs ? 'pointer' : 'default', padding: 0 }}
          >
            <X size={11} />
          </button>
        </div>

        {/* Datasource list */}
        <div style={{ flex: 1, padding: '4px', overflowY: 'auto' }}>
          {datasources.map(ds => {
            const envColor = ENV_COLORS[ds.env] ?? T.textSec;
            const selected = ds.id === selectedDsId && formMode !== 'add';
            return (
              <div
                key={ds.id}
                data-testid={`ds-item-${ds.id}`}
                onClick={() => { setSelectedDsId(ds.id); setFormMode('edit'); }}
                onDoubleClick={() => onConnect(ds.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                  background: selected ? T.selected : 'transparent',
                  borderLeft: `2px solid ${selected ? T.selectedBorder : 'transparent'}`,
                  borderRadius: 4, marginBottom: 1, cursor: 'pointer', userSelect: 'none' as const,
                }}
              >
                <ElephantIcon color={envColor} size={14} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: selected ? 600 : 500, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ds.name}
                  </div>
                  <div style={{ fontSize: 10.5, color: T.textDim, fontFamily: T.mono }}>
                    {ds.host}
                  </div>
                </div>
                <div style={{
                  width: 6, height: 6, borderRadius: 3, flexShrink: 0,
                  background: ds.id === activeDatasourceId ? T.ok : T.textDim,
                  boxShadow: ds.id === activeDatasourceId ? `0 0 4px ${T.ok}` : 'none',
                }} />
              </div>
            );
          })}
          {datasources.length === 0 && (
            <div style={{ padding: '16px 10px', color: T.textDim, fontSize: 12, fontStyle: 'italic', textAlign: 'center' }}>
              No data sources
            </div>
          )}
        </div>

        {/* Version footer */}
        <div style={{ padding: '8px 10px', borderTop: `0.5px solid ${T.divider}`, display: 'flex', alignItems: 'baseline', gap: 5, flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.textDim, letterSpacing: -0.2 }}>Snowy</span>
          {appVersion && (
            <span style={{ fontSize: 10, color: T.textDim, fontFamily: T.mono, opacity: 0.7 }}>v{appVersion}</span>
          )}
        </div>
      </div>

      {/* ── Form / detail panel ──────────────────────────────────────── */}
      {showForm && formMode === 'add' && (
        <ConnectionForm
          initial={{ projectId: defaultProjectId }}
          projectId={defaultProjectId}
          onSave={handleSaveNew}
          onApply={handleApplyNew}
          onCancel={() => setFormMode(datasources.length > 0 ? 'edit' : null)}
          onTest={handleTest}
        />
      )}
      {showForm && formMode === 'edit' && selectedDs && (
        <ConnectionForm
          initial={selectedDs}
          projectId={selectedDs.projectId}
          onSave={handleSaveEdit}
          onApply={handleApplyEdit}
          onCancel={() => setFormMode(null)}
          onTest={handleTest}
        />
      )}
      {!showForm && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: T.textDim }}>
          <ElephantIcon color={T.textDim} size={40} />
          <div style={{ fontSize: 13, fontWeight: 500 }}>Select a data source to configure</div>
          <button
            onClick={() => setFormMode('add')}
            style={{ fontSize: 12, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
          >
            Add new connection
          </button>
        </div>
      )}

      {/* ── Confirm delete ─────────────────────────────────────────────── */}
      {confirmDelete && (
        <ConfirmDialog
          message={confirmDelete.message}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
