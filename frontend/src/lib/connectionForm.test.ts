import { describe, expect, it } from 'vitest';
import { getConnectionFormValidity, makeEmptyForm } from './connectionForm';

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

describe('getConnectionFormValidity', () => {
  it('canSave is true only when name, host, and database are all present', () => {
    expect(getConnectionFormValidity({ name: 'c', host: 'h', database: 'db' }).canSave).toBe(true);
  });

  it('canSave is false when name is empty', () => {
    expect(getConnectionFormValidity({ name: '', host: 'h', database: 'db' }).canSave).toBe(false);
  });

  it('canSave is false when host is empty', () => {
    expect(getConnectionFormValidity({ name: 'c', host: '', database: 'db' }).canSave).toBe(false);
  });

  it('canSave is false when database is empty', () => {
    expect(getConnectionFormValidity({ name: 'c', host: 'h', database: '' }).canSave).toBe(false);
  });

  it('canTest is true when host and database are present, even without a name', () => {
    expect(getConnectionFormValidity({ name: '', host: 'h', database: 'db' }).canTest).toBe(true);
  });

  it('canTest is false when host is empty', () => {
    expect(getConnectionFormValidity({ name: 'c', host: '', database: 'db' }).canTest).toBe(false);
  });

  it('canTest is false when database is empty', () => {
    expect(getConnectionFormValidity({ name: 'c', host: 'h', database: '' }).canTest).toBe(false);
  });
});
