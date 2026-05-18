import { test, expect, type Page } from '@playwright/test';
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
// All cells are UUID strings (36 chars each) → table is ~800px+ wider than any grid
const WIDE_ROW = Array.from({ length: 18 }, (_, i) =>
  `a1b2c3d4-e5f6-7890-abcd-${String(i).padStart(12, '0')}`
);

function buildScript() {
  return `
    const _cols30 = ${JSON.stringify(PRODUCTS_COLUMNS)};
    const _wideCols = ${JSON.stringify(WIDE_COLUMNS)};
    const _wideRow  = ${JSON.stringify(WIDE_ROW)};
    const _metadata = {
      schemas: [{
        name: 'public',
        tables: [{
          name: 'products',
          type: 'BASE TABLE',
          columns: _cols30,
          keys: [], foreignKeys: [], indexes: [], checks: [],
        }],
      }],
    };

    window.go = {
      main: {
        App: {
          GetConfig: () => Promise.resolve({
            projects: [{ id: 'p1', name: 'Test' }],
            datasources: [{
              id: 'ds-1', name: 'Demo DB', host: 'localhost', port: 5432,
              database: 'mydatabase', username: 'myuser', password: '',
              projectId: 'p1', env: 'local', sslMode: 'disable',
            }],
          }),
          SaveConfig: () => Promise.resolve(),
          UpdateDatasource: () => Promise.resolve(),
          TestDatasource: () => Promise.resolve({ Success: true, Message: 'ok' }),
          GetCompletions: () => Promise.resolve({ entries: [] }),
          GetCachedMetadata: () => Promise.resolve(_metadata),
          RefreshMetadata: () => Promise.resolve(_metadata),
          ListSchemas: () => Promise.resolve([{ name: 'public' }]),
          ListTables: () => Promise.resolve([
            { schema: 'public', name: 'products', type: 'BASE TABLE' },
          ]),
          ListColumns: () => Promise.resolve(_cols30),
          ListTableKeys: () => Promise.resolve([]),
          ListTableForeignKeys: () => Promise.resolve([]),
          ListTableIndexes: () => Promise.resolve([]),
          ListTableChecks: () => Promise.resolve([]),
          ExecuteQuery: () => Promise.resolve({
            columns: _wideCols,
            rows: [_wideRow, _wideRow],
            durationMs: 10,
            rowCount: 2,
          }),
          ListSavedQueries: () => Promise.resolve([]),
          LoadSavedQuery: () => Promise.resolve(''),
          SaveQuery: () => Promise.resolve(),
          DeleteSavedQuery: () => Promise.resolve(),
          RenameQuery: () => Promise.resolve(),
          RecordHistory: () => Promise.resolve(),
          GetQueryHistory: () => Promise.resolve([]),
          GetAppVersion: () => Promise.resolve({ version: '0.0.1', buildDate: '' }),
        },
      },
    };
    console.log('[mock-bridge] installed');
  `;
}

async function setupWorkspace30Col(page: Page) {
  await page.addInitScript(buildScript());
  await page.goto('/');
  // Wait for datasource item and double-click to connect
  await page.waitForSelector('[data-testid="ds-item-ds-1"]', { timeout: 10000 });
  await page.dblclick('[data-testid="ds-item-ds-1"]');
  // Workspace is ready when sidebar search is visible
  await page.waitForSelector('[data-testid="sidebar-search"]', { timeout: 10000 });
  // Wait for schema to appear (metadata arrives from GetCachedMetadata/RefreshMetadata)
  await page.waitForSelector('[data-testid="schema-row-public"]', { timeout: 8000 });
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
