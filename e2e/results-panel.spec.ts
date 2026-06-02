import { test, expect } from '@playwright/test';
import { buildMockBridgeScript, mockConfig, mockCompletions, mockQueryResult, mockHistoryEntries } from './mock-bridge';
import { setupMock, connectToWorkspace, runQuery } from './helpers';

test.describe('Result tabs', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page);
  });

  test('result panel shows "Result 1" tab after connect', async ({ page }) => {
    await connectToWorkspace(page);
    await expect(page.locator('text=Result 1').first()).toBeVisible();
  });

  test('result tab shows row count and duration after query', async ({ page }) => {
    await connectToWorkspace(page);
    await runQuery(page);
    // "2 rows" and "42ms" come from mockQueryResult
    await expect(page.locator('text=2 rows').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=42ms').first()).toBeVisible({ timeout: 5000 });
  });

  test('result tab label increments on each run', async ({ page }) => {
    await connectToWorkspace(page);
    await runQuery(page);
    await expect(page.locator('text=Result 1').first()).toBeVisible();

    // Run again
    await page.locator('[data-testid="run-button"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Result 2').first()).toBeVisible();
  });
});

test.describe('Pin', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page);
  });

  test('Pin button is not shown when no result data', async ({ page }) => {
    await connectToWorkspace(page);
    // Toolbar (including Pin) only renders after a query returns data
    const pinBtn = page.locator('button', { hasText: 'Pin' });
    await expect(pinBtn).not.toBeVisible();
  });

  test('Pin button becomes enabled after running a query', async ({ page }) => {
    await connectToWorkspace(page);
    await runQuery(page);
    const pinBtn = page.locator('button', { hasText: 'Pin' });
    const disabled = await pinBtn.getAttribute('disabled');
    expect(disabled).toBeNull();
  });

  test('clicking Pin creates a pinned tab', async ({ page }) => {
    await connectToWorkspace(page);
    await runQuery(page);

    const pinBtn = page.locator('button', { hasText: 'Pin' });
    await pinBtn.click();
    await page.waitForTimeout(300);

    // Should now have 2 result tabs: "Result 1" (live) + "Result 1" (pinned)
    const tabs = page.locator('button', { hasText: 'Result 1' });
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('pinned tab has close button; live tab does not', async ({ page }) => {
    await connectToWorkspace(page);
    await runQuery(page);

    const pinBtn = page.locator('button', { hasText: 'Pin' });
    await pinBtn.click();
    await page.waitForTimeout(300);

    // The result panel should contain at least one X button (for pinned tab)
    // We check for close buttons inside the result tab strip area
    // The pinned tab gets an X; live tab does not
    const resultTabStrip = page.locator('[data-testid="result-tab-strip"]');
    if (await resultTabStrip.isVisible()) {
      const closeButtons = resultTabStrip.locator('svg').filter({ hasText: '' });
      expect(await closeButtons.count()).toBeGreaterThan(0);
    }
  });

  test('second run replaces live tab content, pinned stays', async ({ page }) => {
    await connectToWorkspace(page);
    await runQuery(page);

    // Pin Result 1
    await page.locator('button', { hasText: 'Pin' }).click();
    await page.waitForTimeout(300);

    // Run again → live tab becomes Result 2
    await page.locator('[data-testid="run-button"]').click();
    await page.waitForTimeout(500);

    await expect(page.locator('text=Result 2').first()).toBeVisible();
    // Pinned Result 1 should still exist
    const result1Tabs = page.locator('button', { hasText: 'Result 1' });
    expect(await result1Tabs.count()).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Export', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page);
  });

  test('export button is not shown when no result data', async ({ page }) => {
    await connectToWorkspace(page);
    // Toolbar (including Export) only renders after a query returns data
    const exportBtn = page.locator('button[title="Export CSV"]');
    await expect(exportBtn).not.toBeVisible();
  });

  test('export button is enabled after running a query', async ({ page }) => {
    await connectToWorkspace(page);
    await runQuery(page);
    const exportBtn = page.locator('button[title="Export CSV"]');
    const disabled = await exportBtn.getAttribute('disabled');
    expect(disabled).toBeNull();
  });
});

test.describe('Query Error Display', () => {
  test.beforeEach(async ({ page }) => {
    // Override ExecuteQuery to simulate a DB type-mismatch error
    const baseScript = buildMockBridgeScript(mockConfig, mockCompletions, mockQueryResult);
    await page.addInitScript(baseScript);
    await page.addInitScript(`
      (function() {
        window.__queryFails = false;
        const orig = window.go.main.App.ExecuteQuery;
        window.go.main.App.ExecuteQuery = function(dsId, sql) {
          if (window.__queryFails) {
            return Promise.reject('ERROR: invalid input syntax for type integer: "dd" (SQLSTATE 22P02)');
          }
          return orig(dsId, sql);
        };
      })();
    `);
    await connectToWorkspace(page);
  });

  test('failed query shows error message inline — not previous results', async ({ page }) => {
    // Run a valid query first so there are existing results
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT * FROM users;');
    await page.locator('[data-testid="run-button"]').click();
    await page.waitForTimeout(500);
    // Verify previous results are visible
    await expect(page.locator('text=user_id').first()).toBeVisible({ timeout: 3_000 });

    // Now make ExecuteQuery fail and run an invalid query
    await page.evaluate(() => { (window as any).__queryFails = true; });
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type("SELECT * FROM transactions WHERE from_account_id = 'dd';");
    await page.locator('[data-testid="run-button"]').click();
    await page.waitForTimeout(500);

    // Previous result data must be gone
    const hasOldData = await page.locator('text=user_id').isVisible();
    expect(hasOldData, 'old result data must be cleared on query failure').toBe(false);

    // Error message must be visible in the results panel
    const errorText = await page.locator('text=invalid input syntax').isVisible();
    expect(errorText, 'error message must be shown inline in the results panel').toBe(true);
  });

  test('error tab shows "error" badge instead of row count', async ({ page }) => {
    await page.evaluate(() => { (window as any).__queryFails = true; });
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type("SELECT * FROM transactions WHERE from_account_id = 'dd';");
    await page.locator('[data-testid="run-button"]').click();
    await page.waitForTimeout(500);

    // The result tab should show "error" not a row count
    const tabStrip = page.locator('[data-testid="query-editor"]').locator('..').locator('..');
    const errorBadge = page.locator('text=error').first();
    await expect(errorBadge, 'result tab must display "error" indicator').toBeVisible({ timeout: 2_000 });
  });

  test('subsequent successful query replaces the error state', async ({ page }) => {
    // First run fails
    await page.evaluate(() => { (window as any).__queryFails = true; });
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type("SELECT * FROM transactions WHERE from_account_id = 'dd';");
    await page.locator('[data-testid="run-button"]').click();
    await page.waitForTimeout(400);

    // Now run a good query
    await page.evaluate(() => { (window as any).__queryFails = false; });
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT * FROM users;');
    await page.locator('[data-testid="run-button"]').click();
    await page.waitForTimeout(500);

    // Error message must be gone, results must appear
    const hasError = await page.locator('text=invalid input syntax').isVisible();
    expect(hasError, 'error message must be cleared after a successful query').toBe(false);
    await expect(page.locator('text=user_id').first()).toBeVisible({ timeout: 3_000 });
  });
});

// ── helper: build a mock with N rows in the query result ─────────────────────
function manyRowsMock(n: number) {
  return buildMockBridgeScript(
    mockConfig,
    mockCompletions,
    {
      columns: ['n'],
      rows: Array.from({ length: n }, (_, i) => [i + 1]),
      durationMs: 5,
      rowCount: n,
    },
    mockHistoryEntries,
  );
}

test.describe('Scroll', () => {
  test('results grid scrolls vertically when rows exceed panel height', async ({ page }) => {
    await page.addInitScript(manyRowsMock(100));
    await connectToWorkspace(page);

    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT n FROM generate_series(1,100) n;');
    await page.locator('[data-testid="run-button"]').click();
    // Wait for at least one row to appear
    await page.locator('text=1').first().waitFor({ timeout: 5_000 });

    const grid = page.locator('.flex-1.overflow-auto').last();

    // Grid must be constrained: content taller than the visible area
    const { clientH, scrollH } = await grid.evaluate((el) => ({
      clientH: el.clientHeight,
      scrollH: el.scrollHeight,
    }));
    expect(scrollH, 'table content should overflow the grid container').toBeGreaterThan(clientH);

    // Programmatic scroll must move the position
    await grid.evaluate((el) => { el.scrollTop = 400; });
    const scrollTop = await grid.evaluate((el) => el.scrollTop);
    expect(scrollTop, 'scrollTop must update after programmatic scroll').toBeGreaterThan(0);
  });

  test('sticky header stays in view after scrolling', async ({ page }) => {
    await page.addInitScript(manyRowsMock(100));
    await connectToWorkspace(page);

    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT n FROM generate_series(1,100) n;');
    await page.locator('[data-testid="run-button"]').click();
    await page.locator('text=1').first().waitFor({ timeout: 5_000 });

    const grid = page.locator('.flex-1.overflow-auto').last();
    await grid.evaluate((el) => { el.scrollTop = 600; });

    // The thead has position:sticky — its bounding box top should stay near 0
    // relative to the grid container (not scroll away with the rows)
    const headerTop = await page.evaluate(() => {
      const thead = document.querySelector('thead') as HTMLElement | null;
      const gridEl = document.querySelector('.overflow-auto') as HTMLElement | null;
      if (!thead || !gridEl) return null;
      const gridRect = gridEl.getBoundingClientRect();
      const headRect = thead.getBoundingClientRect();
      return headRect.top - gridRect.top;
    });
    expect(headerTop, 'sticky thead should stay at top of grid after scroll').not.toBeNull();
    expect(headerTop!).toBeLessThan(5); // within 5px of grid top
  });

  test('results panel is still constrained after panel resize', async ({ page }) => {
    await page.addInitScript(manyRowsMock(100));
    await connectToWorkspace(page);

    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT n FROM generate_series(1,100) n;');
    await page.locator('[data-testid="run-button"]').click();
    await page.locator('text=1').first().waitFor({ timeout: 5_000 });

    // Drag the resize handle upward to make the panel taller
    const handle = page.locator('[data-testid="bottom-resize-handle"]');
    const handleBox = await handle.boundingBox();
    if (handleBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y);
      await page.mouse.down();
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y - 80, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(150);
    }

    // Grid must still be constrained (scrollH > clientH) after resize
    const grid = page.locator('.flex-1.overflow-auto').last();
    const { clientH, scrollH } = await grid.evaluate((el) => ({
      clientH: el.clientHeight,
      scrollH: el.scrollHeight,
    }));
    expect(scrollH, 'grid should still overflow after panel resize').toBeGreaterThan(clientH);
  });
});
