import { test, expect } from '@playwright/test';
import { setupMock, connectToWorkspace } from './helpers';

test.describe('Connection', () => {
  test.beforeEach(async ({ page }) => { await setupMock(page); });

  test('workspace loads with editor and toolbar after connect', async ({ page }) => {
    await connectToWorkspace(page);
    await expect(page.locator('[data-testid="cm-editor"]')).toBeVisible();
    await expect(page.locator('[data-testid="run-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-button"]')).toBeVisible();
  });
});

test.describe('Connection manager', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page);
    await page.goto('/');
    await page.waitForSelector('[data-testid="ds-item-ds-1"]', { timeout: 10_000 });
  });

  test('shows form when add button is clicked', async ({ page }) => {
    await page.click('[data-testid="btn-add-connection"]');
    await expect(page.locator('[data-testid="connection-form"]')).toBeVisible();
  });

  test('cancel closes form without adding connection', async ({ page }) => {
    await page.click('[data-testid="btn-add-connection"]');
    await page.locator('[data-testid="field-name"]').fill('Throwaway DB');
    await page.click('[data-testid="btn-cancel"]');
    await expect(page.locator('[data-testid="connection-form"]')).not.toBeVisible();
    await expect(page.locator('text=Throwaway DB')).not.toBeVisible();
  });

  test('test connection shows success message', async ({ page }) => {
    await page.click('[data-testid="btn-add-connection"]');
    await page.locator('[data-testid="field-host"]').fill('localhost');
    await page.locator('[data-testid="field-database"]').fill('mydb');
    await page.click('[data-testid="btn-test"]');
    await expect(page.locator('[data-testid="test-result"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid="test-result"]')).toContainText('successful');
  });

  test('save new connection adds it to the list', async ({ page }) => {
    await page.click('[data-testid="btn-add-connection"]');
    await page.locator('[data-testid="field-name"]').fill('Staging DB');
    await page.locator('[data-testid="field-host"]').fill('localhost');
    await page.locator('[data-testid="field-database"]').fill('staging');
    await page.click('[data-testid="btn-save"]');
    await expect(page.locator('text=Staging DB').first()).toBeVisible({ timeout: 5_000 });
  });

  test('delete selected connection shows confirm and removes it', async ({ page }) => {
    await page.click('[data-testid="ds-item-ds-1"]');
    await page.click('[data-testid="btn-delete-selected"]');
    await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible();
    await page.click('[data-testid="confirm-ok"]');
    await expect(page.locator('[data-testid="ds-item-ds-1"]')).not.toBeVisible({ timeout: 5_000 });
  });
});
