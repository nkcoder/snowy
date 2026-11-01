// Aliased over frontend/src/backend/app.ts in e2e mode (see frontend/vite.config.ts).
// The v3 bindings call the Wails runtime, so the browser tests route them to the
// window.go mock installed by mock-bridge.ts instead. Looked up per call because
// specs patch window.go after load.
type Bindings = typeof import('../frontend/bindings/snowy/app');

declare global {
  interface Window {
    go: { main: { App: Bindings } };
  }
}

const call =
  <K extends keyof Bindings>(name: K): Bindings[K] =>
  ((...args: unknown[]) =>
    (window.go.main.App[name] as (...a: unknown[]) => unknown)(...args)) as Bindings[K];

export const ClearHistory = call('ClearHistory');
export const ClosePool = call('ClosePool');
export const DeleteSavedQuery = call('DeleteSavedQuery');
export const ExecuteQuery = call('ExecuteQuery');
export const ExportCSV = call('ExportCSV');
export const GetAppVersion = call('GetAppVersion');
export const GetCachedMetadata = call('GetCachedMetadata');
export const GetCompletions = call('GetCompletions');
export const GetConfig = call('GetConfig');
export const GetQueryHistory = call('GetQueryHistory');
export const ListColumns = call('ListColumns');
export const ListSavedQueries = call('ListSavedQueries');
export const ListSchemas = call('ListSchemas');
export const ListTableChecks = call('ListTableChecks');
export const ListTableForeignKeys = call('ListTableForeignKeys');
export const ListTableIndexes = call('ListTableIndexes');
export const ListTableKeys = call('ListTableKeys');
export const ListTables = call('ListTables');
export const LoadSavedQuery = call('LoadSavedQuery');
export const PingDatasource = call('PingDatasource');
export const RecordHistory = call('RecordHistory');
export const RefreshMetadata = call('RefreshMetadata');
export const RenameQuery = call('RenameQuery');
export const SaveConfig = call('SaveConfig');
export const SaveQuery = call('SaveQuery');
export const TestDatasource = call('TestDatasource');
export const UpdateDatasource = call('UpdateDatasource');
