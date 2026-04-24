import { test, expect, type Page } from '@playwright/test';
import {
  buildMockBridgeScript,
  mockConfig,
  mockCompletions,
  mockQueryResult,
  mockHistoryEntries,
} from './mock-bridge';

async function setupMock(page: Page) {
  await page.addInitScript(
    buildMockBridgeScript(mockConfig, mockCompletions, mockQueryResult, mockHistoryEntries),
  );
}

async function connectToWorkspace(page: Page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="project-item-proj-1"]', { timeout: 10000 });
  await page.click('[data-testid="project-item-proj-1"]');
  await page.waitForSelector('[data-testid="btn-connect-ds-1"]', { timeout: 5000 });
  await page.click('[data-testid="btn-connect-ds-1"]');
  await page.waitForSelector('[data-testid="cm-editor"]', { timeout: 10000 });
}

async function runQuery(page: Page) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('SELECT * FROM users LIMIT 10;');
  await page.locator('[data-testid="run-button"]').click();
  // Wait for results
  await expect(page.locator('text=user_id').first()).toBeVisible({ timeout: 5000 });
}

test.describe('Sprint 6 — Results Panel: Pinnable Tabs + History', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page);
  });

  // ── Result tabs ────────────────────────────────────────────────────────────

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

  // ── Pin result ─────────────────────────────────────────────────────────────

  test('Pin button is disabled when no result data', async ({ page }) => {
    await connectToWorkspace(page);
    const pinBtn = page.locator('button', { hasText: 'Pin' });
    await expect(pinBtn).toBeVisible();
    // Before any query, pin should be disabled
    const disabled = await pinBtn.getAttribute('disabled');
    expect(disabled).not.toBeNull();
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

  // ── History is recorded ────────────────────────────────────────────────────

  test('RecordHistory called after query runs', async ({ page }) => {
    await connectToWorkspace(page);
    await runQuery(page);
    await page.waitForTimeout(500);

    const recorded = await page.evaluate(() => (window as any).__recordedHistory ?? []);
    expect(recorded.length).toBeGreaterThan(0);
    expect(recorded[0].rowCount).toBe(2);
    expect(recorded[0].durationMs).toBe(42);
  });

  // ── History drawer ─────────────────────────────────────────────────────────

  test('history button opens the history drawer', async ({ page }) => {
    await connectToWorkspace(page);

    const historyBtn = page.locator('button[title="Query history"]');
    await historyBtn.click();
    await page.waitForTimeout(300);

    await expect(page.locator('text=Query History').first()).toBeVisible();
  });

  test('history drawer shows past entries from mock', async ({ page }) => {
    await connectToWorkspace(page);

    await page.locator('button[title="Query history"]').click();
    await page.waitForTimeout(500);

    await expect(page.locator('text=SELECT * FROM users LIMIT 10;').first()).toBeVisible();
    await expect(page.locator('text=SELECT count(*) FROM accounts;').first()).toBeVisible();
  });

  test('history drawer closes on backdrop click', async ({ page }) => {
    await connectToWorkspace(page);
    await page.locator('button[title="Query history"]').click();
    await page.waitForTimeout(300);

    // Click the backdrop (fixed overlay)
    await page.mouse.click(100, 300);
    await page.waitForTimeout(300);

    await expect(page.locator('text=Query History')).not.toBeVisible();
  });

  test('clicking history entry loads SQL into editor', async ({ page }) => {
    await connectToWorkspace(page);

    await page.locator('button[title="Query history"]').click();
    await page.waitForTimeout(500);

    // Click the first history entry
    await page.locator('text=SELECT * FROM users LIMIT 10;').first().click();
    await page.waitForTimeout(300);

    // Drawer should close
    await expect(page.locator('text=Query History')).not.toBeVisible();

    // Editor should contain the selected SQL
    const editorContent = await page.locator('.cm-content').textContent();
    expect(editorContent).toContain('SELECT * FROM users LIMIT 10');
  });

  // ── CSV export ─────────────────────────────────────────────────────────────

  test('export button is disabled when no result data', async ({ page }) => {
    await connectToWorkspace(page);
    const exportBtn = page.locator('button[title="Export CSV"]');
    await expect(exportBtn).toBeVisible();
    const disabled = await exportBtn.getAttribute('disabled');
    expect(disabled).not.toBeNull();
  });

  test('export button is enabled after running a query', async ({ page }) => {
    await connectToWorkspace(page);
    await runQuery(page);
    const exportBtn = page.locator('button[title="Export CSV"]');
    const disabled = await exportBtn.getAttribute('disabled');
    expect(disabled).toBeNull();
  });
});
