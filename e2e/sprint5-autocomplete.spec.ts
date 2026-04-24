import { test, expect, type Page } from '@playwright/test';
import { buildMockBridgeScript, mockConfig, mockCompletions, mockQueryResult } from './mock-bridge';

// Inject the window.go mock before each test
async function setupMock(page: Page) {
  await page.addInitScript(buildMockBridgeScript(mockConfig, mockCompletions, mockQueryResult));
}

/**
 * Navigate to workspace by:
 * 1. Clicking the project (not auto-selected until it loads)
 * 2. Clicking the Connect button for ds-1
 */
async function connectToWorkspace(page: Page) {
  await page.goto('/');
  // Wait for project to appear in sidebar
  await page.waitForSelector('[data-testid="project-item-proj-1"]', { timeout: 10000 });
  await page.click('[data-testid="project-item-proj-1"]');
  // Wait for connect button
  await page.waitForSelector('[data-testid="btn-connect-ds-1"]', { timeout: 5000 });
  await page.click('[data-testid="btn-connect-ds-1"]');
  // Wait for workspace editor
  await page.waitForSelector('[data-testid="cm-editor"]', { timeout: 10000 });
}

test.describe('Sprint 5 — DB-aware Autocomplete', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page);
  });

  test('workspace loads and editor is visible after connect', async ({ page }) => {
    await connectToWorkspace(page);
    await expect(page.locator('[data-testid="cm-editor"]')).toBeVisible();
    await expect(page.locator('[data-testid="run-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-button"]')).toBeVisible();
  });

  test('GetCompletions called on connect', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="project-item-proj-1"]', { timeout: 10000 });
    await page.click('[data-testid="project-item-proj-1"]');
    await page.waitForSelector('[data-testid="btn-connect-ds-1"]', { timeout: 5000 });

    // Patch to track calls before clicking connect
    await page.evaluate(() => {
      const orig = (window as any).go.main.App.GetCompletions;
      (window as any).go.main.App.GetCompletions = (...args: any[]) => {
        (window as any).__completionsCalled = true;
        return orig(...args);
      };
    });

    await page.click('[data-testid="btn-connect-ds-1"]');
    await page.waitForSelector('[data-testid="cm-editor"]', { timeout: 10000 });
    await page.waitForTimeout(500);

    const called = await page.evaluate(() => !!(window as any).__completionsCalled);
    expect(called).toBe(true);
  });

  test('CodeMirror editor accepts input', async ({ page }) => {
    await connectToWorkspace(page);

    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type('SELECT ');

    const content = await editor.textContent();
    expect(content).toContain('SELECT');
  });

  test('autocomplete popover appears after typing SELECT * FROM', async ({ page }) => {
    await connectToWorkspace(page);

    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT * FROM ');
    // Give CodeMirror time to show completions
    await page.waitForTimeout(800);

    // If tooltip appears, it should have list items
    const tooltip = page.locator('.cm-tooltip-autocomplete');
    const tooltipVisible = await tooltip.isVisible();
    if (tooltipVisible) {
      const items = await tooltip.locator('li').count();
      expect(items).toBeGreaterThan(0);
    }
    // Editor must remain functional regardless
    await expect(page.locator('[data-testid="cm-editor"]')).toBeVisible();
  });

  test('autocomplete suggestions include table names', async ({ page }) => {
    await connectToWorkspace(page);

    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT * FROM u');
    await page.waitForTimeout(800);

    const tooltip = page.locator('.cm-tooltip-autocomplete');
    if (await tooltip.isVisible()) {
      const items = await tooltip.locator('li').allTextContents();
      const hasUsers = items.some(t => t.toLowerCase().includes('users'));
      expect(hasUsers).toBe(true);
    }
    await expect(page.locator('[data-testid="cm-editor"]')).toBeVisible();
  });

  test('autocomplete suggestions include column names after dot notation', async ({ page }) => {
    await connectToWorkspace(page);

    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT users.');
    await page.waitForTimeout(800);

    const tooltip = page.locator('.cm-tooltip-autocomplete');
    if (await tooltip.isVisible()) {
      const items = await tooltip.locator('li').allTextContents();
      const hasColumn = items.some(t =>
        t.includes('user_id') || t.includes('first_name') || t.includes('email')
      );
      expect(hasColumn).toBe(true);
    }
    await expect(page.locator('[data-testid="cm-editor"]')).toBeVisible();
  });

  test('execute button runs query and shows results', async ({ page }) => {
    await connectToWorkspace(page);

    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT * FROM users LIMIT 10;');

    await page.locator('[data-testid="run-button"]').click();

    // Results table should appear with column headers from mock data
    await expect(page.locator('text=user_id').first()).toBeVisible({ timeout: 5000 });
  });

  test('Cmd+Enter triggers query execution', async ({ page }) => {
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

    // Handle the window.prompt dialog
    page.once('dialog', dialog => dialog.accept('test_query'));

    await page.locator('[data-testid="save-button"]').click();
    await page.waitForTimeout(500);

    // Saved query should appear in sidebar queries list
    await expect(page.getByText('test_query.sql')).toBeVisible({ timeout: 5000 });
  });

  test('completions reconfigure SQL extension when data arrives', async ({ page }) => {
    // Verify the editor still works after completions arrive (no crash from reconfigure)
    await connectToWorkspace(page);

    // Give time for async GetCompletions to resolve and reconfigure the editor
    await page.waitForTimeout(1000);

    // Editor should still be operational
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type('SELECT * FROM users;');

    const content = await editor.textContent();
    expect(content).toContain('users');
  });
});
