import { test, expect } from '@playwright/test';
import { setupMock, connectToWorkspace, runQuery } from './helpers';

test.describe('History', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page);
  });

  test('RecordHistory called after query runs', async ({ page }) => {
    await connectToWorkspace(page);
    await runQuery(page);
    await page.waitForTimeout(500);

    const recorded = await page.evaluate(() => (window as any).__recordedHistory ?? []);
    expect(recorded.length).toBeGreaterThan(0);
    expect(recorded[0].rowCount).toBe(2);
    expect(recorded[0].durationMs).toBe(42);
  });

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

    // Click the semi-transparent backdrop overlay that covers the workspace
    await page.locator('[data-testid="history-backdrop"]').dispatchEvent('click');
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
});
