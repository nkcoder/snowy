// Mock for ../../wailsjs/go/main/App — used by vitest via moduleNameMapper / alias
import { vi } from 'vitest';

export const GetConfig = vi.fn().mockResolvedValue({ projects: [], datasources: [] });
export const SaveConfig = vi.fn().mockResolvedValue(undefined);
export const UpdateDatasource = vi.fn().mockResolvedValue(undefined);
export const TestDatasource = vi.fn().mockResolvedValue({ Success: true, Message: 'ok' });
export const ExecuteQuery = vi.fn().mockResolvedValue({ Columns: [], Rows: [] });
export const ListSchemas = vi.fn().mockResolvedValue([]);
export const ListTables = vi.fn().mockResolvedValue([]);
export const ListColumns = vi.fn().mockResolvedValue([]);
export const SaveQuery = vi.fn().mockResolvedValue(undefined);
export const ListSavedQueries = vi.fn().mockResolvedValue([]);
export const LoadSavedQuery = vi.fn().mockResolvedValue('SELECT 1;');
export const DeleteSavedQuery = vi.fn().mockResolvedValue(undefined);
export const RenameQuery = vi.fn().mockResolvedValue(undefined);
