import { test, expect } from '@playwright/test';
import { setupMock, connectToWorkspace, runQuery } from './helpers';

test.describe('Column resize handles', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page);
    await connectToWorkspace(page);
    await runQuery(page);
  });

  test('handles exist and cursor is col-resize', async ({ page }) => {
    const count = await page.evaluate(() => {
      let found = 0;
      for (const th of document.querySelectorAll('table thead th')) {
        for (const div of th.querySelectorAll('div')) {
          if (getComputedStyle(div).cursor === 'col-resize') { found++; break; }
        }
      }
      return found;
    });
    console.log('Columns with resize handles:', count);
    expect(count).toBeGreaterThan(0);
  });

  test('drag changes th inline width', async ({ page }) => {
    // Get position and initial width of first data column th
    const info = await page.evaluate(() => {
      const dataHeaders = Array.from(document.querySelectorAll('table thead th')).slice(1);
      if (!dataHeaders[0]) return null;
      const th = dataHeaders[0] as HTMLTableCellElement;
      const rect = th.getBoundingClientRect();
      // Find its resize handle
      let handleRect: DOMRect | null = null;
      for (const div of th.querySelectorAll('div')) {
        if (getComputedStyle(div).cursor === 'col-resize') {
          handleRect = div.getBoundingClientRect();
          break;
        }
      }
      return {
        thWidth: th.offsetWidth,
        thRight: rect.right,
        handleX: handleRect ? handleRect.x + handleRect.width / 2 : null,
        handleY: handleRect ? handleRect.y + handleRect.height / 2 : null,
        hasHandle: !!handleRect,
      };
    });
    console.log('Column info:', info);
    expect(info?.hasHandle).toBe(true);

    const { handleX, handleY, thWidth } = info!;
    
    // Drag 60px right
    await page.mouse.move(handleX!, handleY!);
    await page.mouse.down();
    await page.mouse.move(handleX! + 60, handleY!, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(100);

    const newWidth = await page.evaluate(() => {
      const th = document.querySelectorAll('table thead th')[1] as HTMLTableCellElement;
      return { inline: th.style.width, computed: th.offsetWidth };
    });
    console.log('Before:', thWidth, 'After inline:', newWidth.inline, 'computed:', newWidth.computed);
    expect(newWidth.computed).toBeGreaterThan(thWidth);
  });
});
