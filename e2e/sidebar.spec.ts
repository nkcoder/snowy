import { test, expect, type Page } from '@playwright/test';
import { buildMockBridgeScript, mockConfig } from './mock-bridge';
import { setupMock, connectToWorkspace, expandToTable } from './helpers';

// ── 30-column mock for sidebar scroll tests ──────────────────────────────────
const PRODUCTS_COLUMNS = Array.from({ length: 30 }, (_, i) => ({
  name: `col_${i + 1}`,
  dataType: i === 0 ? 'uuid' : 'character varying',
  isNullable: 'NO',
  keyType: i === 0 ? 'pk' : '',
}));

// ── 18-column mock query result — each cell is a UUID so columns are wide ────
const WIDE_COLUMNS = Array.from({ length: 18 }, (_, i) => `column_name_${i + 1}`);
const WIDE_ROW = Array.from({ length: 18 }, (_, i) =>
  `a1b2c3d4-e5f6-7890-abcd-${String(i).padStart(12, '0')}`
);

const PRODUCTS_METADATA = {
  schemas: [{
    name: 'public',
    tables: [{
      name: 'products', type: 'BASE TABLE',
      columns: PRODUCTS_COLUMNS,
      keys: [], foreignKeys: [], indexes: [], checks: [],
    }],
  }],
};

const WIDE_QUERY_RESULT = {
  columns: WIDE_COLUMNS,
  rows: [WIDE_ROW, WIDE_ROW],
  durationMs: 10,
  rowCount: 2,
};

async function setupWorkspace30Col(page: Page) {
  // Install the shared mock so all App.tsx methods are covered; only override
  // the parts that differ for the 30-column products scenario.
  await page.addInitScript(
    buildMockBridgeScript(mockConfig, { entries: [] }, WIDE_QUERY_RESULT, []),
  );
  await page.addInitScript(`
    (function() {
      const _m = ${JSON.stringify(PRODUCTS_METADATA)};
      window.go.main.App.GetCachedMetadata = () => Promise.resolve(_m);
      window.go.main.App.RefreshMetadata   = () => Promise.resolve(_m);
      window.go.main.App.ListTables = (dsId, schema) =>
        Promise.resolve([{ schema: 'public', name: 'products', type: 'BASE TABLE' }]);
      window.go.main.App.ListColumns = (dsId, schema, table) => {
        const t = _m.schemas[0].tables.find(t => t.name === table);
        return Promise.resolve(t ? t.columns : []);
      };
    })();
  `);
  await page.goto('/');
  await page.waitForSelector('[data-testid="ds-item-ds-1"]', { timeout: 10_000 });
  await page.dblclick('[data-testid="ds-item-ds-1"]');
  await page.waitForSelector('[data-testid="sidebar-search"]', { timeout: 10_000 });
  await page.waitForSelector('[data-testid="schema-row-public"]', { timeout: 8_000 });
}

// ── Sidebar tree drill-in ────────────────────────────────────────────────────

test.describe('Sidebar tree drill-in', () => {
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

  test('columns show exact data type with modifier and the default expression', async ({ page }) => {
    await connectToWorkspace(page);
    await expandToTable(page, 'accounts');

    // Type with modifier is shown (numeric(15,2), not bare "numeric").
    await expect(page.locator('text=numeric(15,2)').first()).toBeVisible({ timeout: 5000 });
    // Defaults are appended after the type. They render in the DOM but truncate in
    // the narrow tree (type is kept visible), so assert presence rather than pixels.
    // account_id is a serial: shown with its nextval default (no literal "serial").
    await expect(
      page.locator("text=/= nextval\\('accounts_account_id_seq'/").first()
    ).toBeAttached();
    // balance carries its 0.00 default.
    await expect(page.locator('text=/= 0.00/').first()).toBeAttached();
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

// ── Sidebar scroll and layout ────────────────────────────────────────────────

test.describe('Sidebar scroll and layout', () => {
  test('sidebar tree scrolls with 30 columns expanded', async ({ page }) => {
    await setupWorkspace30Col(page);

    // Expand schema → products (columns auto-open on first expand)
    await page.click('[data-testid="schema-row-public"]');
    await page.waitForSelector('[data-testid="table-row-public-products"]', { timeout: 5000 });
    await page.click('[data-testid="table-row-public-products"]');
    await page.waitForSelector('[data-testid="subfolder-columns-public-products"]', { timeout: 5000 });

    // Allow all 30 column rows to render
    await page.waitForTimeout(400);

    // The tree container must be scrollable (scrollHeight > clientHeight)
    const result = await page.evaluate(() => {
      const scrollEl = document.querySelector('.overflow-y-auto') as HTMLElement | null;
      if (!scrollEl) return { scrollable: false, reason: 'no overflow-y-auto element' };
      return {
        scrollable: scrollEl.scrollHeight > scrollEl.clientHeight,
        scrollHeight: scrollEl.scrollHeight,
        clientHeight: scrollEl.clientHeight,
      };
    });

    expect(result.scrollable, `Sidebar tree should be scrollable — ${JSON.stringify(result)}`).toBe(true);
  });

  test('results panel stays visible when sidebar is expanded', async ({ page }) => {
    await setupWorkspace30Col(page);

    // Execute query to populate results panel first
    await page.getByRole('button', { name: /Execute/i }).click();
    await page.waitForTimeout(600);

    // Verify result tab appeared
    const resultTabBefore = await page.evaluate(() =>
      [...document.querySelectorAll('button')].some(b => b.textContent?.includes('Result'))
    );
    expect(resultTabBefore).toBe(true);

    // Expand sidebar tree to 30 columns (causes layout pressure)
    await page.click('[data-testid="schema-row-public"]');
    await page.waitForSelector('[data-testid="table-row-public-products"]', { timeout: 5000 });
    await page.click('[data-testid="table-row-public-products"]');
    await page.waitForSelector('[data-testid="subfolder-columns-public-products"]', { timeout: 5000 });
    await page.waitForTimeout(400);

    // Results tab must still be visible and in viewport
    const resultEl = page.locator('button').filter({ hasText: 'Result' }).first();
    await expect(resultEl).toBeVisible();
    const box = await resultEl.boundingBox();
    expect(box, 'Result tab must have non-zero bounds').toBeTruthy();
    expect(box!.height).toBeGreaterThan(0);
    expect(box!.width).toBeGreaterThan(0);
  });

  test('results grid has horizontal overflow with 18 columns', async ({ page }) => {
    await setupWorkspace30Col(page);

    // Execute query — mock returns 18-column result
    await page.getByRole('button', { name: /Execute/i }).click();
    await page.waitForTimeout(600);

    // Wait for the table to appear
    await page.waitForSelector('table', { timeout: 5000 });

    // Grid must have scrollWidth > clientWidth
    const overflow = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (!table) return { overflow: false, reason: 'no table' };
      const grid = table.parentElement as HTMLElement;
      return {
        overflow: grid.scrollWidth > grid.clientWidth,
        scrollWidth: grid.scrollWidth,
        clientWidth: grid.clientWidth,
        overflowX: getComputedStyle(grid).overflowX,
      };
    });

    expect(overflow.overflow, `Grid should have horizontal overflow — ${JSON.stringify(overflow)}`).toBe(true);
  });

  test('UUID column renders as string, not integer array', async ({ page }) => {
    await setupWorkspace30Col(page);

    // Execute query
    await page.getByRole('button', { name: /Execute/i }).click();
    await page.waitForTimeout(600);

    await page.waitForSelector('tbody tr', { timeout: 5000 });

    // Get text of the first data cell (col_1 which holds UUID string)
    const firstCell = await page.evaluate(() => {
      const firstRow = document.querySelector('tbody tr');
      if (!firstRow) return null;
      const cells = firstRow.querySelectorAll('td');
      // Skip row-number cell (index 0), take first data cell (index 1)
      return cells[1]?.textContent?.trim() ?? null;
    });

    expect(firstCell, 'First cell must not be null').not.toBeNull();
    // Must match UUID format (from mock: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    expect(firstCell, `UUID must match format, got: "${firstCell}"`).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    // Must NOT be comma-separated integers (the old broken format)
    expect(firstCell, 'Must not be integer array format').not.toMatch(/^\d+,\d+/);
  });
});
