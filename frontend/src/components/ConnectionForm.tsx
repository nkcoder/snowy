import { Loader, Wifi } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type ConnectionFormState, getConnectionFormValidity } from '../lib/connectionForm';
import { T } from '../lib/tokens';
import type { Datasource } from '../types';
import { FormRow, SelectInput } from './ConnectionFormFields';
import { ConnectionGeneralTab } from './ConnectionGeneralTab';

export interface TestResult {
  success: boolean;
  message: string;
}

export function ConnectionForm({
  initial,
  projectId,
  onSave,
  onCancel,
  onApply,
  onTest,
  onDirtyChange,
  onFormChange,
}: {
  initial: Partial<Datasource>;
  projectId: string;
  onSave: (ds: Datasource) => Promise<void>;
  onCancel: () => void;
  onApply?: (ds: Datasource) => Promise<void>;
  onTest: (ds: Partial<Datasource>) => Promise<TestResult>;
  onDirtyChange?: (dirty: boolean) => void;
  onFormChange?: (ds: Datasource) => void;
}) {
  const initialForm: ConnectionFormState = {
    name: initial.name ?? '',
    host: initial.host ?? 'localhost',
    port: initial.port ?? 5432,
    database: initial.database ?? '',
    username: initial.username ?? '',
    password: initial.password ?? '',
    env: initial.env ?? 'local',
    sslMode: initial.sslMode ?? 'require',
  };
  const [form, setForm] = useState<ConnectionFormState>(initialForm);
  const [showPass, setShowPass] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stableId = useRef(initial.id ?? `${Date.now()}`);
  const [cleanValues, setCleanValues] = useState<ConnectionFormState>(initialForm);

  const isDirty = useMemo(
    () =>
      (Object.keys(cleanValues) as Array<keyof typeof cleanValues>).some(
        (k) => form[k] !== cleanValues[k]
      ),
    [form, cleanValues]
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onFormChange?.({ id: stableId.current, projectId, ...form });
  }, [form, onFormChange, projectId]);

  useEffect(
    () => () => {
      onDirtyChange?.(false);
    },
    [onDirtyChange]
  );

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const buildDs = (): Datasource => ({
    id: stableId.current,
    projectId,
    ...form,
  });

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const r = await onTest(buildDs());
    setTestResult(r);
    setTesting(false);
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await onSave(buildDs());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    setError(null);
    setSaving(true);
    try {
      await onApply?.(buildDs());
      setCleanValues({ ...form });
      onDirtyChange?.(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const tabs = ['General', 'Options', 'SSL'];
  const validity = getConnectionFormValidity(form);
  const canSave = !saving && validity.canSave;
  const isNew = !initial.id;
  const canApplyOrCancel = isNew || isDirty;

  return (
    <div
      data-testid="connection-form"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        background: isNew ? `color-mix(in srgb, ${T.panel} 92%, var(--t-accent))` : T.panel,
        overflow: 'hidden',
        borderTop: isNew ? `2px solid ${T.accent}` : `2px solid transparent`,
      }}
    >
      {/* New / Edit header strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 24px',
          gap: 8,
          borderBottom: `0.5px solid ${T.divider}`,
          background: isNew ? `color-mix(in srgb, ${T.panel} 80%, var(--t-accent))` : T.panelAlt,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: isNew ? 700 : 400,
            letterSpacing: isNew ? 0.6 : 0.2,
            textTransform: isNew ? ('uppercase' as const) : ('none' as const),
            color: isNew ? T.accent : T.textSec,
          }}
        >
          {isNew ? 'New Data Source' : form.name || 'Untitled'}
        </span>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          padding: '0 24px',
          borderBottom: `0.5px solid ${T.divider}`,
          background: 'transparent',
          flexShrink: 0,
        }}
      >
        {tabs.map((tab, i) => (
          <div
            key={tab}
            role="tab"
            aria-selected={i === activeTab}
            tabIndex={0}
            onClick={() => setActiveTab(i)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab(i)}
            style={{
              padding: '10px 14px',
              fontSize: 12,
              color: i === activeTab ? T.text : T.textSec,
              fontWeight: i === activeTab ? 600 : 400,
              borderBottom: i === activeTab ? `2px solid ${T.accent}` : '2px solid transparent',
              marginBottom: -0.5,
              cursor: 'pointer',
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* General tab — DataGrip row layout */}
      {activeTab === 0 && (
        <ConnectionGeneralTab
          form={form}
          set={set}
          showPass={showPass}
          onToggleShowPass={() => setShowPass((s) => !s)}
          isEdit={!!initial.id}
        />
      )}

      {/* Options tab */}
      {activeTab === 1 && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: T.textDim,
            fontSize: 12,
            fontStyle: 'italic',
          }}
        >
          Not yet implemented
        </div>
      )}

      {/* SSL tab */}
      {activeTab === 2 && (
        <div
          style={{
            flex: 1,
            paddingTop: 16,
            paddingBottom: 16,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <FormRow label="SSL mode">
            <SelectInput
              value={form.sslMode}
              onChange={(v) => set('sslMode', v)}
              data-testid="field-ssl"
              options={[
                { value: 'disable', label: 'Disable' },
                { value: 'require', label: 'Require' },
                { value: 'verify-ca', label: 'Verify CA' },
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
            background: `${testResult.success ? T.ok : T.err}18`,
            border: `0.5px solid ${testResult.success ? T.ok : T.err}55`,
            borderRadius: 5,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11.5,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              background: testResult.success ? T.ok : T.err,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 9,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
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
        <div
          data-testid="save-error"
          style={{
            margin: '0 24px 10px',
            padding: '6px 10px',
            background: `${T.err}18`,
            border: `0.5px solid ${T.err}55`,
            borderRadius: 5,
            fontSize: 11.5,
            color: T.err,
          }}
        >
          {error}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          padding: '10px 24px',
          borderTop: `0.5px solid ${T.divider}`,
          background: T.chrome,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button
          type="button"
          data-testid="btn-test"
          onClick={handleTest}
          disabled={testing || !validity.canTest}
          style={{
            padding: '5px 12px',
            background: T.panelAlt,
            border: `0.5px solid ${T.border}`,
            borderRadius: 4,
            fontSize: 12,
            color: T.text,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            opacity: testing ? 0.6 : 1,
          }}
        >
          {testing ? (
            <Loader size={11} className="animate-spin" />
          ) : (
            <Wifi size={11} color={testResult?.success ? T.ok : T.textSec} />
          )}
          Test Connection
        </button>
        <span style={{ fontSize: 11, color: T.textDim }}>PostgreSQL</span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          data-testid="btn-cancel"
          onClick={onCancel}
          disabled={!canApplyOrCancel}
          style={{
            padding: '5px 12px',
            border: `0.5px solid ${T.border}`,
            borderRadius: 4,
            fontSize: 12,
            color: canApplyOrCancel ? T.textSec : T.textDim,
            background: 'none',
            cursor: canApplyOrCancel ? 'pointer' : 'not-allowed',
            opacity: canApplyOrCancel ? 1 : 0.4,
          }}
        >
          Cancel
        </button>
        {onApply && (
          <button
            type="button"
            data-testid="btn-apply"
            onClick={handleApply}
            disabled={!canSave || !canApplyOrCancel}
            style={{
              padding: '5px 14px',
              background: T.panelAlt,
              color: canSave && canApplyOrCancel ? T.text : T.textDim,
              border: `0.5px solid ${T.border}`,
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              cursor: canSave && canApplyOrCancel ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            {saving && <Loader size={11} className="animate-spin" />}
            Apply
          </button>
        )}
        <button
          type="button"
          data-testid="btn-save"
          onClick={handleSave}
          disabled={!canSave}
          style={{
            padding: '5px 16px',
            background: T.accent,
            color: '#fff',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            border: 'none',
            cursor: canSave ? 'pointer' : 'not-allowed',
            opacity: canSave ? 1 : 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          {saving && <Loader size={11} className="animate-spin" />}
          OK
        </button>
      </div>
    </div>
  );
}
