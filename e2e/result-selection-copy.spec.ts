import { expect, test } from '@playwright/test';
import { connectToWorkspace, runQuery, setupMock } from './helpers';

// Exercises the real browser copy path (native selection -> copy event -> shaped
// clipboard payload), which the jsdom unit tests can only mock. mockQueryResult's
// first row is [1, 'Alice', 'Smith', 'alice@example.com'] under columns
// user_id, first_name, last_name, email.
test.describe('Result selection copy', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await setupMock(page);
    await connectToWorkspace(page);
    await runQuery(page);
  });

  test('double-click a cell copies its raw value', async ({ page }) => {
    const cell = page.locator('td', { hasText: 'alice@example.com' }).first();
    await cell.click({ clickCount: 2 });
    await page.keyboard.press('ControlOrMeta+c');

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe('alice@example.com');
  });

  test('triple-click a row copies JSON keyed by column with real types', async ({ page }) => {
    const cell = page.locator('td', { hasText: 'Alice' }).first();
    await cell.click({ clickCount: 3 });
    await page.keyboard.press('ControlOrMeta+c');

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(JSON.parse(clip)).toEqual({
      user_id: 1,
      first_name: 'Alice',
      last_name: 'Smith',
      email: 'alice@example.com',
    });
    // user_id survives as a real number, not a string.
    expect(clip).toContain('"user_id":1');
  });

  test('clicking the # gutter cell selects the row and copies JSON', async ({ page }) => {
    // First cell of the first body row is the row-number gutter.
    const gutter = page.locator('tbody tr').first().locator('td').first();
    await gutter.click();
    await page.keyboard.press('ControlOrMeta+c');

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(JSON.parse(clip)).toEqual({
      user_id: 1,
      first_name: 'Alice',
      last_name: 'Smith',
      email: 'alice@example.com',
    });
  });

  test('single-click highlights the row', async ({ page }) => {
    const cell = page.locator('td', { hasText: 'Alice' }).first();
    await cell.click();
    // Active-cell outline is applied inline via box-shadow.
    await expect(cell).toHaveCSS('box-shadow', /.+/);
  });
});
