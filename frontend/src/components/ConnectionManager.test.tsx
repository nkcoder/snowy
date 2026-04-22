import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ConnectionManager,
  ConnectionForm,
  makeEmptyForm,
  projectColor,
  FieldInput,
  SelectInput,
} from './ConnectionManager';
import type { Project, Datasource } from '../types';

// Must use vi.mock (not just alias) so the mock is shared with the component
vi.mock('../../wailsjs/go/main/App', () => ({
  TestDatasource: vi.fn().mockResolvedValue({ Success: true, Message: 'ok' }),
  GetConfig: vi.fn().mockResolvedValue({ projects: [], datasources: [] }),
  SaveConfig: vi.fn().mockResolvedValue(undefined),
  UpdateDatasource: vi.fn().mockResolvedValue(undefined),
  ExecuteQuery: vi.fn().mockResolvedValue({ Columns: [], Rows: [] }),
  ListSchemas: vi.fn().mockResolvedValue([]),
  ListTables: vi.fn().mockResolvedValue([]),
  ListColumns: vi.fn().mockResolvedValue([]),
}));

// Import AFTER vi.mock so we get the mocked version
import * as GoApp from '../../wailsjs/go/main/App';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const proj1: Project = { id: 'p1', name: 'Alpha' };
const proj2: Project = { id: 'p2', name: 'Beta' };

function makeDs(overrides: Partial<Datasource> = {}): Datasource {
  return {
    id: 'd1', name: 'local-pg', host: 'localhost', port: 5432,
    database: 'mydb', username: 'postgres', password: 'secret',
    projectId: 'p1', env: 'local', sslMode: 'disable',
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
  const onSaveAll = (overrides.onSaveAll ?? vi.fn().mockResolvedValue(undefined)) as (p: Project[], d: Datasource[]) => Promise<void>;
  const onUpdateDs = (overrides.onUpdateDs ?? vi.fn().mockResolvedValue(undefined)) as (ds: Datasource) => Promise<void>;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

describe('makeEmptyForm', () => {
  it('returns default values', () => {
    const f = makeEmptyForm();
    expect(f.host).toBe('localhost');
    expect(f.port).toBe(5432);
    expect(f.env).toBe('local');
    expect(f.sslMode).toBe('disable');
    expect(f.name).toBe('');
  });
});

describe('projectColor', () => {
  it('returns first color for first project', () => {
    const color = projectColor([proj1, proj2], 'p1');
    expect(color).toBeTruthy();
    expect(typeof color).toBe('string');
  });
  it('cycles colors when more projects than palette', () => {
    const projects = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
    // Should not throw
    const color = projectColor(projects, `p7`);
    expect(color).toBeTruthy();
  });
  it('returns first color for unknown id (graceful default)', () => {
    const color = projectColor([proj1], 'unknown');
    expect(color).toBeTruthy();
    expect(color).toBe(projectColor([proj1], proj1.id)); // falls back to index 0
  });
});

// ── FieldInput ────────────────────────────────────────────────────────────────

describe('FieldInput', () => {
  it('renders with value', () => {
    render(<FieldInput value="hello" />);
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
  });

  it('calls onChange with new value', async () => {
    const onChange = vi.fn();
    render(<FieldInput value="" onChange={onChange} data-testid="fi" />);
    await userEvent.type(screen.getByTestId('fi'), 'x');
    expect(onChange).toHaveBeenCalledWith('x');
  });

  it('is readonly when readOnly=true', () => {
    render(<FieldInput value="locked" readOnly data-testid="fi" />);
    expect(screen.getByTestId('fi')).toHaveAttribute('readonly');
  });
});

// ── SelectInput ───────────────────────────────────────────────────────────────

describe('SelectInput', () => {
  it('renders all options', () => {
    render(
      <SelectInput
        value="a"
        onChange={vi.fn()}
        options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]}
      />
    );
    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'B' })).toBeInTheDocument();
  });

  it('calls onChange when changed', async () => {
    const onChange = vi.fn();
    render(
      <SelectInput
        value="a"
        onChange={onChange}
        options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]}
        data-testid="sel"
      />
    );
    await userEvent.selectOptions(screen.getByTestId('sel'), 'b');
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

// ── ConnectionForm ─────────────────────────────────────────────────────────────

describe('ConnectionForm', () => {
  const defaultProps = {
    initial: {},
    projectId: 'p1',
    onSave: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
    onTest: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all General tab fields', () => {
    render(<ConnectionForm {...defaultProps} />);
    expect(screen.getByTestId('field-name')).toBeInTheDocument();
    expect(screen.getByTestId('field-host')).toBeInTheDocument();
    expect(screen.getByTestId('field-port')).toBeInTheDocument();
    expect(screen.getByTestId('field-database')).toBeInTheDocument();
    expect(screen.getByTestId('field-username')).toBeInTheDocument();
    expect(screen.getByTestId('field-password')).toBeInTheDocument();
    expect(screen.getByTestId('field-env')).toBeInTheDocument();
    expect(screen.getByTestId('field-ssl')).toBeInTheDocument();
  });

  it('pre-populates from initial props', () => {
    render(
      <ConnectionForm
        {...defaultProps}
        initial={{ name: 'prod-db', host: 'db.example.com', port: 5433, database: 'proddb', username: 'admin', password: 'pw', env: 'prod', sslMode: 'require' }}
      />
    );
    expect(screen.getByTestId('field-name')).toHaveValue('prod-db');
    expect(screen.getByTestId('field-host')).toHaveValue('db.example.com');
    expect(screen.getByTestId('field-database')).toHaveValue('proddb');
    expect(screen.getByTestId('field-env')).toHaveValue('prod');
    expect(screen.getByTestId('field-ssl')).toHaveValue('require');
  });

  it('Save button disabled when name empty', () => {
    render(<ConnectionForm {...defaultProps} initial={{ host: 'localhost', database: 'db' }} />);
    expect(screen.getByTestId('btn-save')).toBeDisabled();
  });

  it('Save button enabled when name + host + database filled', async () => {
    render(<ConnectionForm {...defaultProps} />);
    await userEvent.type(screen.getByTestId('field-name'), 'myconn');
    await userEvent.type(screen.getByTestId('field-database'), 'mydb');
    expect(screen.getByTestId('btn-save')).not.toBeDisabled();
  });

  it('Cancel calls onCancel', async () => {
    const onCancel = vi.fn();
    render(<ConnectionForm {...defaultProps} onCancel={onCancel} />);
    await userEvent.click(screen.getByTestId('btn-cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('Save calls onSave with complete datasource', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ConnectionForm
        {...defaultProps}
        onSave={onSave}
        initial={{ name: 'myconn', host: 'localhost', database: 'mydb' }}
      />
    );
    await userEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const saved = onSave.mock.calls[0][0] as Datasource;
    expect(saved.projectId).toBe('p1');
    expect(saved.name).toBe('myconn');
    expect(saved.database).toBe('mydb');
  });

  it('shows save error when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('save failed'));
    render(
      <ConnectionForm
        {...defaultProps}
        onSave={onSave}
        initial={{ name: 'myconn', host: 'localhost', database: 'mydb' }}
      />
    );
    await userEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() => expect(screen.getByTestId('save-error')).toBeInTheDocument());
    expect(screen.getByTestId('save-error')).toHaveTextContent('save failed');
  });

  it('Test button calls onTest with form values', async () => {
    const onTest = vi.fn().mockResolvedValue({ success: true, message: '12ms' });
    render(
      <ConnectionForm
        {...defaultProps}
        onTest={onTest}
        initial={{ host: 'myhost', database: 'mydb', sslMode: 'require' }}
      />
    );
    await userEvent.click(screen.getByTestId('btn-test'));
    await waitFor(() => expect(onTest).toHaveBeenCalledOnce());
    const arg = onTest.mock.calls[0][0] as Partial<Datasource>;
    expect(arg.host).toBe('myhost');
    expect(arg.database).toBe('mydb');
    expect(arg.sslMode).toBe('require');
  });

  it('shows success test result', async () => {
    const onTest = vi.fn().mockResolvedValue({ success: true, message: '8ms' });
    render(
      <ConnectionForm
        {...defaultProps}
        onTest={onTest}
        initial={{ host: 'h', database: 'db' }}
      />
    );
    await userEvent.click(screen.getByTestId('btn-test'));
    await waitFor(() => expect(screen.getByTestId('test-result')).toBeInTheDocument());
    expect(screen.getByTestId('test-result')).toHaveTextContent('Connection succeeded');
  });

  it('shows failure test result', async () => {
    const onTest = vi.fn().mockResolvedValue({ success: false, message: 'refused' });
    render(
      <ConnectionForm
        {...defaultProps}
        onTest={onTest}
        initial={{ host: 'h', database: 'db' }}
      />
    );
    await userEvent.click(screen.getByTestId('btn-test'));
    await waitFor(() => expect(screen.getByTestId('test-result')).toBeInTheDocument());
    expect(screen.getByTestId('test-result')).toHaveTextContent('Connection failed');
  });

  it('toggles password visibility', async () => {
    render(<ConnectionForm {...defaultProps} />);
    const pw = screen.getByTestId('field-password');
    expect(pw).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByTestId('toggle-password'));
    expect(pw).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByTestId('toggle-password'));
    expect(pw).toHaveAttribute('type', 'password');
  });

  it('Test button disabled when host or database empty', () => {
    render(<ConnectionForm {...defaultProps} initial={{ host: '' }} />);
    expect(screen.getByTestId('btn-test')).toBeDisabled();
  });

  it('shows "Editing" header for existing datasource', () => {
    render(<ConnectionForm {...defaultProps} initial={{ id: 'd1', name: 'existing' }} />);
    expect(screen.getByText(/Editing/)).toBeInTheDocument();
  });

  it('shows "New connection" header for new datasource', () => {
    render(<ConnectionForm {...defaultProps} initial={{}} />);
    expect(screen.getByText('New connection')).toBeInTheDocument();
  });

  it('tabs render and non-General shows placeholder', async () => {
    render(<ConnectionForm {...defaultProps} />);
    await userEvent.click(screen.getByRole('tab', { name: 'SSH / TLS' }));
    expect(screen.getByText(/Not yet implemented/)).toBeInTheDocument();
  });

  it('URL preview updates as host/port/db change', async () => {
    render(<ConnectionForm {...defaultProps} initial={{ username: 'usr' }} />);
    await userEvent.clear(screen.getByTestId('field-host'));
    await userEvent.type(screen.getByTestId('field-host'), 'myserver');
    // URL preview should contain the host
    expect(screen.getByText(/myserver/)).toBeInTheDocument();
  });
});

// ── ConnectionManager ──────────────────────────────────────────────────────────

describe('ConnectionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Projects panel ──

  it('renders project list', () => {
    renderManager({ projects: [proj1, proj2] });
    expect(screen.getByTestId('project-item-p1')).toBeInTheDocument();
    expect(screen.getByTestId('project-item-p2')).toBeInTheDocument();
  });

  it('shows empty state when no projects', () => {
    renderManager({ projects: [] });
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
  });

  it('shows empty-connection state when project has no connections', () => {
    renderManager({ projects: [proj1], datasources: [] });
    expect(screen.getByText('No connections yet')).toBeInTheDocument();
  });

  it('opens new-project modal on "New" button', async () => {
    renderManager();
    await userEvent.click(screen.getByTestId('btn-new-project'));
    expect(screen.getByTestId('project-modal')).toBeInTheDocument();
    expect(screen.getByTestId('input-project-name')).toBeInTheDocument();
  });

  it('closes modal on Cancel', async () => {
    renderManager();
    await userEvent.click(screen.getByTestId('btn-new-project'));
    await userEvent.click(screen.getByTestId('btn-cancel-project'));
    expect(screen.queryByTestId('project-modal')).not.toBeInTheDocument();
  });

  it('creates project and closes modal', async () => {
    const onSaveAll = vi.fn().mockResolvedValue(undefined);
    renderManager({ onSaveAll });
    await userEvent.click(screen.getByTestId('btn-new-project'));
    await userEvent.type(screen.getByTestId('input-project-name'), 'NewProj');
    await userEvent.click(screen.getByTestId('btn-create-project'));
    await waitFor(() => expect(onSaveAll).toHaveBeenCalledOnce());
    const [savedProjects] = onSaveAll.mock.calls[0] as [Project[], Datasource[]];
    expect(savedProjects.some(p => p.name === 'NewProj')).toBe(true);
  });

  it('creates project with Enter key', async () => {
    const onSaveAll = vi.fn().mockResolvedValue(undefined);
    renderManager({ onSaveAll });
    await userEvent.click(screen.getByTestId('btn-new-project'));
    await userEvent.type(screen.getByTestId('input-project-name'), 'KeyProj{Enter}');
    await waitFor(() => expect(onSaveAll).toHaveBeenCalledOnce());
  });

  it('does not create project with empty name', async () => {
    const onSaveAll = vi.fn().mockResolvedValue(undefined);
    renderManager({ onSaveAll });
    await userEvent.click(screen.getByTestId('btn-new-project'));
    await userEvent.click(screen.getByTestId('btn-create-project'));
    expect(onSaveAll).not.toHaveBeenCalled();
  });

  it('shows confirm dialog when deleting a project', async () => {
    renderManager({ projects: [proj1] });
    await userEvent.click(screen.getByTestId('btn-delete-project-p1'));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Delete project "Alpha"/)).toBeInTheDocument();
  });

  it('cancels project delete', async () => {
    const onSaveAll = vi.fn().mockResolvedValue(undefined);
    renderManager({ projects: [proj1], onSaveAll });
    await userEvent.click(screen.getByTestId('btn-delete-project-p1'));
    await userEvent.click(screen.getByTestId('confirm-cancel'));
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(onSaveAll).not.toHaveBeenCalled();
  });

  it('confirms project delete and calls onSaveAll without that project', async () => {
    const onSaveAll = vi.fn().mockResolvedValue(undefined);
    renderManager({ projects: [proj1, proj2], datasources: [], onSaveAll });
    // Select p1 first (it's already selected), then delete
    await userEvent.click(screen.getByTestId('btn-delete-project-p1'));
    await userEvent.click(screen.getByTestId('confirm-ok'));
    await waitFor(() => expect(onSaveAll).toHaveBeenCalledOnce());
    const [savedProjects] = onSaveAll.mock.calls[0] as [Project[], Datasource[]];
    expect(savedProjects.find(p => p.id === 'p1')).toBeUndefined();
  });

  it('mention connection count in delete confirm message', async () => {
    const ds = makeDs({ projectId: 'p1' });
    renderManager({ projects: [proj1], datasources: [ds] });
    await userEvent.click(screen.getByTestId('btn-delete-project-p1'));
    expect(screen.getByText(/remove its 1 connection/)).toBeInTheDocument();
  });

  it('switches active project on click', async () => {
    const ds2 = makeDs({ id: 'd2', projectId: 'p2', name: 'beta-conn' });
    renderManager({ projects: [proj1, proj2], datasources: [ds2] });
    // p1 is selected by default — beta-conn is hidden
    expect(screen.queryByTestId('ds-row-d2')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('project-item-p2'));
    // Now p2 is selected — beta-conn visible
    expect(screen.getByTestId('ds-row-d2')).toBeInTheDocument();
  });

  // ── Connections panel ──

  it('renders connection rows', () => {
    const ds = makeDs();
    renderManager({ projects: [proj1], datasources: [ds] });
    expect(screen.getByTestId('ds-row-d1')).toBeInTheDocument();
    expect(screen.getByText('local-pg')).toBeInTheDocument();
  });

  it('Connect button calls onConnect', async () => {
    const onConnect = vi.fn();
    const ds = makeDs();
    renderManager({ projects: [proj1], datasources: [ds], onConnect });
    await userEvent.click(screen.getByTestId('btn-connect-d1'));
    expect(onConnect).toHaveBeenCalledWith('d1');
  });

  it('opens edit form with pre-populated data on Edit', async () => {
    const ds = makeDs({ name: 'prod-db', host: 'prod.host', database: 'proddb' });
    renderManager({ projects: [proj1], datasources: [ds] });
    await userEvent.click(screen.getByTestId('btn-edit-d1'));
    expect(screen.getByTestId('connection-form')).toBeInTheDocument();
    expect(screen.getByTestId('field-name')).toHaveValue('prod-db');
    expect(screen.getByTestId('field-host')).toHaveValue('prod.host');
    expect(screen.getByTestId('field-database')).toHaveValue('proddb');
  });

  it('Duplicate creates copy with (copy) suffix', async () => {
    const onSaveAll = vi.fn().mockResolvedValue(undefined);
    const ds = makeDs();
    renderManager({ projects: [proj1], datasources: [ds], onSaveAll });
    await userEvent.click(screen.getByTestId('btn-duplicate-d1'));
    await waitFor(() => expect(onSaveAll).toHaveBeenCalledOnce());
    const [, savedDs] = onSaveAll.mock.calls[0] as [Project[], Datasource[]];
    expect(savedDs.find(d => d.name === 'local-pg (copy)')).toBeTruthy();
    expect(savedDs.find(d => d.id !== 'd1')).toBeTruthy(); // new id
  });

  it('shows confirm dialog before deleting connection', async () => {
    const ds = makeDs();
    renderManager({ projects: [proj1], datasources: [ds] });
    await userEvent.click(screen.getByTestId('btn-delete-ds-d1'));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Delete connection "local-pg"/)).toBeInTheDocument();
  });

  it('confirms connection delete and calls onSaveAll without it', async () => {
    const onSaveAll = vi.fn().mockResolvedValue(undefined);
    const ds = makeDs();
    renderManager({ projects: [proj1], datasources: [ds], onSaveAll });
    await userEvent.click(screen.getByTestId('btn-delete-ds-d1'));
    await userEvent.click(screen.getByTestId('confirm-ok'));
    await waitFor(() => expect(onSaveAll).toHaveBeenCalledOnce());
    const [, savedDs] = onSaveAll.mock.calls[0] as [Project[], Datasource[]];
    expect(savedDs.find(d => d.id === 'd1')).toBeUndefined();
  });

  it('cancels connection delete', async () => {
    const onSaveAll = vi.fn().mockResolvedValue(undefined);
    const ds = makeDs();
    renderManager({ projects: [proj1], datasources: [ds], onSaveAll });
    await userEvent.click(screen.getByTestId('btn-delete-ds-d1'));
    await userEvent.click(screen.getByTestId('confirm-cancel'));
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(onSaveAll).not.toHaveBeenCalled();
  });

  it('Add connection button shows form', async () => {
    renderManager();
    await userEvent.click(screen.getByTestId('btn-add-connection'));
    expect(screen.getByTestId('connection-form')).toBeInTheDocument();
    expect(screen.getByText('New connection')).toBeInTheDocument();
  });

  it('"Add your first connection" link shows form', async () => {
    renderManager({ datasources: [] });
    await userEvent.click(screen.getByTestId('btn-add-first'));
    expect(screen.getByTestId('connection-form')).toBeInTheDocument();
  });

  it('Save new connection calls onSaveAll with new ds', async () => {
    const onSaveAll = vi.fn().mockResolvedValue(undefined);
    renderManager({ datasources: [], onSaveAll });
    await userEvent.click(screen.getByTestId('btn-add-connection'));
    await userEvent.type(screen.getByTestId('field-name'), 'new-conn');
    await userEvent.type(screen.getByTestId('field-database'), 'newdb');
    await userEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() => expect(onSaveAll).toHaveBeenCalledOnce());
    const [, savedDs] = onSaveAll.mock.calls[0] as [Project[], Datasource[]];
    expect(savedDs.find(d => d.name === 'new-conn')).toBeTruthy();
  });

  it('Save edited connection calls onUpdateDs', async () => {
    const onUpdateDs = vi.fn().mockResolvedValue(undefined);
    const ds = makeDs({ name: 'old-name' });
    renderManager({ projects: [proj1], datasources: [ds], onUpdateDs });
    await userEvent.click(screen.getByTestId('btn-edit-d1'));
    await userEvent.clear(screen.getByTestId('field-name'));
    await userEvent.type(screen.getByTestId('field-name'), 'new-name');
    await userEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() => expect(onUpdateDs).toHaveBeenCalledOnce());
    const saved = onUpdateDs.mock.calls[0][0] as Datasource;
    expect(saved.name).toBe('new-name');
    expect(saved.id).toBe('d1');
  });

  it('Cancel in add form hides form', async () => {
    renderManager();
    await userEvent.click(screen.getByTestId('btn-add-connection'));
    expect(screen.getByTestId('connection-form')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('btn-cancel'));
    expect(screen.queryByTestId('connection-form')).not.toBeInTheDocument();
  });

  it('Test connection calls GoApp.TestDatasource with sslMode', async () => {
    const mockTest = vi.mocked(GoApp.TestDatasource);
    mockTest.mockResolvedValueOnce({ Success: true, Message: '5ms' });
    const ds = makeDs({ sslMode: 'require' });
    renderManager({ projects: [proj1], datasources: [ds] });
    await userEvent.click(screen.getByTestId('btn-edit-d1'));
    await userEvent.click(screen.getByTestId('btn-test'));
    await waitFor(() => expect(mockTest).toHaveBeenCalledOnce());
    // 6th arg is sslMode
    expect(mockTest.mock.calls[0][5]).toBe('require');
    await waitFor(() => expect(screen.getByTestId('test-result')).toBeInTheDocument());
  });

  it('shows "Select or create a project" when no project selected', () => {
    renderManager({ projects: [] });
    expect(screen.getByText(/Select or create a project/)).toBeInTheDocument();
  });

  it('only shows connections for selected project', () => {
    const ds1 = makeDs({ id: 'd1', projectId: 'p1', name: 'alpha-conn' });
    const ds2 = makeDs({ id: 'd2', projectId: 'p2', name: 'beta-conn' });
    renderManager({ projects: [proj1, proj2], datasources: [ds1, ds2] });
    // p1 selected by default
    expect(screen.getByText('alpha-conn')).toBeInTheDocument();
    expect(screen.queryByText('beta-conn')).not.toBeInTheDocument();
  });

  it('env badge renders with correct label', () => {
    const ds = makeDs({ env: 'prod' });
    renderManager({ projects: [proj1], datasources: [ds] });
    expect(screen.getByText('prod')).toBeInTheDocument();
  });
});
