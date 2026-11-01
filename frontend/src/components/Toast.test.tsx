import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../backend/events', () => {
  type Handler = (payload: unknown) => void;
  const handlers: Handler[] = [];
  return {
    onNotification: vi.fn((cb: Handler) => {
      handlers.push(cb);
      return () => {
        handlers.splice(handlers.indexOf(cb), 1);
      };
    }),
    __handlers: handlers,
  };
});

import * as events from '../backend/events';
import { Toast } from './Toast';

const handlers = (events as unknown as { __handlers: Array<(p: unknown) => void> }).__handlers;

const emit = (payload: unknown) => {
  for (const cb of handlers) cb(payload);
};

afterEach(() => {
  handlers.length = 0;
});

describe('Toast', () => {
  it('renders nothing when no notifications are received', () => {
    render(<Toast />);
    expect(screen.queryByTestId('toast-stack')).not.toBeInTheDocument();
  });

  it('displays a warning when a snowy:notification event arrives', () => {
    render(<Toast />);
    act(() => emit({ level: 'warning', message: 'Keychain cleanup failed' }));
    expect(screen.getByTestId('toast-warning')).toBeInTheDocument();
    expect(screen.getByText('Keychain cleanup failed')).toBeInTheDocument();
  });

  it('displays an error notification with error styling', () => {
    render(<Toast />);
    act(() => emit({ level: 'error', message: 'Something went wrong' }));
    expect(screen.getByTestId('toast-error')).toBeInTheDocument();
  });

  it('displays a success notification with success styling', () => {
    render(<Toast />);
    act(() => emit({ level: 'success', message: 'CSV exported' }));
    expect(screen.getByTestId('toast-success')).toBeInTheDocument();
    expect(screen.getByText('CSV exported')).toBeInTheDocument();
  });

  it('defaults unknown levels to warning', () => {
    render(<Toast />);
    act(() => emit({ level: 'info', message: 'hello' }));
    expect(screen.getByTestId('toast-warning')).toBeInTheDocument();
  });

  it('ignores notifications without a message', () => {
    render(<Toast />);
    act(() => emit({ level: 'warning', message: '' }));
    expect(screen.queryByTestId('toast-stack')).not.toBeInTheDocument();
  });

  it('dismisses a notification when the close button is clicked', async () => {
    render(<Toast />);
    act(() => emit({ level: 'warning', message: 'go away' }));
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByTestId('toast-warning')).not.toBeInTheDocument();
  });

  it('stacks multiple notifications', () => {
    render(<Toast />);
    act(() => {
      emit({ level: 'warning', message: 'first' });
      emit({ level: 'error', message: 'second' });
    });
    expect(screen.getAllByText(/first|second/)).toHaveLength(2);
  });

  it('auto-dismisses notification after timeout', () => {
    vi.useFakeTimers();
    render(<Toast />);
    act(() => emit({ level: 'warning', message: 'auto-dismiss me' }));
    expect(screen.getByTestId('toast-warning')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(8001));
    expect(screen.queryByTestId('toast-warning')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
