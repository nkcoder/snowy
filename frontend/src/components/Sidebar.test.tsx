import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from './Sidebar';

vi.mock('../../wailsjs/go/main/App', () => ({
  ListSchemas: vi.fn().mockResolvedValue([]),
  ListTables: vi.fn().mockResolvedValue([]),
  ListColumns: vi.fn().mockResolvedValue([]),
  GetConfig: vi.fn().mockResolvedValue({ projects: [], datasources: [] }),
  SaveConfig: vi.fn().mockResolvedValue(undefined),
  UpdateDatasource: vi.fn().mockResolvedValue(undefined),
  TestDatasource: vi.fn().mockResolvedValue({ Success: true, Message: 'ok' }),
  ExecuteQuery: vi.fn().mockResolvedValue({ Columns: [], Rows: [] }),
}));

import * as GoApp from '../../wailsjs/go/main/App';

function renderSidebar(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const onTableSelect = overrides.onTableSelect ?? vi.fn();
  const onAddConnection = overrides.onAddConnection ?? vi.fn();
  render(
    <Sidebar
      datasourceId={overrides.datasourceId ?? 'ds1'}
      datasourceName={overrides.datasourceName ?? 'local-pg'}
      datasourceDb={overrides.datasourceDb ?? 'mydb'}
      onTableSelect={onTableSelect}
      onAddConnection={onAddConnection}
    />
  );
  return { onTableSelect, onAddConnection };
}

describe('Sidebar — basic render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([]);
  });

  it('shows "No connection active" when datasourceId is null', () => {
    render(
      <Sidebar
        datasourceId={null}
        onTableSelect={vi.fn()}
        onAddConnection={vi.fn()}
      />
    );
    expect(screen.getByText('No connection active')).toBeInTheDocument();
  });

  it('renders datasource name and db', async () => {
    renderSidebar({ datasourceName: 'prod-db', datasourceDb: 'proddb' });
    expect(screen.getByText('prod-db')).toBeInTheDocument();
    expect(screen.getByText('proddb')).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderSidebar();
    expect(screen.getByTestId('sidebar-search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Find anything…')).toBeInTheDocument();
  });

  it('renders New connection button', () => {
    renderSidebar();
    expect(screen.getByTestId('sidebar-new-connection')).toBeInTheDocument();
  });

  it('New connection button calls onAddConnection', async () => {
    const onAddConnection = vi.fn();
    renderSidebar({ onAddConnection });
    await userEvent.click(screen.getByTestId('sidebar-new-connection'));
    expect(onAddConnection).toHaveBeenCalledOnce();
  });

  it('renders folder rows: queries, schemas', async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByTestId('folder-queries')).toBeInTheDocument());
    expect(screen.getByTestId('folder-schemas')).toBeInTheDocument();
  });
});

describe('Sidebar — schema loading', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls ListSchemas on mount with datasourceId', async () => {
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([]);
    renderSidebar({ datasourceId: 'ds42' });
    await waitFor(() => expect(GoApp.ListSchemas).toHaveBeenCalledWith('ds42'));
  });

  it('does not call ListSchemas when datasourceId is null', async () => {
    render(<Sidebar datasourceId={null} onTableSelect={vi.fn()} onAddConnection={vi.fn()} />);
    await new Promise(r => setTimeout(r, 10));
    expect(GoApp.ListSchemas).not.toHaveBeenCalled();
  });

  it('renders schema rows after load', async () => {
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([
      { name: 'public' } as any,
      { name: 'finance' } as any,
    ]);
    renderSidebar();
    await waitFor(() => expect(screen.getByTestId('schema-row-public')).toBeInTheDocument());
    expect(screen.getByTestId('schema-row-finance')).toBeInTheDocument();
  });

  it('reloads schemas when datasourceId changes', async () => {
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([{ name: 'public' } as any]);
    const { rerender } = render(
      <Sidebar datasourceId="ds1" onTableSelect={vi.fn()} onAddConnection={vi.fn()} />
    );
    await waitFor(() => expect(GoApp.ListSchemas).toHaveBeenCalledWith('ds1'));

    vi.mocked(GoApp.ListSchemas).mockResolvedValue([{ name: 'other' } as any]);
    rerender(
      <Sidebar datasourceId="ds2" onTableSelect={vi.fn()} onAddConnection={vi.fn()} />
    );
    await waitFor(() => expect(GoApp.ListSchemas).toHaveBeenCalledWith('ds2'));
    await waitFor(() => expect(screen.getByTestId('schema-row-other')).toBeInTheDocument());
  });
});

describe('Sidebar — schema expand / table load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([{ name: 'public' } as any]);
    vi.mocked(GoApp.ListTables).mockResolvedValue([
      { name: 'users', type: 'TABLE' } as any,
      { name: 'posts', type: 'TABLE' } as any,
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
    // First click: expand + load
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => screen.getByTestId('table-row-public-users'));
    // Second click: collapse
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => expect(screen.queryByTestId('table-row-public-users')).not.toBeInTheDocument());
  });
});

describe('Sidebar — column load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([{ name: 'public' } as any]);
    vi.mocked(GoApp.ListTables).mockResolvedValue([{ name: 'users', type: 'TABLE' } as any]);
    vi.mocked(GoApp.ListColumns).mockResolvedValue([
      { name: 'id', dataType: 'int4', isNullable: 'NO' } as any,
      { name: 'email', dataType: 'text', isNullable: 'YES' } as any,
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

  it('renders column names after table expand', async () => {
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => screen.getByTestId('table-row-public-users'));
    await userEvent.click(screen.getByTestId('table-row-public-users'));
    await waitFor(() => expect(screen.getByText('id')).toBeInTheDocument());
    expect(screen.getByText('email')).toBeInTheDocument();
  });
});

describe('Sidebar — search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([
      { name: 'public' } as any,
      { name: 'finance' } as any,
    ]);
    vi.mocked(GoApp.ListTables).mockResolvedValue([
      { name: 'users', type: 'TABLE' } as any,
      { name: 'payments', type: 'TABLE' } as any,
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

  it('filters schemas by name (loaded + expanded schemas visible)', async () => {
    // First load schemas, expand public to get tables
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));

    // Search for 'public' — finance should be hidden
    await userEvent.type(screen.getByTestId('sidebar-search'), 'public');
    await waitFor(() => expect(screen.queryByTestId('schema-row-finance')).not.toBeInTheDocument());
    expect(screen.getByTestId('schema-row-public')).toBeInTheDocument();
  });
});

describe('Sidebar — folder expand/collapse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([]);
  });

  it('queries folder is collapsed by default, expands on click', async () => {
    renderSidebar();
    await waitFor(() => screen.getByTestId('folder-queries'));
    expect(screen.queryByText(/Saved queries/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('folder-queries'));
    expect(screen.getByText(/Saved queries/)).toBeInTheDocument();
  });

  it('schemas folder is expanded by default', async () => {
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([{ name: 'public' } as any]);
    renderSidebar();
    await waitFor(() => expect(screen.getByTestId('schema-row-public')).toBeInTheDocument());
  });

  it('schemas folder collapses on click', async () => {
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([{ name: 'public' } as any]);
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('folder-schemas'));
    await waitFor(() => expect(screen.queryByTestId('schema-row-public')).not.toBeInTheDocument());
  });
});

describe('Sidebar — refresh button', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refresh button calls ListSchemas again', async () => {
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([]);
    renderSidebar();
    await waitFor(() => expect(GoApp.ListSchemas).toHaveBeenCalledOnce());
    await userEvent.click(screen.getByTestId('btn-refresh-schemas'));
    await waitFor(() => expect(GoApp.ListSchemas).toHaveBeenCalledTimes(2));
  });
});

describe('Sidebar — views folder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([{ name: 'public' } as any]);
    vi.mocked(GoApp.ListTables).mockResolvedValue([
      { name: 'users', type: 'TABLE' } as any,
      { name: 'user_view', type: 'VIEW' } as any,
    ]);
  });

  it('views folder expands on click', async () => {
    renderSidebar();
    await waitFor(() => screen.getByTestId('folder-views'));
    expect(screen.queryByText(/Expand schemas/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('folder-views'));
    // No schemas loaded yet → shows "Expand schemas to load views"
    expect(screen.getByText(/Expand schemas to load views/)).toBeInTheDocument();
  });

  it('views folder shows view rows after schemas loaded', async () => {
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => screen.getByTestId('table-row-public-user_view'));

    await userEvent.click(screen.getByTestId('folder-views'));
    await waitFor(() => expect(screen.getByTestId('view-row-public-user_view')).toBeInTheDocument());
  });

  it('double-click in views folder calls onTableSelect', async () => {
    const onTableSelect = vi.fn();
    renderSidebar({ onTableSelect });
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => screen.getByTestId('table-row-public-user_view'));
    await userEvent.click(screen.getByTestId('folder-views'));
    await waitFor(() => screen.getByTestId('view-row-public-user_view'));
    await userEvent.dblClick(screen.getByTestId('view-row-public-user_view'));
    expect(onTableSelect).toHaveBeenCalledWith('public', 'user_view');
  });
});

describe('Sidebar — column collapse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([{ name: 'public' } as any]);
    vi.mocked(GoApp.ListTables).mockResolvedValue([{ name: 'users', type: 'TABLE' } as any]);
    vi.mocked(GoApp.ListColumns).mockResolvedValue([
      { name: 'id', dataType: 'int4', isNullable: 'NO' } as any,
    ]);
  });

  it('table collapses on second click after columns loaded', async () => {
    renderSidebar();
    await waitFor(() => screen.getByTestId('schema-row-public'));
    await userEvent.click(screen.getByTestId('schema-row-public'));
    await waitFor(() => screen.getByTestId('table-row-public-users'));
    // First click: expand columns
    await userEvent.click(screen.getByTestId('table-row-public-users'));
    await waitFor(() => expect(screen.getByText('id')).toBeInTheDocument());
    // Second click: collapse
    await userEvent.click(screen.getByTestId('table-row-public-users'));
    await waitFor(() => expect(screen.queryByText('id')).not.toBeInTheDocument());
  });
});
