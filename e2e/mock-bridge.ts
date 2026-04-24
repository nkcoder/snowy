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
  ],
};

export const mockCompletions = {
  entries: [
    // Schemas
    { kind: 'schema', schema: '', table: '', name: 'public', dataType: '' },
    // Tables
    { kind: 'table', schema: 'public', table: '', name: 'users', dataType: '' },
    { kind: 'table', schema: 'public', table: '', name: 'accounts', dataType: '' },
    { kind: 'table', schema: 'public', table: '', name: 'transactions', dataType: '' },
    { kind: 'table', schema: 'public', table: '', name: 'audit_logs', dataType: '' },
    // users columns
    { kind: 'column', schema: 'public', table: 'users', name: 'user_id', dataType: 'integer' },
    { kind: 'column', schema: 'public', table: 'users', name: 'first_name', dataType: 'character varying' },
    { kind: 'column', schema: 'public', table: 'users', name: 'last_name', dataType: 'character varying' },
    { kind: 'column', schema: 'public', table: 'users', name: 'email', dataType: 'character varying' },
    { kind: 'column', schema: 'public', table: 'users', name: 'created_at', dataType: 'timestamp with time zone' },
    // accounts columns
    { kind: 'column', schema: 'public', table: 'accounts', name: 'account_id', dataType: 'integer' },
    { kind: 'column', schema: 'public', table: 'accounts', name: 'user_id', dataType: 'integer' },
    { kind: 'column', schema: 'public', table: 'accounts', name: 'balance', dataType: 'numeric' },
    // transactions columns
    { kind: 'column', schema: 'public', table: 'transactions', name: 'transaction_id', dataType: 'integer' },
    { kind: 'column', schema: 'public', table: 'transactions', name: 'amount', dataType: 'numeric' },
    { kind: 'column', schema: 'public', table: 'transactions', name: 'created_at', dataType: 'timestamp with time zone' },
  ],
};

export const mockQueryResult = {
  columns: ['user_id', 'first_name', 'last_name', 'email'],
  rows: [
    [1, 'Alice', 'Smith', 'alice@example.com'],
    [2, 'Bob', 'Jones', 'bob@example.com'],
  ],
};

/**
 * Returns the JS to inject into the page that sets up window.go mock.
 * This must be a serializable string (no closures over external vars).
 */
export function buildMockBridgeScript(config: object, completions: object, queryResult: object): string {
  return `
    const _config = ${JSON.stringify(config)};
    const _completions = ${JSON.stringify(completions)};
    const _queryResult = ${JSON.stringify(queryResult)};
    const _savedQueries = [];
    const _savedQueryData = {};

    window.go = {
      main: {
        App: {
          GetConfig: () => Promise.resolve(_config),
          SaveConfig: () => Promise.resolve(),
          UpdateDatasource: () => Promise.resolve(),
          TestDatasource: () => Promise.resolve({ Success: true, Message: 'Connection successful' }),
          GetCompletions: () => Promise.resolve(_completions),
          ListSchemas: () => Promise.resolve([{ name: 'public' }]),
          ListTables: () => Promise.resolve([
            { schema: 'public', name: 'users', type: 'BASE TABLE' },
            { schema: 'public', name: 'accounts', type: 'BASE TABLE' },
            { schema: 'public', name: 'transactions', type: 'BASE TABLE' },
            { schema: 'public', name: 'audit_logs', type: 'BASE TABLE' },
          ]),
          ListColumns: (dsId, schema, table) => {
            const cols = {
              users: [
                { name: 'user_id', dataType: 'integer', isNullable: 'NO' },
                { name: 'first_name', dataType: 'character varying', isNullable: 'NO' },
                { name: 'email', dataType: 'character varying', isNullable: 'NO' },
              ],
              accounts: [
                { name: 'account_id', dataType: 'integer', isNullable: 'NO' },
                { name: 'balance', dataType: 'numeric', isNullable: 'YES' },
              ],
            };
            return Promise.resolve(cols[table] || []);
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
        },
      },
    };
    console.log('[mock-bridge] window.go installed');
  `;
}
