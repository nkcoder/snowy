import { expect, test } from '@playwright/test';
import { connectToWorkspace, setEditorText, setupMock } from './helpers';

// In-editor Find (Cmd+F) lives in the QueryEditor + FindBar pair extracted in
// the #128 decomposition. The find handlers had no e2e coverage; this spec
// guards them against future wiring regressions.
test.describe('QueryEditor Find', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page);
    await connectToWorkspace(page);
  });

  test('Cmd+F opens the find bar, focuses input, and Escape/close hides it', async ({ page }) => {
    await setEditorText(page, 'select id from users;');
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+f');

    const findInput = page.locator('[data-testid="find-input"]');
    await expect(findInput).toBeVisible();
    await expect(findInput).toBeFocused();

    await page.locator('[data-testid="find-close"]').click();
    await expect(findInput).toBeHidden();
  });

  test('typing a query reports the match count', async ({ page }) => {
    await setEditorText(page, 'select id from a;\nselect id from b;\nselect id from c;');
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+f');

    const findInput = page.locator('[data-testid="find-input"]');
    await findInput.fill('select');
    // three "select" occurrences -> "1/3" style count
    await expect(page.locator('[data-testid="find-match-count"]')).toContainText('3');
  });

  test('next/prev cycle through matches', async ({ page }) => {
    await setEditorText(page, 'aa bb aa bb aa');
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+f');

    const findInput = page.locator('[data-testid="find-input"]');
    await findInput.fill('aa');
    const count = page.locator('[data-testid="find-match-count"]');
    await expect(count).toContainText('3');

    // Advancing changes the current-match index (e.g. 1/3 -> 2/3).
    const before = await count.textContent();
    await page.locator('[data-testid="find-next"]').click();
    await expect(count).not.toHaveText(before ?? '');

    await page.locator('[data-testid="find-prev"]').click();
    await expect(count).toContainText('3');
  });

  test('clearing the query removes the match count', async ({ page }) => {
    await setEditorText(page, 'foo foo foo');
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+f');

    const findInput = page.locator('[data-testid="find-input"]');
    await findInput.fill('foo');
    await expect(page.locator('[data-testid="find-match-count"]')).toBeVisible();

    await findInput.fill('');
    await expect(page.locator('[data-testid="find-match-count"]')).toHaveCount(0);
  });
});
