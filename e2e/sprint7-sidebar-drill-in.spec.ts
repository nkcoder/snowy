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
  // Wait for ConnectionManager — double-click a datasource to connect
  await page.waitForSelector('[data-testid="ds-item-ds-1"]', { timeout: 10000 });
  await page.dblclick('[data-testid="ds-item-ds-1"]');
  // Workspace is ready when sidebar search is visible
  await page.waitForSelector('[data-testid="sidebar-search"]', { timeout: 10000 });
}

async function expandToTable(page: Page, tableName: string) {
  // Expand schema
  await page.waitForSelector('[data-testid="schema-row-public"]', { timeout: 5000 });
  await page.click('[data-testid="schema-row-public"]');
  // Wait for table row
  await page.waitForSelector(`[data-testid="table-row-public-${tableName}"]`, { timeout: 5000 });
  // Expand table
  await page.click(`[data-testid="table-row-public-${tableName}"]`);
}

test.describe('Sprint 7 — Sidebar table drill-in', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page);
  });

  test('expanding a table shows columns, keys, foreign keys, indexes, checks sub-folders', async ({ page }) => {
    await connectToWorkspace(page);
    await expandToTable(page, 'accounts');

    await expect(page.locator('[data-testid="subfolder-columns-public-accounts"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="subfolder-keys-public-accounts"]')).toBeVisible();
    await expect(page.locator('[data-testid="subfolder-fk-public-accounts"]')).toBeVisible();
    await expect(page.locator('[data-testid="subfolder-indexes-public-accounts"]')).toBeVisible();
    await expect(page.locator('[data-testid="subfolder-checks-public-accounts"]')).toBeVisible();
  });

  test('columns are shown automatically after table expand', async ({ page }) => {
    await connectToWorkspace(page);
    await expandToTable(page, 'accounts');

    // columns sub-folder is open by default
    await expect(page.locator('text=account_id').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=balance').first()).toBeVisible();
  });

  test('clicking keys sub-folder reveals primary key', async ({ page }) => {
    await connectToWorkspace(page);
    await expandToTable(page, 'accounts');

    await page.click('[data-testid="subfolder-keys-public-accounts"]');
    await expect(page.locator('text=accounts_pkey').first()).toBeVisible({ timeout: 5000 });
  });

  test('clicking foreign keys sub-folder reveals FK item', async ({ page }) => {
    await connectToWorkspace(page);
    await expandToTable(page, 'accounts');

    await page.click('[data-testid="subfolder-fk-public-accounts"]');
    await expect(page.locator('text=accounts_user_id_fkey').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=users').first()).toBeVisible();
  });

  test('clicking indexes sub-folder reveals index item', async ({ page }) => {
    await connectToWorkspace(page);
    await expandToTable(page, 'users');

    await page.click('[data-testid="subfolder-indexes-public-users"]');
    await expect(page.locator('text=users_email_key').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=UNIQUE').first()).toBeVisible();
  });

  test('clicking checks sub-folder reveals check constraint', async ({ page }) => {
    await connectToWorkspace(page);
    await expandToTable(page, 'accounts');

    await page.click('[data-testid="subfolder-checks-public-accounts"]');
    await expect(page.locator('text=accounts_balance_check').first()).toBeVisible({ timeout: 5000 });
  });

  test('collapsing table hides all sub-folders', async ({ page }) => {
    await connectToWorkspace(page);
    await expandToTable(page, 'accounts');
    await expect(page.locator('[data-testid="subfolder-columns-public-accounts"]')).toBeVisible();

    // Collapse by clicking table again
    await page.click('[data-testid="table-row-public-accounts"]');
    await expect(page.locator('[data-testid="subfolder-columns-public-accounts"]')).not.toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="subfolder-keys-public-accounts"]')).not.toBeVisible();
  });

  test('double-clicking a table opens SELECT query', async ({ page }) => {
    await connectToWorkspace(page);
    await page.waitForSelector('[data-testid="schema-row-public"]', { timeout: 5000 });
    await page.click('[data-testid="schema-row-public"]');
    await page.waitForSelector('[data-testid="table-row-public-users"]', { timeout: 5000 });
    await page.dblclick('[data-testid="table-row-public-users"]');

    // Query editor should have a SELECT query
    await expect(page.locator('.cm-content')).toContainText('SELECT', { timeout: 5000 });
  });
});
