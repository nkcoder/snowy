import { test, expect } from '@playwright/test';
import { setupMock, connectToWorkspace, expandToTable } from './helpers';

test.describe('Datasource context menu', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page);
  });

  test('right-clicking datasource node shows context menu', async ({ page }) => {
    await connectToWorkspace(page);
    await page.click('[data-testid="conn-node-ds-1"]');
    await page.waitForSelector('[data-testid="conn-node-ds-1"]');
    await page.click('[data-testid="conn-node-ds-1"]', { button: 'right' });
    await expect(page.getByTestId('ctx-menu-ds-1')).toBeVisible();
    await expect(page.getByText('New Query Console')).toBeVisible();
    await expect(page.getByText('Refresh')).toBeVisible();
    await expect(page.getByText('Disconnect')).toBeVisible();
  });

  test('Escape dismisses the context menu', async ({ page }) => {
    await connectToWorkspace(page);
    await page.click('[data-testid="conn-node-ds-1"]', { button: 'right' });
    await expect(page.getByTestId('ctx-menu-ds-1')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('ctx-menu-ds-1')).not.toBeVisible();
  });

  test('right-click → New Query Console opens a new tab', async ({ page }) => {
    await connectToWorkspace(page);
    // Count tabs before
    const tabsBefore = await page.locator('[data-testid^="tab-"]').count();
    await page.click('[data-testid="conn-node-ds-1"]', { button: 'right' });
    await expect(page.getByTestId('ctx-menu-ds-1')).toBeVisible();
    await page.getByText('New Query Console').click();
    // Menu should close
    await expect(page.getByTestId('ctx-menu-ds-1')).not.toBeVisible();
    // A new tab should have been created
    const tabsAfter = await page.locator('[data-testid^="tab-"]').count();
    expect(tabsAfter).toBeGreaterThan(tabsBefore);
  });

  test('clicking outside closes the context menu', async ({ page }) => {
    await connectToWorkspace(page);
    await page.click('[data-testid="conn-node-ds-1"]', { button: 'right' });
    await expect(page.getByTestId('ctx-menu-ds-1')).toBeVisible();
    await page.click('[data-testid="sidebar-search"]');
    await expect(page.getByTestId('ctx-menu-ds-1')).not.toBeVisible();
  });
});

test.describe('Copy-name context menu', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await setupMock(page);
  });

  test('right-click table → Copy name writes the bare name to the clipboard', async ({ page }) => {
    await connectToWorkspace(page);
    await expandToTable(page, 'accounts');

    await page.click('[data-testid="table-row-public-accounts"]', { button: 'right' });
    await expect(page.getByTestId('ctx-menu-copy')).toBeVisible();
    await page.getByText('Copy name').click();

    await expect(page.getByTestId('ctx-menu-copy')).not.toBeVisible();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe('accounts');
  });

  test('right-click schema → Copy name copies the schema name', async ({ page }) => {
    await connectToWorkspace(page);
    await page.waitForSelector('[data-testid="schema-row-public"]');

    await page.click('[data-testid="schema-row-public"]', { button: 'right' });
    await expect(page.getByTestId('ctx-menu-copy')).toBeVisible();
    await page.getByText('Copy name').click();

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe('public');
  });
});
