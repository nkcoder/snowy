import { Copy, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as GoApp from '../../wailsjs/go/main/App';
import { T } from '../lib/tokens';
import type { Datasource, Project } from '../types';
import { DeleteConfirmDialog, UnsavedChangesDialog } from './ConnectionDialogs';
import { ConnectionForm, type TestResult } from './ConnectionForm';
import { ElephantIcon } from './ConnectionFormFields';
import { DatasourceListItem } from './DatasourceListItem';

// ── Types ────────────────────────────────────────────────────────────────────
type FormMode = null | 'add' | 'edit';

export interface ConnectionManagerProps {
  projects: Project[];
  datasources: Datasource[];
  activeDatasourceId?: string | null;
  onConnect: (dsId: string) => void;
  onSaveAll: (projects: Project[], datasources: Datasource[]) => Promise<void>;
  onUpdateDs: (ds: Datasource) => Promise<void>;
  startInAddMode?: boolean;
  onAddModeConsumed?: () => void;
  openEditDsId?: string | null;
  onEditModeConsumed?: () => void;
  appVersion?: string;
  appBuildDate?: string;
}

// ── ConnectionManager ────────────────────────────────────────────────────────
export function ConnectionManager({
  projects,
  datasources,
  activeDatasourceId,
  onConnect,
  onSaveAll,
  onUpdateDs,
  startInAddMode,
  onAddModeConsumed,
  openEditDsId,
  onEditModeConsumed,
  appVersion,
  appBuildDate: _appBuildDate,
}: ConnectionManagerProps) {
  const [selectedDsId, setSelectedDsId] = useState<string | null>(datasources[0]?.id ?? null);
  const [formMode, setFormMode] = useState<FormMode>(datasources.length === 0 ? 'add' : null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; message: string } | null>(null);
  const [formIsDirty, setFormIsDirty] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<{
    dsId: string | null;
    toMode: 'add' | 'edit';
  } | null>(null);
  const latestFormRef = useRef<Datasource | null>(null);

  useEffect(() => {
    if (startInAddMode) {
      setFormMode('add');
      setSelectedDsId(null);
      onAddModeConsumed?.();
    }
  }, [startInAddMode, onAddModeConsumed]);

  useEffect(() => {
    if (openEditDsId) {
      setSelectedDsId(openEditDsId);
      setFormMode('edit');
      onEditModeConsumed?.();
    }
  }, [openEditDsId, onEditModeConsumed]);

  const selectedDs = datasources.find((d) => d.id === selectedDsId) ?? null;
  const defaultProjectId = projects[0]?.id ?? 'default';

  // ── Datasource CRUD ──
  const handleTest = async (form: Partial<Datasource>): Promise<TestResult> => {
    try {
      // For an existing saved connection with a blank password field, use the
      // Keychain-backed PingDatasource — the placeholder tells the user the
      // password is stored, so Test should honour that instead of sending "".
      const isSaved = form.id && datasources.some((d) => d.id === form.id);
      if (isSaved && !form.password) {
        const r = await GoApp.PingDatasource(form.id as string);
        return { success: r.Success, message: r.Message };
      }
      const r = await GoApp.TestDatasource(
        form.host ?? '',
        form.port ?? 5432,
        form.database ?? '',
        form.username ?? '',
        form.password ?? '',
        form.sslMode ?? 'require'
      );
      return { success: r.Success, message: r.Message };
    } catch (e: unknown) {
      return { success: false, message: e instanceof Error ? e.message : String(e) };
    }
  };

  // Always enter the workspace, even if the connection is unreachable: the tree
  // renders from cached metadata and a warning surfaces there. Live connection
  // errors are reported when a query is executed.
  const handleDoubleClickConnect = (dsId: string) => {
    onConnect(dsId);
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
    await onSaveAll(
      projects,
      datasources.filter((d) => d.id !== id)
    );
    if (selectedDsId === id) {
      const remaining = datasources.filter((d) => d.id !== id);
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
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: T.bg,
        fontFamily: T.ui,
        color: T.text,
      }}
    >
      {/* ── Data sources list ────────────────────────────────────────── */}
      <div
        style={{
          width: 260,
          flexShrink: 0,
          borderRight: `0.5px solid ${T.border}`,
          background: T.sidebar,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            padding: '10px 12px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            borderBottom: `0.5px solid ${T.divider}`,
          }}
        >
          <div
            style={{
              flex: 1,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.5,
              color: T.textDim,
              textTransform: 'uppercase' as const,
            }}
          >
            Data sources
          </div>
          <button
            type="button"
            data-testid="btn-add-connection"
            title="Add"
            onClick={() => {
              if (formIsDirty) {
                setPendingSwitch({ dsId: null, toMode: 'add' });
              } else {
                setFormMode('add');
                setSelectedDsId(null);
              }
            }}
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              background: T.accent,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <Plus size={12} color="#fff" />
          </button>
          <button
            type="button"
            data-testid="btn-duplicate-selected"
            title="Duplicate"
            disabled={!selectedDs}
            onClick={() => selectedDs && handleDuplicate(selectedDs)}
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              color: selectedDs ? T.textSec : T.textDim,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              cursor: selectedDs ? 'pointer' : 'default',
              padding: 0,
            }}
          >
            <Copy size={11} />
          </button>
          <button
            type="button"
            data-testid="btn-delete-selected"
            title="Delete"
            disabled={!selectedDs}
            onClick={() =>
              selectedDs &&
              setConfirmDelete({
                id: selectedDs.id,
                message: `Delete connection "${selectedDs.name}"? This cannot be undone.`,
              })
            }
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              color: selectedDs ? T.err : T.textDim,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              cursor: selectedDs ? 'pointer' : 'default',
              padding: 0,
            }}
          >
            <X size={11} />
          </button>
        </div>

        {/* Datasource list */}
        <div style={{ flex: 1, padding: '4px', overflowY: 'auto' }}>
          {[...datasources]
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
            .map((ds) => (
              <DatasourceListItem
                key={ds.id}
                ds={ds}
                selected={ds.id === selectedDsId && formMode !== 'add'}
                isActive={ds.id === activeDatasourceId}
                onSelect={() => {
                  if (formIsDirty) {
                    setPendingSwitch({ dsId: ds.id, toMode: 'edit' });
                  } else {
                    setSelectedDsId(ds.id);
                    setFormMode('edit');
                  }
                }}
                onDoubleClick={() => handleDoubleClickConnect(ds.id)}
              />
            ))}
          {datasources.length === 0 && (
            <div
              style={{
                padding: '16px 10px',
                color: T.textDim,
                fontSize: 12,
                fontStyle: 'italic',
                textAlign: 'center',
              }}
            >
              No data sources
            </div>
          )}
        </div>

        {/* Version footer */}
        <div
          style={{
            padding: '8px 10px',
            borderTop: `0.5px solid ${T.divider}`,
            display: 'flex',
            alignItems: 'baseline',
            gap: 5,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: T.textDim, letterSpacing: -0.2 }}>
            Snowy
          </span>
          {appVersion && (
            <span style={{ fontSize: 10, color: T.textDim, fontFamily: T.mono, opacity: 0.7 }}>
              {appVersion}
            </span>
          )}
        </div>
      </div>

      {/* ── Form / detail panel ──────────────────────────────────────── */}
      {showForm && formMode === 'add' && (
        <ConnectionForm
          key="add"
          initial={{ projectId: defaultProjectId }}
          projectId={defaultProjectId}
          onSave={handleSaveNew}
          onApply={handleApplyNew}
          onCancel={() => setFormMode(datasources.length > 0 ? 'edit' : null)}
          onTest={handleTest}
          onDirtyChange={setFormIsDirty}
          onFormChange={(ds) => {
            latestFormRef.current = ds;
          }}
        />
      )}
      {showForm && formMode === 'edit' && selectedDs && (
        <ConnectionForm
          key={selectedDs.id}
          initial={selectedDs}
          projectId={selectedDs.projectId}
          onSave={handleSaveEdit}
          onApply={handleApplyEdit}
          onCancel={() => setFormMode(null)}
          onTest={handleTest}
          onDirtyChange={setFormIsDirty}
          onFormChange={(ds) => {
            latestFormRef.current = ds;
          }}
        />
      )}
      {!showForm && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: T.textDim,
          }}
        >
          <ElephantIcon color={T.textDim} size={40} />
          <div style={{ fontSize: 13, fontWeight: 500 }}>Select a data source to configure</div>
          <button
            type="button"
            onClick={() => {
              if (formIsDirty) {
                setPendingSwitch({ dsId: null, toMode: 'add' });
              } else {
                setFormMode('add');
              }
            }}
            style={{
              fontSize: 12,
              color: T.accent,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Add new connection
          </button>
        </div>
      )}

      {/* ── Confirm delete ─────────────────────────────────────────────── */}
      {confirmDelete && (
        <DeleteConfirmDialog
          message={confirmDelete.message}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* ── Unsaved changes ────────────────────────────────────────────── */}
      {pendingSwitch && (
        <UnsavedChangesDialog
          onDiscard={() => {
            const p = pendingSwitch;
            setPendingSwitch(null);
            if (p.dsId !== null) {
              setSelectedDsId(p.dsId);
              setFormMode('edit');
            } else {
              setFormMode('add');
              setSelectedDsId(null);
            }
          }}
          onCancel={() => setPendingSwitch(null)}
          onSave={async () => {
            const ds = latestFormRef.current;
            if (!ds) return;
            if (formMode === 'edit') {
              await handleApplyEdit(ds);
            } else if (formMode === 'add') {
              await onSaveAll(projects, [
                ...datasources,
                { ...ds, projectId: ds.projectId || defaultProjectId },
              ]);
            }
            const p = pendingSwitch;
            setPendingSwitch(null);
            if (p.dsId !== null) {
              setSelectedDsId(p.dsId);
              setFormMode('edit');
            } else {
              setFormMode('add');
              setSelectedDsId(null);
            }
          }}
        />
      )}
    </div>
  );
}
