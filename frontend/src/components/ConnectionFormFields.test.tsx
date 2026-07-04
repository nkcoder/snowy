import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FieldInput, SelectInput } from './ConnectionFormFields';

describe('FieldInput', () => {
  it('renders with value', () => {
    render(<FieldInput value="hello" />);
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
  });

  it('calls onChange with new value', async () => {
    const onChange = vi.fn();
    render(<FieldInput value="" onChange={onChange} data-testid="fi" />);
    await userEvent.type(screen.getByTestId('fi'), 'x');
    expect(onChange).toHaveBeenCalledWith('x');
  });

  it('is readonly when readOnly=true', () => {
    render(<FieldInput value="locked" readOnly data-testid="fi" />);
    expect(screen.getByTestId('fi')).toHaveAttribute('readonly');
  });
});

describe('SelectInput', () => {
  it('renders all options', () => {
    render(
      <SelectInput
        value="a"
        onChange={vi.fn()}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
      />
    );
    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'B' })).toBeInTheDocument();
  });

  it('calls onChange when changed', async () => {
    const onChange = vi.fn();
    render(
      <SelectInput
        value="a"
        onChange={onChange}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        data-testid="sel"
      />
    );
    await userEvent.selectOptions(screen.getByTestId('sel'), 'b');
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
