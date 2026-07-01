import type React from 'react';
import { useState } from 'react';

// localStorage keys for persisted panel sizes; centralized to avoid typo-drift.
const STORAGE_KEYS = {
  sidebarWidth: 'snowy.sidebarWidth',
  bottomHeight: 'snowy.bottomPanelHeight',
} as const;

// Size bounds (px). Sidebar clamps to a fixed range; the bottom panel clamps to
// BOTTOM_MAX on read and to a window-relative cap while dragging (see below).
const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 480;
const SIDEBAR_DEFAULT = 260;
const BOTTOM_MIN = 120;
const BOTTOM_MAX = 600;
const BOTTOM_DEFAULT = 320;

// Drag-to-resize for the sidebar (width) and bottom results panel (height).
// Sizes persist to localStorage and are clamped on read so a stale/corrupt
// value can never produce an unusable panel. The drag itself uses imperative
// document-level mousemove/mouseup listeners (rather than React state per move)
// so a fast drag stays smooth; the final value is written to localStorage on
// mouseup via the `latest` closure variable.
export function usePanelResize() {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const v = localStorage.getItem(STORAGE_KEYS.sidebarWidth);
    return v ? Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, parseInt(v, 10))) : SIDEBAR_DEFAULT;
  });

  const [bottomHeight, setBottomHeight] = useState(() => {
    const v = localStorage.getItem(STORAGE_KEYS.bottomHeight);
    return v ? Math.max(BOTTOM_MIN, Math.min(BOTTOM_MAX, parseInt(v, 10))) : BOTTOM_DEFAULT;
  });

  const [isSidebarDragging, setIsSidebarDragging] = useState(false);
  const [isBottomDragging, setIsBottomDragging] = useState(false);

  const startSidebarDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSidebarDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const startX = e.clientX;
    const startW = sidebarWidth;
    let latest = startW;
    const onMove = (ev: MouseEvent) => {
      latest = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startW + ev.clientX - startX));
      setSidebarWidth(latest);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setIsSidebarDragging(false);
      localStorage.setItem(STORAGE_KEYS.sidebarWidth, String(latest));
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startBottomDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsBottomDragging(true);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const startY = e.clientY;
    const startH = bottomHeight;
    let latest = startH;
    const onMove = (ev: MouseEvent) => {
      const maxH = Math.floor(window.innerHeight * 0.6);
      latest = Math.max(BOTTOM_MIN, Math.min(maxH, startH - (ev.clientY - startY)));
      setBottomHeight(latest);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setIsBottomDragging(false);
      localStorage.setItem(STORAGE_KEYS.bottomHeight, String(latest));
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return {
    sidebarWidth,
    bottomHeight,
    startSidebarDrag,
    startBottomDrag,
    isSidebarDragging,
    isBottomDragging,
  };
}
