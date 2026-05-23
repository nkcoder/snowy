import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePanelResize } from './usePanelResize';

describe('usePanelResize', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('uses defaults when localStorage is empty', () => {
    const { result } = renderHook(() => usePanelResize());
    expect(result.current.sidebarWidth).toBe(260);
    expect(result.current.bottomHeight).toBe(320);
  });

  it('restores sidebarWidth from localStorage', () => {
    localStorage.setItem('snowy.sidebarWidth', '380');
    const { result } = renderHook(() => usePanelResize());
    expect(result.current.sidebarWidth).toBe(380);
  });

  it('restores bottomHeight from localStorage', () => {
    localStorage.setItem('snowy.bottomPanelHeight', '450');
    const { result } = renderHook(() => usePanelResize());
    expect(result.current.bottomHeight).toBe(450);
  });

  it('clamps sidebarWidth below minimum', () => {
    localStorage.setItem('snowy.sidebarWidth', '50');
    const { result } = renderHook(() => usePanelResize());
    expect(result.current.sidebarWidth).toBe(160);
  });

  it('clamps sidebarWidth above maximum', () => {
    localStorage.setItem('snowy.sidebarWidth', '9999');
    const { result } = renderHook(() => usePanelResize());
    expect(result.current.sidebarWidth).toBe(480);
  });

  it('clamps bottomHeight below minimum', () => {
    localStorage.setItem('snowy.bottomPanelHeight', '10');
    const { result } = renderHook(() => usePanelResize());
    expect(result.current.bottomHeight).toBe(120);
  });

  it('clamps bottomHeight above maximum', () => {
    localStorage.setItem('snowy.bottomPanelHeight', '9999');
    const { result } = renderHook(() => usePanelResize());
    expect(result.current.bottomHeight).toBe(600);
  });

  it('startSidebarDrag registers mousemove/mouseup listeners', () => {
    const { result } = renderHook(() => usePanelResize());
    const addSpy = vi.spyOn(document, 'addEventListener');

    act(() => {
      const fakeEvent = { preventDefault: vi.fn(), clientX: 100 } as unknown as React.MouseEvent;
      result.current.startSidebarDrag(fakeEvent);
    });

    const events = addSpy.mock.calls.map(([event]) => event);
    expect(events).toContain('mousemove');
    expect(events).toContain('mouseup');
    addSpy.mockRestore();
  });

  it('startBottomDrag registers mousemove/mouseup listeners', () => {
    const { result } = renderHook(() => usePanelResize());
    const addSpy = vi.spyOn(document, 'addEventListener');

    act(() => {
      const fakeEvent = { preventDefault: vi.fn(), clientY: 200 } as unknown as React.MouseEvent;
      result.current.startBottomDrag(fakeEvent);
    });

    const events = addSpy.mock.calls.map(([event]) => event);
    expect(events).toContain('mousemove');
    expect(events).toContain('mouseup');
    addSpy.mockRestore();
  });

  it('mousemove during sidebar drag updates sidebarWidth', () => {
    const { result } = renderHook(() => usePanelResize());
    const listeners: Record<string, EventListener> = {};
    vi.spyOn(document, 'addEventListener').mockImplementation((event, handler) => {
      listeners[event] = handler as EventListener;
    });
    vi.spyOn(document, 'removeEventListener').mockImplementation(() => {});

    act(() => {
      const fakeEvent = { preventDefault: vi.fn(), clientX: 260 } as unknown as React.MouseEvent;
      result.current.startSidebarDrag(fakeEvent);
    });

    act(() => {
      listeners.mousemove?.(new MouseEvent('mousemove', { clientX: 320 }));
    });

    expect(result.current.sidebarWidth).toBe(320);

    act(() => {
      listeners.mouseup?.(new MouseEvent('mouseup'));
    });

    expect(localStorage.getItem('snowy.sidebarWidth')).toBe('320');
    vi.restoreAllMocks();
  });

  it('mousemove during bottom drag updates bottomHeight', () => {
    const { result } = renderHook(() => usePanelResize());
    const listeners: Record<string, EventListener> = {};
    vi.spyOn(document, 'addEventListener').mockImplementation((event, handler) => {
      listeners[event] = handler as EventListener;
    });
    vi.spyOn(document, 'removeEventListener').mockImplementation(() => {});
    vi.stubGlobal('window', { ...window, innerHeight: 800 });

    act(() => {
      const fakeEvent = { preventDefault: vi.fn(), clientY: 480 } as unknown as React.MouseEvent;
      result.current.startBottomDrag(fakeEvent);
    });

    act(() => {
      listeners.mousemove?.(new MouseEvent('mousemove', { clientY: 380 }));
    });

    // height = max(120, min(maxH, 320 - (380 - 480))) = max(120, min(480, 420)) = 420
    expect(result.current.bottomHeight).toBe(420);

    act(() => {
      listeners.mouseup?.(new MouseEvent('mouseup'));
    });

    expect(localStorage.getItem('snowy.bottomPanelHeight')).toBe('420');
    vi.restoreAllMocks();
  });
});
