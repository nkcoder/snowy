/**
 * Mock window.go bridge for e2e tests.
 * Simulates the Wails Go backend with realistic data
 * matching the demo PostgreSQL database.
 */

export const mockConfig = {
  projects: [{ id: 'proj-1', name: 'Demo Project' }],
  datasources: [
    {
      id: 'ds-1',
      name: 'Demo DB',
      host: 'localhost',
      port: 5432,
      database: 'mydatabase',
      username: 'myuser',
      password: 'mypassword',
      projectId: 'proj-1',
      env: 'local',
      sslMode: 'disable',
    },
    {
      id: 'ds-2',
      name: 'Reporting DB',
      host: 'localhost',
      port: 5432,
      database: 'reporting',
      username: 'myuser',
      password: 'mypassword',
      projectId: 'proj-1',
      env: 'local',
      sslMode: 'disable',
    },
    {
      id: 'ds-3',
      name: 'Cold DB',
      host: 'localhost',
      port: 5432,
      database: 'cold',
      username: 'myuser',
      password: 'mypassword',
      projectId: 'proj-1',
      env: 'local',
      sslMode: 'disable',
    },
  ],
};

// ── Column definitions — single source of truth ───────────────────────────────
// Used to derive both mockCompletions entries and mockMetadata (RefreshMetadata /
// ListColumns), so the two never drift apart.

const USERS_COLS = [
  { name: 'user_id',    dataType: 'integer',                  isNullable: 'NO',  default: "nextval('users_user_id_seq'::regclass)", keyType: 'pk' },
  { name: 'first_name', dataType: 'varchar(50)',              isNullable: 'NO',  default: '', keyType: '' },
  { name: 'last_name',  dataType: 'varchar(50)',              isNullable: 'NO',  default: '', keyType: '' },
  { name: 'email',      dataType: 'varchar(100)',             isNullable: 'NO',  default: '', keyType: '' },
  { name: 'created_at', dataType: 'timestamp with time zone', isNullable: 'NO',  default: 'CURRENT_TIMESTAMP', keyType: '' },
];

const ACCOUNTS_COLS = [
  { name: 'account_id', dataType: 'integer',       isNullable: 'NO',  default: "nextval('accounts_account_id_seq'::regclass)", keyType: 'pk' },
  { name: 'user_id',    dataType: 'integer',       isNullable: 'NO',  default: '', keyType: 'fk' },
  { name: 'balance',    dataType: 'numeric(15,2)', isNullable: 'YES', default: '0.00', keyType: '' },
];

const TRANSACTIONS_COLS = [
  { name: 'transaction_id', dataType: 'integer',                  isNullable: 'NO', default: "nextval('transactions_transaction_id_seq'::regclass)", keyType: 'pk' },
  { name: 'amount',         dataType: 'numeric(15,2)',            isNullable: 'NO', default: '', keyType: '' },
  { name: 'created_at',     dataType: 'timestamp with time zone', isNullable: 'NO', default: 'CURRENT_TIMESTAMP', keyType: '' },
];

// Full schema metadata — serialised into the injected script so RefreshMetadata
// and ListColumns always reflect the same data as mockCompletions.
const mockMetadata = {
  schemas: [
    {
      name: 'public',
      tables: [
        {
          name: 'users', type: 'BASE TABLE', columns: USERS_COLS,
          keys: [{ name: 'users_pkey', columns: 'user_id' }],
          foreignKeys: [],
          indexes: [{ name: 'users_email_key', isUnique: true, columns: 'email' }],
          checks: [],
        },
        {
          name: 'accounts', type: 'BASE TABLE', columns: ACCOUNTS_COLS,
          keys: [{ name: 'accounts_pkey', columns: 'account_id' }],
          foreignKeys: [{ name: 'accounts_user_id_fkey', columns: 'user_id', refSchema: 'public', refTable: 'users', refColumns: 'user_id' }],
          indexes: [],
          checks: [{ name: 'accounts_balance_check', definition: 'balance >= 0' }],
        },
        {
          name: 'transactions', type: 'BASE TABLE', columns: TRANSACTIONS_COLS,
          keys: [{ name: 'transactions_pkey', columns: 'transaction_id' }],
          foreignKeys: [], indexes: [], checks: [],
        },
        { name: 'audit_logs', type: 'BASE TABLE', columns: [], keys: [], foreignKeys: [], indexes: [], checks: [] },
      ],
    },
  ],
};

// Cached metadata for the non-active ds-2. Uses a distinct schema name so its
// tree rows don't collide with the active connection's `public` schema when a
// test single-clicks ds-2 to browse it from cache.
const mockMetadataDs2 = {
  schemas: [
    {
      name: 'reporting',
      tables: [
        { name: 'sales', type: 'BASE TABLE', columns: [], keys: [], foreignKeys: [], indexes: [], checks: [] },
      ],
    },
  ],
};

function colEntries(table: string, cols: Array<{ name: string; dataType: string; keyType: string }>) {
  return cols.map(c => ({ kind: 'column', schema: 'public', table, name: c.name, dataType: c.dataType, keyType: c.keyType }));
}

export const mockCompletions = {
  entries: [
    { kind: 'schema', schema: '',       table: '', name: 'public',       dataType: '' },
    { kind: 'table',  schema: 'public', table: '', name: 'users',        dataType: '' },
    { kind: 'table',  schema: 'public', table: '', name: 'accounts',     dataType: '' },
    { kind: 'table',  schema: 'public', table: '', name: 'transactions', dataType: '' },
    { kind: 'table',  schema: 'public', table: '', name: 'audit_logs',   dataType: '' },
    ...colEntries('users',        USERS_COLS),
    ...colEntries('accounts',     ACCOUNTS_COLS),
    ...colEntries('transactions', TRANSACTIONS_COLS),
  ],
};

export const mockQueryResult = {
  columns: ['user_id', 'first_name', 'last_name', 'email'],
  rows: [
    [1, 'Alice', 'Smith', 'alice@example.com'],
    [2, 'Bob', 'Jones', 'bob@example.com'],
  ],
  durationMs: 42,
  rowCount: 2,
};

export const mockHistoryEntries = [
  {
    id: '1',
    sql: 'SELECT * FROM users LIMIT 10;',
    rowCount: 10,
    durationMs: 35,
    executedAt: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: '2',
    sql: 'SELECT count(*) FROM accounts;',
    rowCount: 1,
    durationMs: 12,
    executedAt: new Date(Date.now() - 300000).toISOString(),
  },
];

/**
 * Returns the JS to inject into the page that sets up window.go mock.
 * This must be a serializable string (no closures over external vars).
 */
export function buildMockBridgeScript(
  config: object,
  completions: object,
  queryResult: object,
  historyEntries: object[] = [],
): string {
  return `
    const _config = ${JSON.stringify(config)};
    const _completions = ${JSON.stringify(completions)};
    const _queryResult = ${JSON.stringify(queryResult)};
    const _historyEntries = ${JSON.stringify(historyEntries)};
    const _metadata = ${JSON.stringify(mockMetadata)};
    const _metadataDs2 = ${JSON.stringify(mockMetadataDs2)};
    const _savedQueries = [];
    const _savedQueryData = {};
    const _recordedHistory = [];

    window.runtime = {
      EventsOnMultiple: () => {},
      EventsOff: () => {},
      EventsOffAll: () => {},
      EventsEmit: () => {},
    };

    window.go = {
      main: {
        App: {
          GetConfig: () => Promise.resolve(_config),
          GetAppVersion: () => Promise.resolve({ version: 'dev', buildDate: '' }),
          GetCachedMetadata: (dsId) => Promise.resolve(dsId === 'ds-2' ? _metadataDs2 : null),
          RefreshMetadata: () => Promise.resolve(_metadata),
          SaveConfig: () => Promise.resolve(),
          UpdateDatasource: () => Promise.resolve(),
          TestDatasource: () => Promise.resolve({ Success: true, Message: 'Connection successful' }),
          PingDatasource: () => Promise.resolve({ Success: true, Message: 'Connection successful' }),
          GetCompletions: () => Promise.resolve(_completions),
          ListSchemas: () => Promise.resolve(
            _metadata.schemas.map(s => ({ name: s.name }))
          ),
          ListTables: (dsId, schema) => Promise.resolve(
            (_metadata.schemas.find(s => s.name === schema) ?? _metadata.schemas[0])
              .tables.map(t => ({ schema, name: t.name, type: t.type }))
          ),
          ListColumns: (dsId, schema, table) => {
            const s = _metadata.schemas.find(s => s.name === schema) ?? _metadata.schemas[0];
            const t = s.tables.find(t => t.name === table);
            return Promise.resolve(t ? t.columns : []);
          },
          ExecuteQuery: () => Promise.resolve(_queryResult),
          SaveQuery: (dsId, filename, sql) => {
            const key = filename.endsWith('.sql') ? filename : filename + '.sql';
            _savedQueryData[key] = sql;
            if (!_savedQueries.find(q => q.filename === key)) {
              _savedQueries.push({ filename: key });
            }
            return Promise.resolve();
          },
          ListSavedQueries: () => Promise.resolve([..._savedQueries]),
          LoadSavedQuery: (dsId, filename) => Promise.resolve(_savedQueryData[filename] || ''),
          DeleteSavedQuery: (dsId, filename) => {
            const idx = _savedQueries.findIndex(q => q.filename === filename);
            if (idx >= 0) _savedQueries.splice(idx, 1);
            delete _savedQueryData[filename];
            return Promise.resolve();
          },
          RenameQuery: (dsId, oldName, newName) => {
            const q = _savedQueries.find(q => q.filename === oldName);
            if (q) q.filename = newName;
            _savedQueryData[newName] = _savedQueryData[oldName];
            delete _savedQueryData[oldName];
            return Promise.resolve();
          },
          RecordHistory: (dsId, sql, rowCount, durationMs) => {
            _recordedHistory.push({ dsId, sql, rowCount, durationMs });
            window.__recordedHistory = _recordedHistory;
            return Promise.resolve();
          },
          GetQueryHistory: (dsId, limit) => {
            return Promise.resolve(_historyEntries.slice(0, limit));
          },
          ListTableKeys: (dsId, schema, table) => {
            const s = _metadata.schemas.find(s => s.name === schema) ?? _metadata.schemas[0];
            const t = s.tables.find(t => t.name === table);
            return Promise.resolve(t ? t.keys : []);
          },
          ListTableForeignKeys: (dsId, schema, table) => {
            const s = _metadata.schemas.find(s => s.name === schema) ?? _metadata.schemas[0];
            const t = s.tables.find(t => t.name === table);
            return Promise.resolve(t ? t.foreignKeys : []);
          },
          ListTableIndexes: (dsId, schema, table) => {
            const s = _metadata.schemas.find(s => s.name === schema) ?? _metadata.schemas[0];
            const t = s.tables.find(t => t.name === table);
            return Promise.resolve(t ? t.indexes : []);
          },
          ListTableChecks: (dsId, schema, table) => {
            const s = _metadata.schemas.find(s => s.name === schema) ?? _metadata.schemas[0];
            const t = s.tables.find(t => t.name === table);
            return Promise.resolve(t ? t.checks : []);
          },
        },
      },
    };
    window.__recordedHistory = _recordedHistory;
    console.log('[mock-bridge] window.go installed');
  `;
}
