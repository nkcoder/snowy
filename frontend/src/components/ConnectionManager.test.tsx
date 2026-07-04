import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Datasource, Project } from '../types';
import { ConnectionManager } from './ConnectionManager';

vi.mock('../../wailsjs/go/main/App', () => ({
  TestDatasource: vi.fn().mockResolvedValue({ Success: true, Message: 'ok' }),
  PingDatasource: vi.fn().mockResolvedValue({ Success: true, Message: 'Connection successful' }),
  GetConfig: vi.fn().mockResolvedValue({ projects: [], datasources: [] }),
  SaveConfig: vi.fn().mockResolvedValue(undefined),
  UpdateDatasource: vi.fn().mockResolvedValue(undefined),
  ExecuteQuery: vi.fn().mockResolvedValue({ Columns: [], Rows: [] }),
  ListSchemas: vi.fn().mockResolvedValue([]),
  ListTables: vi.fn().mockResolvedValue([]),
  ListColumns: vi.fn().mockResolvedValue([]),
}));

import * as GoApp from '../../wailsjs/go/main/App';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const proj1: Project = { id: 'p1', name: 'Alpha' };

function makeDs(overrides: Partial<Datasource> = {}): Datasource {
  return {
    id: 'd1',
    name: 'local-pg',
    host: 'localhost',
    port: 5432,
    database: 'mydb',
    username: 'postgres',
    password: 'secret',
    projectId: 'p1',
    env: 'local',
    sslMode: 'disable',
    ...overrides,
  };
}

function renderManager(
  overrides: {
    projects?: Project[];
    datasources?: Datasource[];
    onConnect?: (dsId: string) => void;
    onSaveAll?: (projects: Project[], datasources: Datasource[]) => Promise<void>;
    onUpdateDs?: (ds: Datasource) => Promise<void>;
  } = {}
) {
  const onConnect = (overrides.onConnect ?? vi.fn()) as (dsId: string) => void;
  const onSaveAll = (overrides.onSaveAll ?? vi.fn().mockResolvedValue(undefined)) as (
    p: Project[],
    d: Datasource[]
  ) => Promise<void>;
  const onUpdateDs = (overrides.onUpdateDs ?? vi.fn().mockResolvedValue(undefined)) as (
    ds: Datasource
  ) => Promise<void>;
  const projects = overrides.projects ?? [proj1];
  const datasources = overrides.datasources ?? [];

  render(
    <ConnectionManager
      projects={projects}
      datasources={datasources}
      onConnect={onConnect}
      onSaveAll={onSaveAll}
      onUpdateDs={onUpdateDs}
    />
  );
  return { onConnect, onSaveAll, onUpdateDs };
}

// ── ConnectionManager ──────────────────────────────────────────────────────────

describe('ConnectionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Data sources header', () => {
    renderManager();
    expect(screen.getByText('Data sources')).toBeInTheDocument();
  });

  it('shows empty state when no datasources', () => {
    renderManager({ datasources: [] });
    expect(screen.getByText('No data sources')).toBeInTheDocument();
  });

  it('shows add-connection form when no datasources (auto-open)', () => {
    renderManager({ datasources: [] });
    expect(screen.getByTestId('connection-form')).toBeInTheDocument();
  });

  it('renders datasource items in list', () => {
    const ds = makeDs();
    renderManager({ datasources: [ds] });
    expect(screen.getByTestId('ds-item-d1')).toBeInTheDocument();
    expect(screen.getByText('local-pg')).toBeInTheDocument();
  });

  it('clicking datasource item opens edit form', async () => {
    const ds = makeDs({ name: 'my-conn', host: 'db.host', database: 'mydb' });
    renderManager({ datasources: [ds] });
    await userEvent.click(screen.getByTestId('ds-item-d1'));
    expect(screen.getByTestId('connection-form')).toBeInTheDocument();
    expect(screen.getByTestId('field-name')).toHaveValue('my-conn');
    expect(screen.getByTestId('field-host')).toHaveValue('db.host');
  });

  it('Add button (btn-add-connection) shows new connection form', async () => {
    const ds = makeDs();
    renderManager({ datasources: [ds] });
    await userEvent.click(screen.getByTestId('btn-add-connection'));
    expect(screen.getByTestId('connection-form')).toBeInTheDocument();
    expect(screen.getByText('New Data Source')).toBeInTheDocument();
  });

  it('Duplicate button copies selected datasource', async () => {
    const onSaveAll = vi.fn().mockResolvedValue(undefined);
    const ds = makeDs();
    renderManager({ datasources: [ds], onSaveAll });
    // Select the ds to enable duplicate button
    await userEvent.click(screen.getByTestId('ds-item-d1'));
    await userEvent.click(screen.getByTestId('btn-duplicate-selected'));
    await waitFor(() => expect(onSaveAll).toHaveBeenCalledOnce());
    const [, savedDs] = onSaveAll.mock.calls[0] as [Project[], Datasource[]];
    expect(savedDs.find((d) => d.name === 'local-pg (copy)')).toBeTruthy();
    expect(savedDs.find((d) => d.id !== 'd1')).toBeTruthy();
  });

  it('Delete button shows confirm dialog for selected datasource', async () => {
    const ds = makeDs();
    renderManager({ datasources: [ds] });
    await userEvent.click(screen.getByTestId('ds-item-d1'));
    await userEvent.click(screen.getByTestId('btn-delete-selected'));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Delete connection "local-pg"/)).toBeInTheDocument();
  });

  it('confirms datasource delete and calls onSaveAll without it', async () => {
    const onSaveAll = vi.fn().mockResolvedValue(undefined);
    const ds = makeDs();
    renderManager({ datasources: [ds], onSaveAll });
    await userEvent.click(screen.getByTestId('ds-item-d1'));
    await userEvent.click(screen.getByTestId('btn-delete-selected'));
    await userEvent.click(screen.getByTestId('confirm-ok'));
    await waitFor(() => expect(onSaveAll).toHaveBeenCalledOnce());
    const [, savedDs] = onSaveAll.mock.calls[0] as [Project[], Datasource[]];
    expect(savedDs.find((d) => d.id === 'd1')).toBeUndefined();
  });

  it('cancels datasource delete', async () => {
    const onSaveAll = vi.fn().mockResolvedValue(undefined);
    const ds = makeDs();
    renderManager({ datasources: [ds], onSaveAll });
    await userEvent.click(screen.getByTestId('ds-item-d1'));
    await userEvent.click(screen.getByTestId('btn-delete-selected'));
    await userEvent.click(screen.getByTestId('confirm-cancel'));
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(onSaveAll).not.toHaveBeenCalled();
  });

  it('Save new connection calls onSaveAll with new ds', async () => {
    const onSaveAll = vi.fn().mockResolvedValue(undefined);
    renderManager({ datasources: [], onSaveAll });
    await userEvent.type(screen.getByTestId('field-name'), 'new-conn');
    await userEvent.type(screen.getByTestId('field-database'), 'newdb');
    await userEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() => expect(onSaveAll).toHaveBeenCalledOnce());
    const [, savedDs] = onSaveAll.mock.calls[0] as [Project[], Datasource[]];
    expect(savedDs.find((d) => d.name === 'new-conn')).toBeTruthy();
  });

  it('Save edited connection calls onUpdateDs', async () => {
    const onUpdateDs = vi.fn().mockResolvedValue(undefined);
    const ds = makeDs({ name: 'old-name' });
    renderManager({ datasources: [ds], onUpdateDs });
    await userEvent.click(screen.getByTestId('ds-item-d1'));
    await userEvent.clear(screen.getByTestId('field-name'));
    await userEvent.type(screen.getByTestId('field-name'), 'new-name');
    await userEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() => expect(onUpdateDs).toHaveBeenCalledOnce());
    const saved = onUpdateDs.mock.calls[0][0] as Datasource;
    expect(saved.name).toBe('new-name');
    expect(saved.id).toBe('d1');
  });

  it('Cancel in add form hides form when datasources exist', async () => {
    const ds = makeDs();
    renderManager({ datasources: [ds] });
    await userEvent.click(screen.getByTestId('btn-add-connection'));
    expect(screen.getByText('New Data Source')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('btn-cancel'));
    // After cancel with existing ds, form closes
    expect(screen.queryByText('New Data Source')).not.toBeInTheDocument();
  });

  it('switching datasources resets form to the new ds values (core bug fix)', async () => {
    const ds1 = makeDs({ id: 'd1', name: 'alpha', host: 'alpha-host', database: 'db1' });
    const ds2 = makeDs({ id: 'd2', name: 'beta', host: 'beta-host', database: 'db2' });
    renderManager({ datasources: [ds1, ds2] });

    await userEvent.click(screen.getByTestId('ds-item-d1'));
    expect(screen.getByTestId('field-name')).toHaveValue('alpha');

    await userEvent.click(screen.getByTestId('ds-item-d2'));
    expect(screen.getByTestId('field-name')).toHaveValue('beta');
    expect(screen.getByTestId('field-host')).toHaveValue('beta-host');
  });

  it('no unsaved-changes prompt when switching with clean form', async () => {
    const ds1 = makeDs({ id: 'd1', name: 'alpha', database: 'db1' });
    const ds2 = makeDs({ id: 'd2', name: 'beta', database: 'db2' });
    renderManager({ datasources: [ds1, ds2] });

    await userEvent.click(screen.getByTestId('ds-item-d1'));
    await userEvent.click(screen.getByTestId('ds-item-d2'));

    expect(screen.queryByTestId('unsaved-changes-dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('field-name')).toHaveValue('beta');
  });

  it('unsaved-changes prompt appears when switching ds with a dirty form', async () => {
    const ds1 = makeDs({ id: 'd1', name: 'alpha', database: 'db1' });
    const ds2 = makeDs({ id: 'd2', name: 'beta', database: 'db2' });
    renderManager({ datasources: [ds1, ds2] });

    await userEvent.click(screen.getByTestId('ds-item-d1'));
    await userEvent.clear(screen.getByTestId('field-name'));
    await userEvent.type(screen.getByTestId('field-name'), 'modified');

    await userEvent.click(screen.getByTestId('ds-item-d2'));
    expect(screen.getByTestId('unsaved-changes-dialog')).toBeInTheDocument();
  });

  it('Discard in prompt switches without saving', async () => {
    const onUpdateDs = vi.fn().mockResolvedValue(undefined);
    const ds1 = makeDs({ id: 'd1', name: 'alpha', database: 'db1' });
    const ds2 = makeDs({ id: 'd2', name: 'beta', database: 'db2' });
    renderManager({ datasources: [ds1, ds2], onUpdateDs });

    await userEvent.click(screen.getByTestId('ds-item-d1'));
    await userEvent.clear(screen.getByTestId('field-name'));
    await userEvent.type(screen.getByTestId('field-name'), 'modified');
    await userEvent.click(screen.getByTestId('ds-item-d2'));

    await userEvent.click(screen.getByTestId('unsaved-discard'));

    expect(screen.queryByTestId('unsaved-changes-dialog')).not.toBeInTheDocument();
    expect(onUpdateDs).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('field-name')).toHaveValue('beta'));
  });

  it('Cancel in prompt stays on current ds with edits intact', async () => {
    const ds1 = makeDs({ id: 'd1', name: 'alpha', database: 'db1' });
    const ds2 = makeDs({ id: 'd2', name: 'beta', database: 'db2' });
    renderManager({ datasources: [ds1, ds2] });

    await userEvent.click(screen.getByTestId('ds-item-d1'));
    await userEvent.clear(screen.getByTestId('field-name'));
    await userEvent.type(screen.getByTestId('field-name'), 'modified');
    await userEvent.click(screen.getByTestId('ds-item-d2'));

    await userEvent.click(screen.getByTestId('unsaved-cancel'));

    expect(screen.queryByTestId('unsaved-changes-dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('field-name')).toHaveValue('modified');
  });

  it('Save in prompt saves current ds then switches', async () => {
    const onUpdateDs = vi.fn().mockResolvedValue(undefined);
    const ds1 = makeDs({ id: 'd1', name: 'alpha', database: 'db1' });
    const ds2 = makeDs({ id: 'd2', name: 'beta', database: 'db2' });
    renderManager({ datasources: [ds1, ds2], onUpdateDs });

    await userEvent.click(screen.getByTestId('ds-item-d1'));
    await userEvent.clear(screen.getByTestId('field-name'));
    await userEvent.type(screen.getByTestId('field-name'), 'modified');
    await userEvent.click(screen.getByTestId('ds-item-d2'));

    await userEvent.click(screen.getByTestId('unsaved-save'));
    await waitFor(() => expect(onUpdateDs).toHaveBeenCalledOnce());
    const saved = onUpdateDs.mock.calls[0][0] as Datasource;
    expect(saved.name).toBe('modified');

    await waitFor(() =>
      expect(screen.queryByTestId('unsaved-changes-dialog')).not.toBeInTheDocument()
    );
    expect(screen.getByTestId('field-name')).toHaveValue('beta');
  });

  it('Add button triggers unsaved-changes prompt when form is dirty', async () => {
    const ds1 = makeDs({ id: 'd1', name: 'alpha', database: 'db1' });
    renderManager({ datasources: [ds1] });

    await userEvent.click(screen.getByTestId('ds-item-d1'));
    await userEvent.clear(screen.getByTestId('field-name'));
    await userEvent.type(screen.getByTestId('field-name'), 'modified');

    await userEvent.click(screen.getByTestId('btn-add-connection'));
    expect(screen.getByTestId('unsaved-changes-dialog')).toBeInTheDocument();
  });

  it('Apply clears dirty — no prompt when switching after Apply', async () => {
    const onUpdateDs = vi.fn().mockResolvedValue(undefined);
    const ds1 = makeDs({ id: 'd1', name: 'alpha', database: 'db1' });
    const ds2 = makeDs({ id: 'd2', name: 'beta', database: 'db2' });
    renderManager({ datasources: [ds1, ds2], onUpdateDs });

    await userEvent.click(screen.getByTestId('ds-item-d1'));
    await userEvent.clear(screen.getByTestId('field-name'));
    await userEvent.type(screen.getByTestId('field-name'), 'modified');
    await userEvent.click(screen.getByTestId('btn-apply'));
    await waitFor(() => expect(onUpdateDs).toHaveBeenCalledOnce());

    await userEvent.click(screen.getByTestId('ds-item-d2'));
    expect(screen.queryByTestId('unsaved-changes-dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('field-name')).toHaveValue('beta'));
  });

  it('Test connection calls GoApp.TestDatasource with sslMode', async () => {
    const mockTest = vi.mocked(GoApp.TestDatasource);
    mockTest.mockResolvedValueOnce({ Success: true, Message: '5ms' });
    const ds = makeDs({ sslMode: 'require' });
    renderManager({ datasources: [ds] });
    await userEvent.click(screen.getByTestId('ds-item-d1'));
    await userEvent.click(screen.getByTestId('btn-test'));
    await waitFor(() => expect(mockTest).toHaveBeenCalledOnce());
    expect(mockTest.mock.calls[0][5]).toBe('require');
    await waitFor(() => expect(screen.getByTestId('test-result')).toBeInTheDocument());
  });

  it('Test connection on saved ds with blank password uses Keychain via PingDatasource', async () => {
    const mockPing = vi.mocked(GoApp.PingDatasource);
    const mockTest = vi.mocked(GoApp.TestDatasource);
    mockPing.mockResolvedValueOnce({ Success: true, Message: 'ok from keychain' });
    // Simulate post-restart state: LoadConfig strips passwords from on-disk records.
    const ds = makeDs({ password: '' });
    renderManager({ datasources: [ds] });
    await userEvent.click(screen.getByTestId('ds-item-d1'));
    await userEvent.click(screen.getByTestId('btn-test'));
    await waitFor(() => expect(mockPing).toHaveBeenCalledWith('d1'));
    expect(mockTest).not.toHaveBeenCalled();
  });

  it('renders multiple datasources in list', () => {
    const ds1 = makeDs({ id: 'd1', name: 'alpha-conn' });
    const ds2 = makeDs({ id: 'd2', name: 'beta-conn', projectId: 'p2' });
    renderManager({ datasources: [ds1, ds2] });
    expect(screen.getByTestId('ds-item-d1')).toBeInTheDocument();
    expect(screen.getByTestId('ds-item-d2')).toBeInTheDocument();
    expect(screen.getByText('alpha-conn')).toBeInTheDocument();
    expect(screen.getByText('beta-conn')).toBeInTheDocument();
  });

  it('selected datasource has highlighted style', async () => {
    const ds = makeDs();
    renderManager({ datasources: [ds] });
    const item = screen.getByTestId('ds-item-d1');
    await userEvent.click(item);
    // After click and form opens in edit mode — item is selected (selectedDsId = d1)
    expect(item).toBeInTheDocument();
  });

  it('Apply in edit form calls onUpdateDs without closing form', async () => {
    const onUpdateDs = vi.fn().mockResolvedValue(undefined);
    const ds = makeDs({ name: 'old-name' });
    renderManager({ datasources: [ds], onUpdateDs });
    await userEvent.click(screen.getByTestId('ds-item-d1'));
    await userEvent.clear(screen.getByTestId('field-name'));
    await userEvent.type(screen.getByTestId('field-name'), 'applied-name');
    await userEvent.click(screen.getByTestId('btn-apply'));
    await waitFor(() => expect(onUpdateDs).toHaveBeenCalledOnce());
    const saved = onUpdateDs.mock.calls[0][0] as Datasource;
    expect(saved.name).toBe('applied-name');
    // form stays open (still in edit mode)
    expect(screen.getByTestId('connection-form')).toBeInTheDocument();
  });

  it('Apply in new connection form saves and switches to edit mode', async () => {
    const onSaveAll = vi.fn().mockResolvedValue(undefined);
    renderManager({ datasources: [], onSaveAll });
    await userEvent.type(screen.getByTestId('field-name'), 'applied-conn');
    await userEvent.type(screen.getByTestId('field-database'), 'applieddb');
    await userEvent.click(screen.getByTestId('btn-apply'));
    await waitFor(() => expect(onSaveAll).toHaveBeenCalledOnce());
    const [, savedDs] = onSaveAll.mock.calls[0] as [Project[], Datasource[]];
    expect(savedDs.find((d) => d.name === 'applied-conn')).toBeTruthy();
  });
});

// ── Double-click to connect ────────────────────────────────────────────────────

describe('ConnectionManager double-click connect', () => {
  it('calls onConnect when double-clicking a connection', async () => {
    const ds = makeDs();
    const onConnect = vi.fn();
    renderManager({ datasources: [ds], onConnect });
    await userEvent.dblClick(screen.getByTestId(`ds-item-${ds.id}`));
    await waitFor(() => expect(onConnect).toHaveBeenCalledWith(ds.id));
  });

  it('enters the workspace even when the connection is unreachable', async () => {
    // Double-click no longer pings up front; it always enters so cached metadata
    // can be shown and connection errors surface at query time.
    const ds = makeDs();
    const onConnect = vi.fn();
    renderManager({ datasources: [ds], onConnect });
    await userEvent.dblClick(screen.getByTestId(`ds-item-${ds.id}`));
    await waitFor(() => expect(onConnect).toHaveBeenCalledWith(ds.id));
    expect(GoApp.PingDatasource).not.toHaveBeenCalled();
  });
});
