import { test, expect } from '@playwright/test';
import { setupMock, connectToWorkspace } from './helpers';

test.describe('Sprint 9 — Datasource context menu', () => {
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
