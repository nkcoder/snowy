import type { Datasource } from '../types';

export function makeEmptyForm(): Omit<Datasource, 'id' | 'projectId'> {
  return {
    name: '',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    env: 'local',
    sslMode: 'require',
  };
}

export interface ConnectionFormValidity {
  /** Required fields for saving are present (name, host, database). */
  canSave: boolean;
  /** Required fields for a test connection are present (host, database). */
  canTest: boolean;
}

// Pure field-presence validation for the connection form. UI state such as
// in-flight saving/testing is combined by the caller, keeping this testable.
export function getConnectionFormValidity(
  form: Pick<Datasource, 'name' | 'host' | 'database'>
): ConnectionFormValidity {
  const hasHost = !!form.host;
  const hasDatabase = !!form.database;
  return {
    canSave: !!form.name && hasHost && hasDatabase,
    canTest: hasHost && hasDatabase,
  };
}
