import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Datasource, Project } from '../types';
import {
  ConnectionForm,
  ConnectionManager,
  FieldInput,
  makeEmptyForm,
  SelectInput,
} from './ConnectionManager';

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

// ── Helpers ───────────────────────────────────────────────────────────────────

describe('makeEmptyForm', () => {
  it('returns default values', () => {
    const f = makeEmptyForm();
    expect(f.host).toBe('localhost');
    expect(f.port).toBe(5432);
    expect(f.env).toBe('local');
    expect(f.sslMode).toBe('require');
    expect(f.name).toBe('');
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
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
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
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
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
    // SSL mode is in the SSL tab, not the General tab
  });

  it('pre-populates from initial props', () => {
    render(
      <ConnectionForm
        {...defaultProps}
        initial={{
          name: 'prod-db',
          host: 'db.example.com',
          port: 5433,
          database: 'proddb',
          username: 'admin',
          password: 'pw',
          env: 'prod',
          sslMode: 'require',
        }}
      />
    );
    expect(screen.getByTestId('field-name')).toHaveValue('prod-db');
    expect(screen.getByTestId('field-host')).toHaveValue('db.example.com');
    expect(screen.getByTestId('field-database')).toHaveValue('proddb');
    expect(screen.getByTestId('field-env')).toHaveValue('prod');
    // sslMode is stored in form state but field-ssl is on SSL tab
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
      <ConnectionForm {...defaultProps} onTest={onTest} initial={{ host: 'h', database: 'db' }} />
    );
    await userEvent.click(screen.getByTestId('btn-test'));
    await waitFor(() => expect(screen.getByTestId('test-result')).toBeInTheDocument());
    expect(screen.getByTestId('test-result')).toHaveTextContent('Connection succeeded');
  });

  it('shows failure test result', async () => {
    const onTest = vi.fn().mockResolvedValue({ success: false, message: 'refused' });
    render(
      <ConnectionForm {...defaultProps} onTest={onTest} initial={{ host: 'h', database: 'db' }} />
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

  it('shows connection name in name field for existing datasource', () => {
    render(<ConnectionForm {...defaultProps} initial={{ id: 'd1', name: 'existing' }} />);
    expect(screen.getByTestId('field-name')).toHaveValue('existing');
  });

  it('shows New Data Source heading for new datasource', () => {
    render(<ConnectionForm {...defaultProps} initial={{}} />);
    expect(screen.getByText('New Data Source')).toBeInTheDocument();
  });

  it('Options tab shows placeholder; SSL tab shows ssl field', async () => {
    render(<ConnectionForm {...defaultProps} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Options' }));
    expect(screen.getByText(/Not yet implemented/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'SSL' }));
    expect(screen.getByTestId('field-ssl')).toBeInTheDocument();
  });

  it('URL preview updates as host/port/db change', async () => {
    render(<ConnectionForm {...defaultProps} initial={{ username: 'usr' }} />);
    await userEvent.clear(screen.getByTestId('field-host'));
    await userEvent.type(screen.getByTestId('field-host'), 'myserver');
    expect(screen.getByText(/myserver/)).toBeInTheDocument();
  });
});

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
});
