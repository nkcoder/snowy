import { test, expect } from '@playwright/test';
import { setupMock, connectToWorkspace, setEditorText } from './helpers';

test.describe('Query Editor', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page);
  });

  test('CodeMirror editor accepts input', async ({ page }) => {
    await connectToWorkspace(page);

    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type('SELECT ');

    const content = await editor.textContent();
    expect(content).toContain('SELECT');
  });

  test('Ctrl+Enter triggers query execution', async ({ page }) => {
    await connectToWorkspace(page);

    await page.evaluate(() => {
      const orig = (window as any).go.main.App.ExecuteQuery;
      (window as any).go.main.App.ExecuteQuery = (...args: any[]) => {
        (window as any).__executeCalled = true;
        return orig(...args);
      };
    });

    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT 42;');

    // Re-click editor to ensure focus, then press Ctrl+Enter
    // (Mod-Enter = Cmd+Enter on Mac, but headless Chromium handles Ctrl+Enter more reliably)
    await editor.click();
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(500);

    const called = await page.evaluate(() => !!(window as any).__executeCalled);
    expect(called).toBe(true);
  });

  test('tab retains SQL content after typing', async ({ page }) => {
    await connectToWorkspace(page);

    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT * FROM accounts;');

    const content = await editor.textContent();
    expect(content).toContain('accounts');
  });

  test('multiple tabs maintain separate SQL content', async ({ page }) => {
    await connectToWorkspace(page);

    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT 1 -- tab1;');

    // Open new tab
    await page.click('[data-testid="tab-new"]');
    await page.waitForTimeout(300);

    // New tab should have empty content
    const content = await editor.textContent();
    expect(content).not.toContain('tab1');
  });

  test('save button prompts and saves query; appears in sidebar', async ({ page }) => {
    await connectToWorkspace(page);

    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT * FROM users;');

    await page.locator('[data-testid="save-button"]').click();

    // Custom InputDialog appears — fill filename and confirm
    const dialogInput = page.locator('input[placeholder="filename.sql"]');
    await dialogInput.waitFor({ timeout: 3000 });
    await dialogInput.fill('test_query');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Saved query should appear in sidebar queries list
    await expect(page.getByText('test_query.sql')).toBeVisible({ timeout: 5000 });
  });
});
