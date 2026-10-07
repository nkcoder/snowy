import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, readStoredMode, resolveTheme, storeMode, THEME_STORAGE_KEY } from './theme';

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  vi.restoreAllMocks();
});

describe('resolveTheme', () => {
  it('returns the explicit mode when it is not "system"', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('follows the OS appearance in system mode', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('readStoredMode / storeMode', () => {
  it('defaults to system when nothing (or junk) is stored', () => {
    expect(readStoredMode()).toBe('system');
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(readStoredMode()).toBe('system');
  });

  it('round-trips a valid mode', () => {
    storeMode('light');
    expect(readStoredMode()).toBe('light');
  });

  it('falls back to system when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredMode()).toBe('system');
  });

  it('does not throw when storing fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => storeMode('dark')).not.toThrow();
  });
});

describe('applyTheme', () => {
  it('sets data-theme="light" for light', () => {
    applyTheme('light', false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('removes the attribute for dark so :root (SnowyDark) applies', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    applyTheme('dark', false);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('resolves system mode against the OS preference', () => {
    applyTheme('system', false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    applyTheme('system', true);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
