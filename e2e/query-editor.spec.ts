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

test.describe('Query file tabs', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page);
  });

  // The queries folder starts collapsed; open it so query-row-* rows render.
  async function openQueriesFolder(page) {
    await page.click('[data-testid="folder-queries"]');
  }

  // Saves the current console as `name`.sql and returns once it is in the sidebar.
  async function saveAs(page, name: string) {
    await page.locator('[data-testid="save-button"]').click();
    const dialogInput = page.locator('input[placeholder="filename.sql"]');
    await dialogInput.waitFor({ timeout: 3_000 });
    await dialogInput.fill(name);
    await page.keyboard.press('Enter');
    await expect(page.locator(`[data-testid="query-row-${name}.sql"]`)).toBeVisible({
      timeout: 5_000,
    });
  }

  test('sidebar highlights the query open in the active tab', async ({ page }) => {
    await connectToWorkspace(page);
    await openQueriesFolder(page);
    await setEditorText(page, 'SELECT 1;');
    await saveAs(page, 'highlighted');

    const row = page.locator('[data-testid="query-row-highlighted.sql"]');
    await expect(row).toHaveCSS('font-weight', '600');
    const selectedBg = await row.evaluate((el) => getComputedStyle(el).backgroundColor);

    // Switching to a different console clears the highlight
    await page.click('[data-testid="tab-new"]');
    await expect(row).not.toHaveCSS('background-color', selectedBg);
  });

  test('cmd+W closes a clean tab', async ({ page }) => {
    await connectToWorkspace(page);
    await page.click('[data-testid="tab-new"]');
    await expect(page.locator('[data-testid^="tab-close-"]')).toHaveCount(2);

    await page.keyboard.press('Control+w');

    await expect(page.locator('[data-testid^="tab-close-"]')).toHaveCount(1);
  });

  test('cmd+W on a dirty query file offers Save, which writes and closes it', async ({ page }) => {
    await connectToWorkspace(page);
    await openQueriesFolder(page);
    await setEditorText(page, 'SELECT 1;');
    await saveAs(page, 'report');

    await setEditorText(page, 'SELECT 2;');
    await page.keyboard.press('Control+w');

    await expect(page.getByText(/has unsaved changes/)).toBeVisible();
    await page.locator('[data-testid="dialog-alt"]').click();

    await expect(page.locator('[data-testid^="tab-close-"]')).toHaveCount(0);
    const saved = await page.evaluate(() => window.go.main.App.LoadSavedQuery('ds-1', 'report.sql'));
    expect(saved).toContain('SELECT 2;');
  });

  test('Save on a dirty untitled console prompts for a filename before closing', async ({
    page,
  }) => {
    await connectToWorkspace(page);
    await openQueriesFolder(page);
    await setEditorText(page, 'SELECT 42;');

    await page.keyboard.press('Control+w');
    await expect(page.getByText(/has unsaved changes/)).toBeVisible();
    await page.locator('[data-testid="dialog-alt"]').click();

    const dialogInput = page.locator('input[placeholder="filename.sql"]');
    await dialogInput.waitFor({ timeout: 3_000 });
    await dialogInput.fill('scratch');
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-testid="query-row-scratch.sql"]')).toBeVisible();
    await expect(page.locator('[data-testid^="tab-close-"]')).toHaveCount(0);
  });
});

test.describe('Scroll past end', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page);
  });

  test('typing at the end of the document does not open a gap above the separator', async ({
    page,
  }) => {
    await connectToWorkspace(page);
    const editor = page.locator('.cm-content');
    await editor.click();
    for (let i = 0; i < 20; i++) {
      await page.keyboard.type(`SELECT ${i} FROM users;`);
      await page.keyboard.press('Enter');
    }
    await page.keyboard.type('SELECT * FROM users;');

    const gapBelowLastLine = () =>
      page.evaluate(() => {
        const scroller = document.querySelector('.cm-scroller') as HTMLElement;
        const lines = document.querySelectorAll('.cm-line');
        const last = lines[lines.length - 1].getBoundingClientRect();
        return scroller.getBoundingClientRect().bottom - last.bottom;
      });

    // The last line stays at the bottom edge while typing — no empty band.
    expect(await gapBelowLastLine()).toBeLessThan(24);
    await page.keyboard.type(' -- more');
    expect(await gapBelowLastLine()).toBeLessThan(24);

    // But the document can still be scrolled well past its last line.
    await page.mouse.move(600, 250);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(200);
    expect(await gapBelowLastLine()).toBeGreaterThan(100);
  });
});
