import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeEmptyForm } from '../lib/connectionForm';
import { ConnectionGeneralTab } from './ConnectionGeneralTab';

function renderTab(overrides: Partial<Parameters<typeof ConnectionGeneralTab>[0]> = {}) {
  const set = vi.fn();
  const onToggleShowPass = vi.fn();
  render(
    <ConnectionGeneralTab
      form={makeEmptyForm()}
      set={set}
      showPass={false}
      onToggleShowPass={onToggleShowPass}
      isEdit={false}
      {...overrides}
    />
  );
  return { set, onToggleShowPass };
}

describe('ConnectionGeneralTab', () => {
  it('edits empty text fields via set()', async () => {
    const { set } = renderTab();
    // name/username/database start empty, so a single keystroke yields a clean value
    await userEvent.type(screen.getByTestId('field-name'), 'x');
    expect(set).toHaveBeenCalledWith('name', 'x');
    await userEvent.type(screen.getByTestId('field-username'), 'z');
    expect(set).toHaveBeenCalledWith('username', 'z');
    await userEvent.type(screen.getByTestId('field-database'), 'd');
    expect(set).toHaveBeenCalledWith('database', 'd');
  });

  it('edits the host field', async () => {
    const { set } = renderTab({ form: { ...makeEmptyForm(), host: '' } });
    await userEvent.type(screen.getByTestId('field-host'), 'h');
    expect(set).toHaveBeenCalledWith('host', 'h');
  });

  it('coerces the port field to a number', async () => {
    const { set } = renderTab({ form: { ...makeEmptyForm(), port: '' as unknown as number } });
    await userEvent.type(screen.getByTestId('field-port'), '7');
    expect(set).toHaveBeenCalledWith('port', 7);
  });

  it('updates the password field', async () => {
    const { set } = renderTab();
    await userEvent.type(screen.getByTestId('field-password'), 's');
    expect(set).toHaveBeenCalledWith('password', 's');
  });

  it('changes the environment via the select', async () => {
    const { set } = renderTab();
    await userEvent.selectOptions(screen.getByTestId('field-env'), 'prod');
    expect(set).toHaveBeenCalledWith('env', 'prod');
  });

  it('masks the password by default and reveals it on toggle', async () => {
    const { onToggleShowPass } = renderTab();
    expect(screen.getByTestId('field-password')).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByTestId('toggle-password'));
    expect(onToggleShowPass).toHaveBeenCalled();
  });

  it('shows the password as plain text when showPass is true', () => {
    renderTab({ showPass: true });
    expect(screen.getByTestId('field-password')).toHaveAttribute('type', 'text');
  });

  it('shows the Keychain placeholder when editing an existing connection', () => {
    renderTab({ isEdit: true });
    expect(screen.getByTestId('field-password')).toHaveAttribute(
      'placeholder',
      'stored in macOS Keychain — type to change'
    );
  });

  it('shows the enter-password placeholder for a new connection', () => {
    renderTab({ isEdit: false });
    expect(screen.getByTestId('field-password')).toHaveAttribute('placeholder', 'enter password');
  });

  it('derives the connection URL from the form fields', () => {
    renderTab({
      form: {
        ...makeEmptyForm(),
        username: 'me',
        host: 'db.example.com',
        port: 6543,
        database: 'shop',
        sslMode: 'disable',
      },
    });
    expect(
      screen.getByText('postgres://me@db.example.com:6543/shop?sslmode=disable')
    ).toBeInTheDocument();
  });
});
