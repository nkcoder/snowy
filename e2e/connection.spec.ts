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
