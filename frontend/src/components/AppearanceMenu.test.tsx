import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY } from '../lib/theme';
import { AppearanceMenu } from './AppearanceMenu';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => localStorage.clear());

describe('AppearanceMenu', () => {
  it('is closed until the button is clicked', () => {
    render(<AppearanceMenu />);
    expect(screen.queryByTestId('appearance-menu')).toBeNull();
    fireEvent.click(screen.getByTestId('appearance-button'));
    expect(screen.getByTestId('appearance-menu')).toBeInTheDocument();
  });

  it('marks the stored mode as checked', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<AppearanceMenu />);
    fireEvent.click(screen.getByTestId('appearance-button'));
    expect(screen.getByTestId('appearance-light')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('appearance-dark')).toHaveAttribute('aria-checked', 'false');
  });

  it('choosing Light applies the theme, persists it and closes the menu', () => {
    render(<AppearanceMenu />);
    fireEvent.click(screen.getByTestId('appearance-button'));
    fireEvent.click(screen.getByTestId('appearance-light'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(screen.queryByTestId('appearance-menu')).toBeNull();
  });

  it('choosing Dark removes the light override', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<AppearanceMenu />);
    fireEvent.click(screen.getByTestId('appearance-button'));
    fireEvent.click(screen.getByTestId('appearance-dark'));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('closes on Escape and on an outside click', () => {
    render(<AppearanceMenu />);
    fireEvent.click(screen.getByTestId('appearance-button'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('appearance-menu')).toBeNull();
    fireEvent.click(screen.getByTestId('appearance-button'));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('appearance-menu')).toBeNull();
  });

  it('selects an option with the keyboard', () => {
    render(<AppearanceMenu />);
    fireEvent.click(screen.getByTestId('appearance-button'));
    fireEvent.keyDown(screen.getByTestId('appearance-light'), { key: 'Enter' });
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });
});
