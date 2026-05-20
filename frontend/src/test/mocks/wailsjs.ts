// Mock for ../../wailsjs/go/main/App — used by vitest via moduleNameMapper / alias
import { vi } from 'vitest';

export const GetAppVersion = vi.fn().mockResolvedValue({ version: 'dev', buildDate: '' });
export const GetConfig = vi.fn().mockResolvedValue({ projects: [], datasources: [] });
export const SaveConfig = vi.fn().mockResolvedValue(undefined);
export const UpdateDatasource = vi.fn().mockResolvedValue(undefined);
export const TestDatasource = vi.fn().mockResolvedValue({ Success: true, Message: 'ok' });
export const ExecuteQuery = vi.fn().mockResolvedValue({ Columns: [], Rows: [] });
export const ListSchemas = vi.fn().mockResolvedValue([]);
export const ListTables = vi.fn().mockResolvedValue([]);
export const ListColumns = vi.fn().mockResolvedValue([]);
export const ListTableKeys = vi.fn().mockResolvedValue([]);
export const ListTableForeignKeys = vi.fn().mockResolvedValue([]);
export const ListTableIndexes = vi.fn().mockResolvedValue([]);
export const ListTableChecks = vi.fn().mockResolvedValue([]);
export const SaveQuery = vi.fn().mockResolvedValue(undefined);
export const ListSavedQueries = vi.fn().mockResolvedValue([]);
export const LoadSavedQuery = vi.fn().mockResolvedValue('SELECT 1;');
export const DeleteSavedQuery = vi.fn().mockResolvedValue(undefined);
export const RenameQuery = vi.fn().mockResolvedValue(undefined);
export const ClosePool = vi.fn().mockResolvedValue(undefined);
export const GetCompletions = vi.fn().mockResolvedValue({ entries: [] });
export const GetCachedMetadata = vi.fn().mockResolvedValue({ schemas: [] });
export const RefreshMetadata = vi.fn().mockResolvedValue({ schemas: [] });
export const RecordHistory = vi.fn().mockResolvedValue(undefined);
export const GetQueryHistory = vi.fn().mockResolvedValue([]);
