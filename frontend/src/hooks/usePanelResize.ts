import type React from 'react';
import { useState } from 'react';

export function usePanelResize() {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const v = localStorage.getItem('snowy.sidebarWidth');
    return v ? Math.max(160, Math.min(480, parseInt(v, 10))) : 260;
  });

  const [bottomHeight, setBottomHeight] = useState(() => {
    const v = localStorage.getItem('snowy.bottomPanelHeight');
    return v ? Math.max(120, Math.min(600, parseInt(v, 10))) : 320;
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
      latest = Math.max(160, Math.min(480, startW + ev.clientX - startX));
      setSidebarWidth(latest);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setIsSidebarDragging(false);
      localStorage.setItem('snowy.sidebarWidth', String(latest));
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
      latest = Math.max(120, Math.min(maxH, startH - (ev.clientY - startY)));
      setBottomHeight(latest);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setIsBottomDragging(false);
      localStorage.setItem('snowy.bottomPanelHeight', String(latest));
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
