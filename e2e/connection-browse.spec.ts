import { test, expect } from '@playwright/test';
import { setupMock, connectToWorkspace, runQuery } from './helpers';

// Verifies the decoupling of connection *selection* from structure *browsing*:
// single-click browses a non-active connection's cached tree without switching,
// double-click switches. ds-2 has cached metadata (distinct `reporting` schema);
// ds-3 is never-connected (cold cache) and should render the placeholder.
test.describe('Connection browse vs switch (single vs double click)', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page);
  });

  test('single-click a non-active connection browses its cached structure without switching', async ({
    page,
  }) => {
    await connectToWorkspace(page); // connects ds-1 (active)
    await runQuery(page);
    await expect(page.locator('text=Alice').first()).toBeVisible(); // ds-1 results present

    await page.click('[data-testid="conn-node-ds-2"]'); // single-click the non-active connection

    // Its cached tree renders (distinct schema name avoids collision with ds-1's `public`)...
    await expect(page.getByTestId('schema-row-reporting')).toBeVisible({ timeout: 5_000 });
    // ...and the active connection's results are untouched — no switch, no reset.
    await expect(page.locator('text=Alice').first()).toBeVisible();
  });

  test('single-click a never-connected connection shows the cold-cache placeholder', async ({
    page,
  }) => {
    await connectToWorkspace(page);
    await page.click('[data-testid="conn-node-ds-3"]');
    await expect(page.getByText(/Not connected/i)).toBeVisible({ timeout: 5_000 });
  });

  test('double-click a non-active connection switches to it and resets results', async ({
    page,
  }) => {
    await connectToWorkspace(page);
    await runQuery(page);
    await expect(page.locator('text=Alice').first()).toBeVisible();

    await page.dblclick('[data-testid="conn-node-ds-2"]'); // switch connections

    // Switching opens a fresh console and resets results, so the ds-1 rows disappear.
    await expect(page.locator('text=Alice')).toHaveCount(0, { timeout: 5_000 });
  });
});
