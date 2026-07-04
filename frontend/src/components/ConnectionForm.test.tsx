import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Datasource } from '../types';
import { ConnectionForm } from './ConnectionForm';

describe('ConnectionForm', () => {
  const defaultProps = {
    initial: {},
    projectId: 'p1',
    onSave: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
    onTest: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all General tab fields', () => {
    render(<ConnectionForm {...defaultProps} />);
    expect(screen.getByTestId('field-name')).toBeInTheDocument();
    expect(screen.getByTestId('field-host')).toBeInTheDocument();
    expect(screen.getByTestId('field-port')).toBeInTheDocument();
    expect(screen.getByTestId('field-database')).toBeInTheDocument();
    expect(screen.getByTestId('field-username')).toBeInTheDocument();
    expect(screen.getByTestId('field-password')).toBeInTheDocument();
    expect(screen.getByTestId('field-env')).toBeInTheDocument();
    // SSL mode is in the SSL tab, not the General tab
  });

  it('pre-populates from initial props', () => {
    render(
      <ConnectionForm
        {...defaultProps}
        initial={{
          name: 'prod-db',
          host: 'db.example.com',
          port: 5433,
          database: 'proddb',
          username: 'admin',
          password: 'pw',
          env: 'prod',
          sslMode: 'require',
        }}
      />
    );
    expect(screen.getByTestId('field-name')).toHaveValue('prod-db');
    expect(screen.getByTestId('field-host')).toHaveValue('db.example.com');
    expect(screen.getByTestId('field-database')).toHaveValue('proddb');
    expect(screen.getByTestId('field-env')).toHaveValue('prod');
    // sslMode is stored in form state but field-ssl is on SSL tab
  });

  it('Save button disabled when name empty', () => {
    render(<ConnectionForm {...defaultProps} initial={{ host: 'localhost', database: 'db' }} />);
    expect(screen.getByTestId('btn-save')).toBeDisabled();
  });

  it('Save button enabled when name + host + database filled', async () => {
    render(<ConnectionForm {...defaultProps} />);
    await userEvent.type(screen.getByTestId('field-name'), 'myconn');
    await userEvent.type(screen.getByTestId('field-database'), 'mydb');
    expect(screen.getByTestId('btn-save')).not.toBeDisabled();
  });

  it('Cancel calls onCancel', async () => {
    const onCancel = vi.fn();
    render(<ConnectionForm {...defaultProps} onCancel={onCancel} />);
    await userEvent.click(screen.getByTestId('btn-cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('Save calls onSave with complete datasource', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ConnectionForm
        {...defaultProps}
        onSave={onSave}
        initial={{ name: 'myconn', host: 'localhost', database: 'mydb' }}
      />
    );
    await userEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const saved = onSave.mock.calls[0][0] as Datasource;
    expect(saved.projectId).toBe('p1');
    expect(saved.name).toBe('myconn');
    expect(saved.database).toBe('mydb');
  });

  it('shows save error when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('save failed'));
    render(
      <ConnectionForm
        {...defaultProps}
        onSave={onSave}
        initial={{ name: 'myconn', host: 'localhost', database: 'mydb' }}
      />
    );
    await userEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() => expect(screen.getByTestId('save-error')).toBeInTheDocument());
    expect(screen.getByTestId('save-error')).toHaveTextContent('save failed');
  });

  it('Test button calls onTest with form values', async () => {
    const onTest = vi.fn().mockResolvedValue({ success: true, message: '12ms' });
    render(
      <ConnectionForm
        {...defaultProps}
        onTest={onTest}
        initial={{ host: 'myhost', database: 'mydb', sslMode: 'require' }}
      />
    );
    await userEvent.click(screen.getByTestId('btn-test'));
    await waitFor(() => expect(onTest).toHaveBeenCalledOnce());
    const arg = onTest.mock.calls[0][0] as Partial<Datasource>;
    expect(arg.host).toBe('myhost');
    expect(arg.database).toBe('mydb');
    expect(arg.sslMode).toBe('require');
  });

  it('shows success test result', async () => {
    const onTest = vi.fn().mockResolvedValue({ success: true, message: '8ms' });
    render(
      <ConnectionForm {...defaultProps} onTest={onTest} initial={{ host: 'h', database: 'db' }} />
    );
    await userEvent.click(screen.getByTestId('btn-test'));
    await waitFor(() => expect(screen.getByTestId('test-result')).toBeInTheDocument());
    expect(screen.getByTestId('test-result')).toHaveTextContent('Connection succeeded');
  });

  it('shows failure test result', async () => {
    const onTest = vi.fn().mockResolvedValue({ success: false, message: 'refused' });
    render(
      <ConnectionForm {...defaultProps} onTest={onTest} initial={{ host: 'h', database: 'db' }} />
    );
    await userEvent.click(screen.getByTestId('btn-test'));
    await waitFor(() => expect(screen.getByTestId('test-result')).toBeInTheDocument());
    expect(screen.getByTestId('test-result')).toHaveTextContent('Connection failed');
  });

  it('toggles password visibility', async () => {
    render(<ConnectionForm {...defaultProps} />);
    const pw = screen.getByTestId('field-password');
    expect(pw).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByTestId('toggle-password'));
    expect(pw).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByTestId('toggle-password'));
    expect(pw).toHaveAttribute('type', 'password');
  });

  it('Test button disabled when host or database empty', () => {
    render(<ConnectionForm {...defaultProps} initial={{ host: '' }} />);
    expect(screen.getByTestId('btn-test')).toBeDisabled();
  });

  it('shows connection name in name field for existing datasource', () => {
    render(<ConnectionForm {...defaultProps} initial={{ id: 'd1', name: 'existing' }} />);
    expect(screen.getByTestId('field-name')).toHaveValue('existing');
  });

  it('shows New Data Source heading for new datasource', () => {
    render(<ConnectionForm {...defaultProps} initial={{}} />);
    expect(screen.getByText('New Data Source')).toBeInTheDocument();
  });

  it('Options tab shows placeholder; SSL tab shows ssl field', async () => {
    render(<ConnectionForm {...defaultProps} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Options' }));
    expect(screen.getByText(/Not yet implemented/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'SSL' }));
    expect(screen.getByTestId('field-ssl')).toBeInTheDocument();
  });

  it('URL preview updates as host/port/db change', async () => {
    render(<ConnectionForm {...defaultProps} initial={{ username: 'usr' }} />);
    await userEvent.clear(screen.getByTestId('field-host'));
    await userEvent.type(screen.getByTestId('field-host'), 'myserver');
    expect(screen.getByText(/myserver/)).toBeInTheDocument();
  });

  it('Apply button calls onApply with current form values', async () => {
    const onApply = vi.fn().mockResolvedValue(undefined);
    render(
      <ConnectionForm
        {...defaultProps}
        onApply={onApply}
        initial={{ name: 'myconn', host: 'localhost', database: 'mydb' }}
      />
    );
    await userEvent.click(screen.getByTestId('btn-apply'));
    await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
    const applied = onApply.mock.calls[0][0] as Datasource;
    expect(applied.name).toBe('myconn');
    expect(applied.database).toBe('mydb');
  });

  it('Cancel and Apply disabled initially when editing existing datasource', () => {
    render(
      <ConnectionForm
        {...defaultProps}
        onApply={vi.fn().mockResolvedValue(undefined)}
        initial={{ id: 'd1', name: 'myconn', host: 'localhost', database: 'mydb' }}
      />
    );
    expect(screen.getByTestId('btn-cancel')).toBeDisabled();
    expect(screen.getByTestId('btn-apply')).toBeDisabled();
  });

  it('Cancel and Apply enabled after editing a field', async () => {
    render(
      <ConnectionForm
        {...defaultProps}
        onApply={vi.fn().mockResolvedValue(undefined)}
        initial={{ id: 'd1', name: 'myconn', host: 'localhost', database: 'mydb' }}
      />
    );
    await userEvent.clear(screen.getByTestId('field-name'));
    await userEvent.type(screen.getByTestId('field-name'), 'changed');
    expect(screen.getByTestId('btn-cancel')).not.toBeDisabled();
    expect(screen.getByTestId('btn-apply')).not.toBeDisabled();
  });

  it('Apply disables Cancel and Apply again after success', async () => {
    const onApply = vi.fn().mockResolvedValue(undefined);
    render(
      <ConnectionForm
        {...defaultProps}
        onApply={onApply}
        initial={{ id: 'd1', name: 'myconn', host: 'localhost', database: 'mydb' }}
      />
    );
    await userEvent.clear(screen.getByTestId('field-name'));
    await userEvent.type(screen.getByTestId('field-name'), 'changed');
    await userEvent.click(screen.getByTestId('btn-apply'));
    await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
    expect(screen.getByTestId('btn-cancel')).toBeDisabled();
    expect(screen.getByTestId('btn-apply')).toBeDisabled();
  });

  it('Cancel always enabled for new datasource (isNew)', () => {
    render(
      <ConnectionForm
        {...defaultProps}
        onApply={vi.fn().mockResolvedValue(undefined)}
        initial={{}}
      />
    );
    expect(screen.getByTestId('btn-cancel')).not.toBeDisabled();
  });

  it('calls onDirtyChange(true) when a field is edited on existing ds', async () => {
    const onDirtyChange = vi.fn();
    render(
      <ConnectionForm
        {...defaultProps}
        onDirtyChange={onDirtyChange}
        initial={{ id: 'd1', name: 'myconn', host: 'localhost', database: 'mydb' }}
      />
    );
    await userEvent.clear(screen.getByTestId('field-name'));
    await userEvent.type(screen.getByTestId('field-name'), 'x');
    await waitFor(() => expect(onDirtyChange).toHaveBeenCalledWith(true));
  });

  it('calls onDirtyChange(false) after Apply resets the baseline', async () => {
    const onDirtyChange = vi.fn();
    const onApply = vi.fn().mockResolvedValue(undefined);
    render(
      <ConnectionForm
        {...defaultProps}
        onApply={onApply}
        onDirtyChange={onDirtyChange}
        initial={{ id: 'd1', name: 'myconn', host: 'localhost', database: 'mydb' }}
      />
    );
    await userEvent.clear(screen.getByTestId('field-name'));
    await userEvent.type(screen.getByTestId('field-name'), 'changed');
    await waitFor(() => expect(onDirtyChange).toHaveBeenCalledWith(true));
    await userEvent.click(screen.getByTestId('btn-apply'));
    await waitFor(() => expect(onDirtyChange).toHaveBeenCalledWith(false));
  });
});
