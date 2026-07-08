import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Datasource } from '../types';
import { Sidebar } from './Sidebar';

vi.mock('../../wailsjs/go/main/App', () => ({
  ListSchemas: vi.fn().mockResolvedValue([]),
  ListTables: vi.fn().mockResolvedValue([]),
  ListColumns: vi.fn().mockResolvedValue([]),
  ListTableKeys: vi.fn().mockResolvedValue([]),
  ListTableForeignKeys: vi.fn().mockResolvedValue([]),
  ListTableIndexes: vi.fn().mockResolvedValue([]),
  ListTableChecks: vi.fn().mockResolvedValue([]),
  GetConfig: vi.fn().mockResolvedValue({ projects: [], datasources: [] }),
  SaveConfig: vi.fn().mockResolvedValue(undefined),
  UpdateDatasource: vi.fn().mockResolvedValue(undefined),
  TestDatasource: vi.fn().mockResolvedValue({ Success: true, Message: 'ok' }),
  ExecuteQuery: vi.fn().mockResolvedValue({ Columns: [], Rows: [] }),
  GetCachedMetadata: vi.fn().mockResolvedValue({ schemas: [] }),
}));

import * as GoApp from '../../wailsjs/go/main/App';
import type { main } from '../../wailsjs/go/models';

// Build a DatabaseMetadata for GetCachedMetadata mocks, casting past the
// generated class shape (only the fields the Sidebar reads are provided).
const cachedMeta = (schemas: unknown[]): main.DatabaseMetadata =>
  ({ schemas }) as unknown as main.DatabaseMetadata;

const DS1: Datasource = {
  id: 'ds1',
  name: 'local-pg',
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  username: 'user',
  password: '',
  projectId: 'p1',
  env: 'local',
  sslMode: 'disable',
};

const DS2: Datasource = {
  id: 'ds2',
  name: 'prod-pg',
  host: 'prod.db',
  port: 5432,
  database: 'proddb',
  username: 'user',
  password: '',
  projectId: 'p1',
  env: 'prod',
  sslMode: 'require',
};

function renderSidebar(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const onTableSelect = overrides.onTableSelect ?? vi.fn();
  const onAddConnection = overrides.onAddConnection ?? vi.fn();
  const onConnect = overrides.onConnect ?? vi.fn();
  const onLoadQuery = overrides.onLoadQuery ?? vi.fn();
  const onDeleteQuery = overrides.onDeleteQuery ?? vi.fn();
  const onRenameQuery = overrides.onRenameQuery ?? vi.fn();
  const onNewConsole = overrides.onNewConsole ?? vi.fn();
  const onDisconnect = overrides.onDisconnect ?? vi.fn();
  const onShowProperties = overrides.onShowProperties ?? vi.fn();
  render(
    <Sidebar
      datasources={overrides.datasources ?? [DS1]}
      activeDatasourceId={overrides.activeDatasourceId ?? 'ds1'}
      onConnect={onConnect}
      onTableSelect={onTableSelect}
      onAddConnection={onAddConnection}
      savedQueries={overrides.savedQueries ?? []}
      onLoadQuery={onLoadQuery}
      onDeleteQuery={onDeleteQuery}
      onRenameQuery={onRenameQuery}
      onNewConsole={onNewConsole}
      onDisconnect={onDisconnect}
      onShowProperties={onShowProperties}
    />
  );
  return {
    onTableSelect,
    onAddConnection,
    onConnect,
    onLoadQuery,
    onDeleteQuery,
    onRenameQuery,
    onNewConsole,
    onDisconnect,
    onShowProperties,
  };
}

describe('Sidebar — basic render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([]);
  });

  it('shows empty state when datasources array is empty', () => {
    render(
      <Sidebar
        datasources={[]}
        activeDatasourceId={null}
        onConnect={vi.fn()}
        onTableSelect={vi.fn()}
        onAddConnection={vi.fn()}
      />
    );
    expect(screen.getByText(/No connections/)).toBeInTheDocument();
  });

  it('renders datasource connection node', async () => {
    renderSidebar();
    expect(screen.getByTestId('conn-node-ds1')).toBeInTheDocument();
    expect(screen.getByText('local-pg')).toBeInTheDocument();
  });

  it('renders all datasources', () => {
    renderSidebar({ datasources: [DS1, DS2] });
    expect(screen.getByTestId('conn-node-ds1')).toBeInTheDocument();
    expect(screen.getByTestId('conn-node-ds2')).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderSidebar();
    expect(screen.getByTestId('sidebar-search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Filter objects…')).toBeInTheDocument();
  });

  it('renders New connection toolbar button', () => {
    renderSidebar();
    expect(screen.getByTitle('New connection')).toBeInTheDocument();
  });

  it('New connection button calls onAddConnection', async () => {
    const onAddConnection = vi.fn();
    renderSidebar({ onAddConnection });
    await userEvent.click(screen.getByTitle('New connection'));
    expect(onAddConnection).toHaveBeenCalledOnce();
  });
});

describe('Sidebar — schema loading', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls ListSchemas on mount for active datasource', async () => {
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([]);
    renderSidebar({ activeDatasourceId: 'ds1' });
    await waitFor(() => expect(GoApp.ListSchemas).toHaveBeenCalledWith('ds1'));
  });

  it('does not call ListSchemas when activeDatasourceId is null', async () => {
    render(
      <Sidebar
        datasources={[DS1]}
        activeDatasourceId={null}
        onConnect={vi.fn()}
        onTableSelect={vi.fn()}
        onAddConnection={vi.fn()}
      />
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(GoApp.ListSchemas).not.toHaveBeenCalled();
  });

  it('renders schema rows after load', async () => {
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([
      { name: 'public' } as never,
      { name: 'finance' } as never,
    ]);
    renderSidebar();
    await waitFor(() => expect(screen.getByTestId('schema-row-public')).toBeInTheDocument());
    expect(screen.getByTestId('schema-row-finance')).toBeInTheDocument();
  });

  it('reloads schemas when activeDatasourceId changes to a new connection', async () => {
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([{ name: 'public' } as never]);
    const { rerender } = render(
      <Sidebar
        datasources={[DS1, DS2]}
        activeDatasourceId="ds1"
        onConnect={vi.fn()}
        onTableSelect={vi.fn()}
        onAddConnection={vi.fn()}
      />
    );
    await waitFor(() => expect(GoApp.ListSchemas).toHaveBeenCalledWith('ds1'));

    vi.mocked(GoApp.ListSchemas).mockResolvedValue([{ name: 'other' } as never]);
    rerender(
      <Sidebar
        datasources={[DS1, DS2]}
        activeDatasourceId="ds2"
        onConnect={vi.fn()}
        onTableSelect={vi.fn()}
        onAddConnection={vi.fn()}
      />
    );
    await waitFor(() => expect(GoApp.ListSchemas).toHaveBeenCalledWith('ds2'));
    await waitFor(() => expect(screen.getByTestId('schema-row-other')).toBeInTheDocument());
  });
});

describe('Sidebar — schema expand / table load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([{ name: 'public' } as never]);
    vi.mocked(GoApp.ListTables).mockResolvedValue([
      { name: 'users', type: 'TABLE' } as never,
      { name: 'posts', type: 'TABLE' } as never,
    ]);
  });

  it('calls ListTables when schema row is clicked', async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByTestId('schema-row-public')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => expect(GoApp.ListTables).toHaveBeenCalledWith('ds1', 'public'));
  });

  it('renders table rows after schema expand', async () => {
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => expect(screen.getByTestId('table-row-public-users')).toBeInTheDocument());
    expect(screen.getByTestId('table-row-public-posts')).toBeInTheDocument();
  });

  it('double-click table calls onTableSelect', async () => {
    const onTableSelect = vi.fn();
    renderSidebar({ onTableSelect });
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => screen.getByTestId('table-row-public-users'));
    await userEvent.dblClick(screen.getByTestId('table-row-public-users'));
    expect(onTableSelect).toHaveBeenCalledWith('public', 'users');
  });

  it('collapses schema on second click', async () => {
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => screen.getByTestId('table-row-public-users'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() =>
      expect(screen.queryByTestId('table-row-public-users')).not.toBeInTheDocument()
    );
  });
});

describe('Sidebar — tree folding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([{ name: 'public' } as never]);
    vi.mocked(GoApp.ListTables).mockResolvedValue([
      { name: 'users', type: 'TABLE' } as never,
      { name: 'v_active', type: 'VIEW' } as never,
    ]);
  });

  it('collapses the database node, hiding schemas', async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByTestId('schema-row-public')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('db-row-ds1'));
    await waitFor(() => expect(screen.queryByTestId('schema-row-public')).not.toBeInTheDocument());
    await userEvent.click(screen.getByTestId('db-row-ds1'));
    await waitFor(() => expect(screen.getByTestId('schema-row-public')).toBeInTheDocument());
  });

  it('collapses the tables folder, hiding table rows', async () => {
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => expect(screen.getByTestId('table-row-public-users')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('folder-tables-public'));
    await waitFor(() =>
      expect(screen.queryByTestId('table-row-public-users')).not.toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId('folder-tables-public'));
    await waitFor(() => expect(screen.getByTestId('table-row-public-users')).toBeInTheDocument());
  });

  it('collapses the views folder, hiding view rows', async () => {
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() =>
      expect(screen.getByTestId('table-row-public-v_active')).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId('folder-views-public'));
    await waitFor(() =>
      expect(screen.queryByTestId('table-row-public-v_active')).not.toBeInTheDocument()
    );
  });
});

describe('Sidebar — column load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([{ name: 'public' } as never]);
    vi.mocked(GoApp.ListTables).mockResolvedValue([{ name: 'users', type: 'TABLE' } as never]);
    vi.mocked(GoApp.ListColumns).mockResolvedValue([
      { name: 'id', dataType: 'int4', isNullable: 'NO' } as never,
      { name: 'email', dataType: 'text', isNullable: 'YES' } as never,
    ]);
  });

  it('calls ListColumns when table row is clicked', async () => {
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => screen.getByTestId('table-row-public-users'));
    await userEvent.click(screen.getByTestId('table-row-public-users'));
    await waitFor(() => expect(GoApp.ListColumns).toHaveBeenCalledWith('ds1', 'public', 'users'));
  });

  it('renders columns sub-folder and column names after table expand', async () => {
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => screen.getByTestId('table-row-public-users'));
    await userEvent.click(screen.getByTestId('table-row-public-users'));
    await waitFor(() =>
      expect(screen.getByTestId('subfolder-columns-public-users')).toBeInTheDocument()
    );
    await waitFor(() => expect(screen.getByText('id')).toBeInTheDocument());
    expect(screen.getByText('email')).toBeInTheDocument();
  });

  it('renders the exact data type and appends the column default', async () => {
    vi.mocked(GoApp.ListColumns).mockResolvedValue([
      {
        name: 'account_id',
        dataType: 'integer',
        isNullable: 'NO',
        default: "nextval('accounts_account_id_seq'::regclass)",
        keyType: 'pk',
      } as never,
      { name: 'currency', dataType: 'varchar(3)', isNullable: 'YES', default: '' } as never,
    ]);
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => screen.getByTestId('table-row-public-users'));
    await userEvent.click(screen.getByTestId('table-row-public-users'));
    // Exact type with modifier is shown.
    await waitFor(() => expect(screen.getByText('varchar(3)')).toBeInTheDocument());
    expect(screen.getByText('integer')).toBeInTheDocument();
    // Default is appended for account_id, omitted for currency (empty default).
    expect(screen.getByText("= nextval('accounts_account_id_seq'::regclass)")).toBeInTheDocument();
  });

  it('shows keys sub-folder after table expand', async () => {
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => screen.getByTestId('table-row-public-users'));
    await userEvent.click(screen.getByTestId('table-row-public-users'));
    await waitFor(() =>
      expect(screen.getByTestId('subfolder-keys-public-users')).toBeInTheDocument()
    );
  });

  it('shows foreign keys sub-folder after table expand', async () => {
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => screen.getByTestId('table-row-public-users'));
    await userEvent.click(screen.getByTestId('table-row-public-users'));
    await waitFor(() =>
      expect(screen.getByTestId('subfolder-fk-public-users')).toBeInTheDocument()
    );
  });

  it('shows indexes sub-folder after table expand', async () => {
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => screen.getByTestId('table-row-public-users'));
    await userEvent.click(screen.getByTestId('table-row-public-users'));
    await waitFor(() =>
      expect(screen.getByTestId('subfolder-indexes-public-users')).toBeInTheDocument()
    );
  });

  it('shows checks sub-folder after table expand', async () => {
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => screen.getByTestId('table-row-public-users'));
    await userEvent.click(screen.getByTestId('table-row-public-users'));
    await waitFor(() =>
      expect(screen.getByTestId('subfolder-checks-public-users')).toBeInTheDocument()
    );
  });
});

describe('Sidebar — sub-folder drill-in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([{ name: 'public' } as never]);
    vi.mocked(GoApp.ListTables).mockResolvedValue([{ name: 'accounts', type: 'TABLE' } as never]);
    vi.mocked(GoApp.ListColumns).mockResolvedValue([]);
    vi.mocked(GoApp.ListTableKeys).mockResolvedValue([
      { name: 'pk_accounts', columns: 'account_id' } as never,
    ]);
    vi.mocked(GoApp.ListTableForeignKeys).mockResolvedValue([
      {
        name: 'fk_accounts_user',
        columns: 'user_id',
        refSchema: 'public',
        refTable: 'users',
        refColumns: 'id',
      } as never,
    ]);
    vi.mocked(GoApp.ListTableIndexes).mockResolvedValue([
      { name: 'idx_accounts_status', isUnique: false, columns: 'status' } as never,
    ]);
    vi.mocked(GoApp.ListTableChecks).mockResolvedValue([
      { name: 'chk_balance', definition: 'balance >= 0' } as never,
    ]);
  });

  async function expandToTable() {
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => screen.getByTestId('table-row-public-accounts'));
    await userEvent.click(screen.getByTestId('table-row-public-accounts'));
    await waitFor(() => screen.getByTestId('subfolder-keys-public-accounts'));
  }

  it('clicking keys sub-folder loads and shows key items', async () => {
    await expandToTable();
    await userEvent.click(screen.getByTestId('subfolder-keys-public-accounts'));
    await waitFor(() =>
      expect(GoApp.ListTableKeys).toHaveBeenCalledWith('ds1', 'public', 'accounts')
    );
    await waitFor(() => expect(screen.getByText('pk_accounts')).toBeInTheDocument());
  });

  it('clicking foreign keys sub-folder loads and shows FK items', async () => {
    await expandToTable();
    await userEvent.click(screen.getByTestId('subfolder-fk-public-accounts'));
    await waitFor(() =>
      expect(GoApp.ListTableForeignKeys).toHaveBeenCalledWith('ds1', 'public', 'accounts')
    );
    await waitFor(() => expect(screen.getByText('fk_accounts_user')).toBeInTheDocument());
  });

  it('clicking indexes sub-folder loads and shows index items', async () => {
    await expandToTable();
    await userEvent.click(screen.getByTestId('subfolder-indexes-public-accounts'));
    await waitFor(() =>
      expect(GoApp.ListTableIndexes).toHaveBeenCalledWith('ds1', 'public', 'accounts')
    );
    await waitFor(() => expect(screen.getByText('idx_accounts_status')).toBeInTheDocument());
  });

  it('clicking checks sub-folder loads and shows check items', async () => {
    await expandToTable();
    await userEvent.click(screen.getByTestId('subfolder-checks-public-accounts'));
    await waitFor(() =>
      expect(GoApp.ListTableChecks).toHaveBeenCalledWith('ds1', 'public', 'accounts')
    );
    await waitFor(() => expect(screen.getByText('chk_balance')).toBeInTheDocument());
  });

  it('sub-folder does not re-fetch on second open', async () => {
    await expandToTable();
    await userEvent.click(screen.getByTestId('subfolder-keys-public-accounts'));
    await waitFor(() => screen.getByText('pk_accounts'));
    // collapse
    await userEvent.click(screen.getByTestId('subfolder-keys-public-accounts'));
    await waitFor(() => expect(screen.queryByText('pk_accounts')).not.toBeInTheDocument());
    // re-open — should NOT call ListTableKeys again
    await userEvent.click(screen.getByTestId('subfolder-keys-public-accounts'));
    await waitFor(() => screen.getByText('pk_accounts'));
    expect(GoApp.ListTableKeys).toHaveBeenCalledTimes(1);
  });
});

describe('Sidebar — search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([
      { name: 'public' } as never,
      { name: 'finance' } as never,
    ]);
    vi.mocked(GoApp.ListTables).mockResolvedValue([
      { name: 'users', type: 'TABLE' } as never,
      { name: 'payments', type: 'TABLE' } as never,
    ]);
  });

  it('typing in search does not crash', async () => {
    renderSidebar();
    await userEvent.type(screen.getByTestId('sidebar-search'), 'public');
    expect(screen.getByTestId('sidebar-search')).toHaveValue('public');
  });

  it('shows clear button when search has text', async () => {
    renderSidebar();
    await userEvent.type(screen.getByTestId('sidebar-search'), 'abc');
    expect(screen.getByTestId('sidebar-search-clear')).toBeInTheDocument();
  });

  it('clear button resets search', async () => {
    renderSidebar();
    await userEvent.type(screen.getByTestId('sidebar-search'), 'abc');
    await userEvent.click(screen.getByTestId('sidebar-search-clear'));
    expect(screen.getByTestId('sidebar-search')).toHaveValue('');
    expect(screen.queryByTestId('sidebar-search-clear')).not.toBeInTheDocument();
  });

  it('filters schemas by name', async () => {
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.type(screen.getByTestId('sidebar-search'), 'public');
    await waitFor(() => expect(screen.queryByTestId('schema-row-finance')).not.toBeInTheDocument());
    expect(screen.getByTestId('schema-row-public')).toBeInTheDocument();
  });
});

describe('Sidebar — queries folder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([]);
  });

  it('queries folder is collapsed by default, expands on click', async () => {
    renderSidebar();
    await waitFor(() => screen.getByTestId('folder-queries'));
    expect(screen.queryByText(/No saved queries/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('folder-queries'));
    expect(screen.getByText(/No saved queries/)).toBeInTheDocument();
  });
});

describe('Sidebar — saved queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([]);
  });

  it('shows saved query files when queries folder expanded', async () => {
    const { onLoadQuery } = renderSidebar({
      savedQueries: [{ filename: 'my_query.sql' }, { filename: 'report.sql' }],
    });
    await userEvent.click(screen.getByTestId('folder-queries'));
    expect(screen.getByTestId('query-row-my_query.sql')).toBeInTheDocument();
    expect(screen.getByTestId('query-row-report.sql')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('query-row-my_query.sql'));
    expect(onLoadQuery).toHaveBeenCalledWith('my_query.sql');
  });

  it('delete button calls onDeleteQuery', async () => {
    const { onDeleteQuery } = renderSidebar({
      savedQueries: [{ filename: 'my_query.sql' }],
    });
    await userEvent.click(screen.getByTestId('folder-queries'));
    await userEvent.click(screen.getByTestId('delete-query-my_query.sql'));
    expect(onDeleteQuery).toHaveBeenCalledWith('my_query.sql');
  });

  it('shows "No saved queries" when list is empty and folder open', async () => {
    renderSidebar({ savedQueries: [] });
    await userEvent.click(screen.getByTestId('folder-queries'));
    expect(screen.getByText(/No saved queries/)).toBeInTheDocument();
  });

  it('shows query count badge on folder', async () => {
    renderSidebar({ savedQueries: [{ filename: 'a.sql' }, { filename: 'b.sql' }] });
    await waitFor(() => screen.getByTestId('folder-queries'));
    expect(screen.getByTestId('folder-queries')).toHaveTextContent('2');
  });
});

describe('Sidebar — query rename', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([]);
  });

  it('double-click query row shows rename input', async () => {
    renderSidebar({ savedQueries: [{ filename: 'my_query.sql' }] });
    await userEvent.click(screen.getByTestId('folder-queries'));
    await userEvent.dblClick(screen.getByTestId('query-row-my_query.sql'));
    expect(screen.getByTestId('rename-input-my_query.sql')).toBeInTheDocument();
  });

  it('Enter in rename input calls onRenameQuery', async () => {
    const { onRenameQuery } = renderSidebar({ savedQueries: [{ filename: 'old.sql' }] });
    await userEvent.click(screen.getByTestId('folder-queries'));
    await userEvent.dblClick(screen.getByTestId('query-row-old.sql'));
    const input = screen.getByTestId('rename-input-old.sql');
    await userEvent.clear(input);
    await userEvent.type(input, 'new.sql');
    await userEvent.keyboard('{Enter}');
    expect(onRenameQuery).toHaveBeenCalledWith('old.sql', 'new.sql');
  });

  it('Escape cancels rename without calling onRenameQuery', async () => {
    const { onRenameQuery } = renderSidebar({ savedQueries: [{ filename: 'q.sql' }] });
    await userEvent.click(screen.getByTestId('folder-queries'));
    await userEvent.dblClick(screen.getByTestId('query-row-q.sql'));
    await userEvent.keyboard('{Escape}');
    expect(onRenameQuery).not.toHaveBeenCalled();
    expect(screen.queryByTestId('rename-input-q.sql')).not.toBeInTheDocument();
  });
});

describe('Sidebar — views shown under schema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([{ name: 'public' } as never]);
    vi.mocked(GoApp.ListTables).mockResolvedValue([
      { name: 'users', type: 'TABLE' } as never,
      { name: 'user_view', type: 'VIEW' } as never,
    ]);
  });

  it('view row appears under schema after expand', async () => {
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() =>
      expect(screen.getByTestId('table-row-public-user_view')).toBeInTheDocument()
    );
  });

  it('double-click view calls onTableSelect', async () => {
    const onTableSelect = vi.fn();
    renderSidebar({ onTableSelect });
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => screen.getByTestId('table-row-public-user_view'));
    await userEvent.dblClick(screen.getByTestId('table-row-public-user_view'));
    expect(onTableSelect).toHaveBeenCalledWith('public', 'user_view');
  });
});

describe('Sidebar — column collapse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([{ name: 'public' } as never]);
    vi.mocked(GoApp.ListTables).mockResolvedValue([{ name: 'users', type: 'TABLE' } as never]);
    vi.mocked(GoApp.ListColumns).mockResolvedValue([
      { name: 'id', dataType: 'int4', isNullable: 'NO' } as never,
    ]);
  });

  it('table collapses on second click — sub-folders disappear', async () => {
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => screen.getByTestId('table-row-public-users'));
    await userEvent.click(screen.getByTestId('table-row-public-users'));
    await waitFor(() =>
      expect(screen.getByTestId('subfolder-columns-public-users')).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId('table-row-public-users'));
    await waitFor(() =>
      expect(screen.queryByTestId('subfolder-columns-public-users')).not.toBeInTheDocument()
    );
  });
});

describe('Sidebar — multi-connection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([]);
  });

  it('double-clicking inactive connection calls onConnect', async () => {
    const onConnect = vi.fn();
    renderSidebar({ datasources: [DS1, DS2], activeDatasourceId: 'ds1', onConnect });
    await userEvent.dblClick(screen.getByTestId('conn-node-ds2'));
    expect(onConnect).toHaveBeenCalledWith('ds2');
  });

  it('single-clicking inactive connection expands from cache without connecting', async () => {
    const onConnect = vi.fn();
    vi.mocked(GoApp.GetCachedMetadata).mockResolvedValueOnce(
      cachedMeta([
        {
          name: 'public',
          tables: [
            {
              name: 'orders',
              type: 'BASE TABLE',
              columns: [],
              keys: [],
              foreignKeys: [],
              indexes: [],
              checks: [],
            },
          ],
        },
      ])
    );
    renderSidebar({ datasources: [DS1, DS2], activeDatasourceId: 'ds1', onConnect });
    await userEvent.click(screen.getByTestId('conn-node-ds2'));
    expect(await screen.findByTestId('schema-row-public')).toBeInTheDocument();
    expect(GoApp.GetCachedMetadata).toHaveBeenCalledWith('ds2');
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('re-expanding an inactive connection does not re-fetch cached metadata', async () => {
    vi.mocked(GoApp.GetCachedMetadata).mockResolvedValue(
      cachedMeta([{ name: 'public', tables: [] }])
    );
    renderSidebar({ datasources: [DS1, DS2], activeDatasourceId: 'ds1' });
    const node = screen.getByTestId('conn-node-ds2');
    await userEvent.click(node); // expand → fetch
    await screen.findByTestId('schema-row-public');
    await userEvent.click(node); // collapse
    await userEvent.click(node); // re-expand → cached
    expect(GoApp.GetCachedMetadata).toHaveBeenCalledTimes(1);
  });

  it('inactive connection with empty cache shows "not connected" placeholder', async () => {
    vi.mocked(GoApp.GetCachedMetadata).mockResolvedValueOnce(cachedMeta([]));
    renderSidebar({ datasources: [DS1, DS2], activeDatasourceId: 'ds1' });
    await userEvent.click(screen.getByTestId('conn-node-ds2'));
    expect(await screen.findByText(/Not connected — double-click to connect/i)).toBeInTheDocument();
  });

  it('double-clicking the active connection does not call onConnect', async () => {
    const onConnect = vi.fn();
    renderSidebar({ datasources: [DS1], activeDatasourceId: 'ds1', onConnect });
    await userEvent.dblClick(screen.getByTestId('conn-node-ds1'));
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('double-clicking a table in an inactive connection does not call onTableSelect', async () => {
    const onTableSelect = vi.fn();
    vi.mocked(GoApp.GetCachedMetadata).mockResolvedValueOnce(
      cachedMeta([
        {
          name: 'public',
          tables: [
            {
              name: 'orders',
              type: 'BASE TABLE',
              columns: [],
              keys: [],
              foreignKeys: [],
              indexes: [],
              checks: [],
            },
          ],
        },
      ])
    );
    renderSidebar({ datasources: [DS1, DS2], activeDatasourceId: 'ds1', onTableSelect });
    await userEvent.click(screen.getByTestId('conn-node-ds2'));
    await userEvent.click(await screen.findByTestId('schema-row-public'));
    await userEvent.dblClick(screen.getByTestId('table-row-public-orders'));
    expect(onTableSelect).not.toHaveBeenCalled();
    // and no live table/column fetch happened for the inactive connection
    expect(GoApp.ListTables).not.toHaveBeenCalled();
    expect(GoApp.ListColumns).not.toHaveBeenCalled();
  });
});

describe('Sidebar — context menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([]);
  });

  it('right-clicking a datasource node shows context menu', () => {
    renderSidebar();
    fireEvent.contextMenu(screen.getByTestId('conn-node-ds1'));
    expect(screen.getByTestId('ctx-menu-ds1')).toBeInTheDocument();
  });

  it('Escape key dismisses the context menu', async () => {
    renderSidebar();
    fireEvent.contextMenu(screen.getByTestId('conn-node-ds1'));
    expect(screen.getByTestId('ctx-menu-ds1')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByTestId('ctx-menu-ds1')).not.toBeInTheDocument();
  });

  it('clicking outside dismisses the context menu', async () => {
    renderSidebar();
    fireEvent.contextMenu(screen.getByTestId('conn-node-ds1'));
    expect(screen.getByTestId('ctx-menu-ds1')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('sidebar-search'));
    expect(screen.queryByTestId('ctx-menu-ds1')).not.toBeInTheDocument();
  });

  it('"Properties" calls onShowProperties with the ds id and closes menu', async () => {
    const { onShowProperties } = renderSidebar({ activeDatasourceId: 'ds1' });
    fireEvent.contextMenu(screen.getByTestId('conn-node-ds1'));
    await userEvent.click(screen.getByText('Properties'));
    expect(onShowProperties).toHaveBeenCalledWith('ds1');
    expect(screen.queryByTestId('ctx-menu-ds1')).not.toBeInTheDocument();
  });

  it('"Properties" is enabled even when ds is inactive', async () => {
    const { onShowProperties } = renderSidebar({
      datasources: [DS1, DS2],
      activeDatasourceId: 'ds2',
    });
    fireEvent.contextMenu(screen.getByTestId('conn-node-ds1'));
    await userEvent.click(screen.getByText('Properties'));
    expect(onShowProperties).toHaveBeenCalledWith('ds1');
  });

  it('"New Query Console" calls onNewConsole and closes menu when ds is active', async () => {
    const { onNewConsole } = renderSidebar({ activeDatasourceId: 'ds1' });
    fireEvent.contextMenu(screen.getByTestId('conn-node-ds1'));
    await userEvent.click(screen.getByText('New Query Console'));
    expect(onNewConsole).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('ctx-menu-ds1')).not.toBeInTheDocument();
  });

  it('"New Query Console" is disabled when ds is inactive', async () => {
    renderSidebar({ datasources: [DS1, DS2], activeDatasourceId: 'ds2' });
    fireEvent.contextMenu(screen.getByTestId('conn-node-ds1'));
    const item = screen.getByText('New Query Console');
    await userEvent.click(item);
    // clicking a disabled item should do nothing — menu still open
    expect(screen.getByTestId('ctx-menu-ds1')).toBeInTheDocument();
  });

  it('"Disconnect" calls onDisconnect and closes menu when ds is active', async () => {
    const { onDisconnect } = renderSidebar({ activeDatasourceId: 'ds1' });
    fireEvent.contextMenu(screen.getByTestId('conn-node-ds1'));
    await userEvent.click(screen.getByText('Disconnect'));
    expect(onDisconnect).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('ctx-menu-ds1')).not.toBeInTheDocument();
  });

  it('"Disconnect" is disabled when ds is inactive', async () => {
    renderSidebar({ datasources: [DS1, DS2], activeDatasourceId: 'ds2' });
    fireEvent.contextMenu(screen.getByTestId('conn-node-ds1'));
    await userEvent.click(screen.getByText('Disconnect'));
    expect(screen.getByTestId('ctx-menu-ds1')).toBeInTheDocument();
  });

  it('"Refresh" on active ds calls ListSchemas and closes menu', async () => {
    renderSidebar({ activeDatasourceId: 'ds1' });
    // wait for initial load to settle
    await waitFor(() => expect(GoApp.ListSchemas).toHaveBeenCalledWith('ds1'));
    vi.mocked(GoApp.ListSchemas).mockClear();
    fireEvent.contextMenu(screen.getByTestId('conn-node-ds1'));
    await userEvent.click(screen.getByText('Refresh'));
    await waitFor(() => expect(GoApp.ListSchemas).toHaveBeenCalledWith('ds1'));
    expect(screen.queryByTestId('ctx-menu-ds1')).not.toBeInTheDocument();
  });

  it('"Refresh" on inactive ds calls onConnect then ListSchemas', async () => {
    const { onConnect } = renderSidebar({ datasources: [DS1, DS2], activeDatasourceId: 'ds2' });
    fireEvent.contextMenu(screen.getByTestId('conn-node-ds1'));
    await userEvent.click(screen.getByText('Refresh'));
    expect(onConnect).toHaveBeenCalledWith('ds1');
    await waitFor(() => expect(GoApp.ListSchemas).toHaveBeenCalledWith('ds1'));
  });

  it('context menu does not appear on schema rows', async () => {
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([{ name: 'public' } as never]);
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    fireEvent.contextMenu(screen.getByTestId('schema-row-public'));
    expect(screen.queryByTestId('ctx-menu-ds1')).not.toBeInTheDocument();
  });
});
