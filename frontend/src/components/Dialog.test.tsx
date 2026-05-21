import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog, InputDialog } from './Dialog';

describe('InputDialog', () => {
  it('renders the title', () => {
    render(<InputDialog title="Save Query" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Save Query')).toBeTruthy();
  });

  it('calls onConfirm with trimmed value on Enter', () => {
    const onConfirm = vi.fn();
    render(
      <InputDialog title="Name" defaultValue="  hello  " onConfirm={onConfirm} onCancel={vi.fn()} />
    );
    fireEvent.keyDown(screen.getByRole('textbox').parentElement!, {
      key: 'Enter',
      code: 'Enter',
    });
    expect(onConfirm).toHaveBeenCalledWith('hello');
  });

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn();
    render(<InputDialog title="Name" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole('textbox').parentElement!, {
      key: 'Escape',
    });
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<InputDialog title="Name" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('confirm button is disabled when value is empty', () => {
    render(<InputDialog title="Name" defaultValue="" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const saveBtn = screen.getByText('Save');
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('confirm button calls onConfirm when value is present', () => {
    const onConfirm = vi.fn();
    render(
      <InputDialog
        title="Name"
        defaultValue="myfile"
        confirmLabel="OK"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('OK'));
    expect(onConfirm).toHaveBeenCalledWith('myfile');
  });

  it('updates value on input change', () => {
    const onConfirm = vi.fn();
    render(<InputDialog title="Name" onConfirm={onConfirm} onCancel={vi.fn()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'new_name' } });
    fireEvent.keyDown(input.parentElement!, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledWith('new_name');
  });

  it('does not call onConfirm on Enter when value is whitespace only', () => {
    const onConfirm = vi.fn();
    render(
      <InputDialog title="Name" defaultValue="   " onConfirm={onConfirm} onCancel={vi.fn()} />
    );
    fireEvent.keyDown(screen.getByRole('textbox').parentElement!.parentElement!, {
      key: 'Enter',
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renders custom placeholder', () => {
    render(
      <InputDialog
        title="Name"
        placeholder="Enter filename"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.placeholder).toBe('Enter filename');
  });
});

describe('ConfirmDialog', () => {
  it('renders the message', () => {
    render(<ConfirmDialog message="Are you sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Are you sure?')).toBeTruthy();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog message="Close tab?" onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Close anyway'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog message="Close tab?" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onConfirm on Enter key', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog message="Close tab?" onConfirm={onConfirm} onCancel={vi.fn()} />);
    const box = screen.getByText('Close anyway').closest('div[class]')!;
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel on Escape key', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog message="Close?" onConfirm={vi.fn()} onCancel={onCancel} />);
    const box = screen.getByText('Close anyway').closest('div[class]')!;
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('renders custom confirm label', () => {
    render(
      <ConfirmDialog
        message="Delete?"
        confirmLabel="Yes, delete"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Yes, delete')).toBeTruthy();
  });
});
