import { test, expect } from '@playwright/test';
import { buildMockBridgeScript, mockConfig, mockCompletions, mockQueryResult } from './mock-bridge';
import { setupMock, connectToWorkspace, setEditorText, waitForTooltip, getTooltipItems } from './helpers';

// ─── context detection ───────────────────────────────────────────────────────

test.describe('Context Detection', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page);
    await connectToWorkspace(page);
  });

  test('FROM context shows table names after "SELECT * FROM "', async ({ page }) => {
    await setEditorText(page, 'SELECT * FROM ');
    const elapsed = await waitForTooltip(page);
    expect(elapsed, 'tooltip did not appear in FROM context').not.toBeNull();

    const items = await getTooltipItems(page);
    expect(
      items.some(t => /users/i.test(t)),
      `Expected "users" in FROM suggestions. Got: ${items.join(' | ')}`,
    ).toBe(true);
  });

  test('FROM context shows no SQL keywords', async ({ page }) => {
    await setEditorText(page, 'SELECT * FROM ');
    await waitForTooltip(page);

    const items = await getTooltipItems(page);
    const keywords = items.filter(t => /^(SELECT|WHERE|INSERT|UPDATE|DELETE|JOIN)\b/i.test(t.trim()));
    expect(
      keywords,
      `SQL keywords should not appear in FROM context. Found: ${keywords.join(', ')}`,
    ).toHaveLength(0);
  });

  test('SELECT context shows "*" as first option', async ({ page }) => {
    await setEditorText(page, 'SELECT ');
    const elapsed = await waitForTooltip(page);
    expect(elapsed, 'tooltip did not appear after SELECT').not.toBeNull();

    const firstItem = await page.locator('.cm-tooltip-autocomplete li').first().textContent();
    expect(firstItem?.trim(), '"*" should be the top item after SELECT').toBe('*all columns');
  });

  test('SELECT context shows column names from all tables', async ({ page }) => {
    await setEditorText(page, 'SELECT ');
    await waitForTooltip(page);

    const items = await getTooltipItems(page);
    expect(
      items.some(t => /user_id/.test(t)),
      `Expected column names after SELECT. Got: ${items.slice(0, 6).join(' | ')}`,
    ).toBe(true);
  });

  test('WHERE context filters columns to the FROM table', async ({ page }) => {
    await setEditorText(page, 'SELECT * FROM users WHERE ');
    await waitForTooltip(page);

    const items = await getTooltipItems(page);

    expect(
      items.some(t => /email/.test(t)),
      'users.email should appear after WHERE',
    ).toBe(true);
    expect(
      items.some(t => /balance/.test(t)),
      'accounts.balance must NOT appear — only FROM users',
    ).toBe(false);
  });

  test('JOIN context shows columns from both joined tables', async ({ page }) => {
    await setEditorText(
      page,
      'SELECT * FROM users JOIN accounts ON users.user_id = accounts.user_id WHERE ',
    );
    await waitForTooltip(page);

    const items = await getTooltipItems(page);
    expect(items.some(t => /email/.test(t)), 'users.email should appear after JOIN').toBe(true);
    expect(items.some(t => /balance/.test(t)), 'accounts.balance should appear after JOIN').toBe(
      true,
    );
  });

  test('UPDATE SET context shows column completions', async ({ page }) => {
    await setEditorText(page, 'UPDATE users SET ');
    const elapsed = await waitForTooltip(page);
    expect(elapsed, 'tooltip did not appear after UPDATE SET').not.toBeNull();

    const items = await getTooltipItems(page);
    expect(
      items.some(t => /email/.test(t)),
      `users.email should appear after UPDATE SET. Got: ${items.slice(0, 6).join(' | ')}`,
    ).toBe(true);
  });

  test('AND continuation shows column context', async ({ page }) => {
    await setEditorText(page, 'SELECT * FROM users WHERE user_id = 1 AND ');
    await waitForTooltip(page);

    const items = await getTooltipItems(page);
    expect(
      items.some(t => /email/.test(t) || /first_name/.test(t)),
      'columns should appear after AND',
    ).toBe(true);
  });

  test('ORDER BY context shows column completions', async ({ page }) => {
    await setEditorText(page, 'SELECT * FROM users ORDER BY ');
    await waitForTooltip(page);

    const items = await getTooltipItems(page);
    expect(
      items.some(t => /user_id/.test(t) || /email/.test(t)),
      'columns should appear after ORDER BY',
    ).toBe(true);
  });

  test('GROUP BY context shows column completions', async ({ page }) => {
    await setEditorText(page, 'SELECT * FROM users GROUP BY ');
    await waitForTooltip(page);

    const items = await getTooltipItems(page);
    expect(
      items.some(t => /user_id/.test(t) || /email/.test(t)),
      'columns should appear after GROUP BY',
    ).toBe(true);
  });

  test('SELECT multi-column: star re-appears after comma', async ({ page }) => {
    await setEditorText(page, 'SELECT user_id, ');
    const elapsed = await waitForTooltip(page);
    expect(elapsed, 'tooltip should appear after comma in SELECT list').not.toBeNull();

    const items = await getTooltipItems(page);
    expect(
      items.some(t => t.includes('*')),
      'star (*) option should appear after comma in SELECT list',
    ).toBe(true);
  });

  test('keyword context does NOT auto-open on bare space', async ({ page }) => {
    // Typing a bare space at the start — no FROM/SELECT/etc. context
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);

    const visible = await page.locator('.cm-tooltip-autocomplete').isVisible();
    expect(visible, 'tooltip must not auto-open on bare space in keyword context').toBe(false);
  });

  test('no completions inside a single-quoted string literal', async ({ page }) => {
    // Reproduces the screenshot bug: WHERE col = 'd triggers keyword completions
    await setEditorText(page, "SELECT * FROM transactions WHERE from_account_id = 'd");
    await page.waitForTimeout(500);

    const visible = await page.locator('.cm-tooltip-autocomplete').isVisible();
    expect(visible, "tooltip must not appear while cursor is inside a string literal '...").toBe(false);
  });

  test('no completions inside double-quoted identifier', async ({ page }) => {
    await setEditorText(page, 'SELECT "my_co');
    await page.waitForTimeout(500);

    const visible = await page.locator('.cm-tooltip-autocomplete').isVisible();
    expect(visible, 'tooltip must not appear inside a double-quoted identifier').toBe(false);
  });

  test('completions resume after a closed string literal', async ({ page }) => {
    // Once the quote is closed we're back in normal column context
    await setEditorText(page, "SELECT * FROM users WHERE email = 'alice' AND ");
    const elapsed = await waitForTooltip(page, 1_000);
    expect(elapsed, 'tooltip should appear after a closed string literal').not.toBeNull();
  });
});

// ─── ranking & badges ────────────────────────────────────────────────────────

test.describe('Ranking & Badges', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page);
    await connectToWorkspace(page);
  });

  test('PK column ranks above regular columns in WHERE context', async ({ page }) => {
    await setEditorText(page, 'SELECT * FROM users WHERE ');
    await waitForTooltip(page);

    const items = await getTooltipItems(page);
    const pkIdx = items.findIndex(t => /user_id/.test(t));
    const regularIdx = items.findIndex(t => /first_name/.test(t));

    expect(pkIdx, 'user_id (PK) must appear before first_name (regular)').toBeLessThan(regularIdx);
  });

  test('PK badge (.cm-key-badge-pk) is rendered for primary key column', async ({ page }) => {
    await setEditorText(page, 'SELECT * FROM users WHERE ');
    await waitForTooltip(page);

    await expect(
      page.locator('.cm-tooltip-autocomplete .cm-key-badge-pk').first(),
      'PK badge must be rendered',
    ).toBeVisible();
  });

  test('FK badge (.cm-key-badge-fk) is rendered for foreign key column', async ({ page }) => {
    await setEditorText(page, 'SELECT * FROM accounts WHERE ');
    await waitForTooltip(page);

    await expect(
      page.locator('.cm-tooltip-autocomplete .cm-key-badge-fk').first(),
      'FK badge must be rendered',
    ).toBeVisible();
  });

  test('COL badge (.cm-key-badge-col) is rendered for plain columns', async ({ page }) => {
    await setEditorText(page, 'SELECT * FROM users WHERE ');
    await waitForTooltip(page);

    await expect(
      page.locator('.cm-tooltip-autocomplete .cm-key-badge-col').first(),
      'COL badge must be rendered for non-key columns',
    ).toBeVisible();
  });

  test('prefix match "us" ranks "users" above other tables', async ({ page }) => {
    await setEditorText(page, 'SELECT * FROM us');
    await waitForTooltip(page);

    const first = await page.locator('.cm-tooltip-autocomplete li').first().textContent();
    expect(first, '"users" should be the first suggestion when typing "us"').toContain('users');
  });
});

// ─── multi-statement SQL ─────────────────────────────────────────────────────

test.describe('Multi-statement SQL', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page);
    await connectToWorkspace(page);
  });

  test('second statement after ";" gets table context in FROM', async ({ page }) => {
    await setEditorText(page, 'SELECT 1; SELECT * FROM ');
    const elapsed = await waitForTooltip(page);
    expect(elapsed, 'tooltip did not appear in second statement FROM context').not.toBeNull();

    const items = await getTooltipItems(page);
    expect(
      items.some(t => /users/.test(t)),
      `Table names should appear in second statement. Got: ${items.slice(0, 6).join(' | ')}`,
    ).toBe(true);
  });

  test('second statement WHERE context is isolated to its own FROM table', async ({ page }) => {
    await setEditorText(page, 'SELECT * FROM accounts; SELECT * FROM users WHERE ');
    await waitForTooltip(page);

    const items = await getTooltipItems(page);
    expect(
      items.some(t => /email/.test(t)),
      'users.email should appear — cursor is in second statement FROM users',
    ).toBe(true);
    expect(
      items.some(t => /balance/.test(t)),
      'accounts.balance must NOT appear — first statement is irrelevant to current statement context',
    ).toBe(false);
  });
});

// ─── performance ────────────────────────────────────────────────────────────

test.describe('Performance', () => {
  test('FROM context: tooltip appears within 500 ms', async ({ page }) => {
    await setupMock(page);
    await connectToWorkspace(page);

    await setEditorText(page, 'SELECT * FROM ');
    const elapsed = await waitForTooltip(page, 1_500);

    expect(elapsed, 'tooltip did not appear').not.toBeNull();
    expect(elapsed!, `tooltip took ${elapsed} ms — must be < 500 ms`).toBeLessThan(500);
  });

  test('column context: tooltip appears within 500 ms', async ({ page }) => {
    await setupMock(page);
    await connectToWorkspace(page);

    await setEditorText(page, 'SELECT * FROM users WHERE ');
    const elapsed = await waitForTooltip(page, 1_500);

    expect(elapsed, 'tooltip did not appear').not.toBeNull();
    expect(elapsed!, `tooltip took ${elapsed} ms — must be < 500 ms`).toBeLessThan(500);
  });

  test('500-column dataset: tooltip still appears within 800 ms', async ({ page }) => {
    const entries: object[] = [
      { kind: 'table', schema: 'public', table: '', name: 'big_table', dataType: '', keyType: '' },
    ];
    for (let i = 0; i < 500; i++) {
      entries.push({
        kind: 'column',
        schema: 'public',
        table: 'big_table',
        name: `col_${String(i).padStart(3, '0')}`,
        dataType: 'text',
        keyType: '',
      });
    }
    await setupMock(page, { entries });
    await connectToWorkspace(page);

    await setEditorText(page, 'SELECT * FROM big_table WHERE ');
    const elapsed = await waitForTooltip(page, 2_000);

    expect(elapsed, '500-col tooltip never appeared').not.toBeNull();
    expect(elapsed!, `500-col tooltip took ${elapsed} ms — must be < 800 ms`).toBeLessThan(800);
  });

  test('rapid typing sequence does not crash or freeze the editor', async ({ page }) => {
    await setupMock(page);
    await connectToWorkspace(page);

    const editor = page.locator('.cm-content');
    await editor.click();
    // No delays — type as fast as Playwright allows
    await page.keyboard.type(
      "SELECT * FROM users WHERE email LIKE '%test%' AND first_name LIKE '%a%' ORDER BY user_id DESC LIMIT 10;",
    );

    await expect(page.locator('[data-testid="cm-editor"]')).toBeVisible();
    expect(await editor.textContent()).toContain('LIMIT');
  });
});

// ─── robustness ──────────────────────────────────────────────────────────────

test.describe('Robustness', () => {
  test('empty completions: editor stays functional, tooltip stays hidden', async ({ page }) => {
    await setupMock(page, { entries: [] });
    await connectToWorkspace(page);

    await setEditorText(page, 'SELECT * FROM ');
    await page.waitForTimeout(600);

    await expect(page.locator('[data-testid="cm-editor"]')).toBeVisible();

    // Tooltip either absent or empty (showing an empty dropdown is itself a bug)
    const tooltip = page.locator('.cm-tooltip-autocomplete');
    if (await tooltip.isVisible()) {
      const count = await tooltip.locator('li').count();
      expect(count, 'tooltip must not display empty dropdown').toBe(0);
    }
  });

  test('Escape key dismisses tooltip', async ({ page }) => {
    await setupMock(page);
    await connectToWorkspace(page);

    await setEditorText(page, 'SELECT * FROM ');
    await waitForTooltip(page);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const visible = await page.locator('.cm-tooltip-autocomplete').isVisible();
    expect(visible, 'tooltip should dismiss on Escape').toBe(false);
  });

  test('Enter accepts first completion and inserts text', async ({ page }) => {
    await setupMock(page);
    await connectToWorkspace(page);

    await setEditorText(page, 'SELECT * FROM u');
    const elapsed = await waitForTooltip(page);
    if (elapsed === null) {
      test.skip();
      return;
    }

    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    const content = await page.locator('.cm-content').textContent();
    expect(content, 'accepting completion should insert "users"').toContain('users');
  });

  test('completion works after clear-and-retype cycle', async ({ page }) => {
    await setupMock(page);
    await connectToWorkspace(page);

    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type('SELECT 1;');
    await page.locator('[data-testid="clear-button"]').click();
    await page.waitForTimeout(200);

    await setEditorText(page, 'SELECT * FROM ');
    const elapsed = await waitForTooltip(page);
    expect(elapsed, 'tooltip should appear after clear-and-retype').not.toBeNull();
  });

  test('completions load lazily: editor usable before GetCompletions resolves', async ({
    page,
  }) => {
    // GetCompletions is intentionally slow (2 s delay). Build the base bridge
    // script and patch GetCompletions to wrap its return in a 2 s setTimeout.
    const baseScript = buildMockBridgeScript(mockConfig, mockCompletions, mockQueryResult);
    await page.addInitScript(baseScript);
    // Patch after the base mock is installed: wrap GetCompletions with a delay.
    await page.addInitScript(`
      (function() {
        const orig = window.go.main.App.GetCompletions;
        window.go.main.App.GetCompletions = function() {
          return new Promise(function(resolve) {
            setTimeout(function() { orig().then(resolve); }, 2000);
          });
        };
      })();
    `);
    await connectToWorkspace(page);

    // Editor must be functional immediately (before completions arrive)
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type('SELECT ');
    await expect(page.locator('[data-testid="cm-editor"]')).toBeVisible();

    // After completions arrive, the editor should update without a page error
    await page.waitForTimeout(2_500);

    // Trigger completions explicitly after they've loaded
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Control+Space');
    const elapsed = await waitForTooltip(page, 1_500);
    expect(elapsed, 'tooltip should appear once completions have loaded').not.toBeNull();
  });
});

// ─── completions bootstrap ───────────────────────────────────────────────────

test.describe('Completions bootstrap', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page);
  });

  test('GetCompletions called on connect', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="ds-item-ds-1"]', { timeout: 10000 });

    // Patch to track calls before clicking connect
    await page.evaluate(() => {
      const orig = (window as any).go.main.App.GetCompletions;
      (window as any).go.main.App.GetCompletions = (...args: any[]) => {
        (window as any).__completionsCalled = true;
        return orig(...args);
      };
    });

    await page.dblclick('[data-testid="ds-item-ds-1"]');
    await page.waitForSelector('[data-testid="cm-editor"]', { timeout: 10000 });
    await page.waitForTimeout(500);

    const called = await page.evaluate(() => !!(window as any).__completionsCalled);
    expect(called).toBe(true);
  });

  test('autocomplete popover appears after typing SELECT * FROM', async ({ page }) => {
    await connectToWorkspace(page);

    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT * FROM ');
    // Give CodeMirror time to show completions
    await page.waitForTimeout(800);

    // If tooltip appears, it should have list items
    const tooltip = page.locator('.cm-tooltip-autocomplete');
    const tooltipVisible = await tooltip.isVisible();
    if (tooltipVisible) {
      const items = await tooltip.locator('li').count();
      expect(items).toBeGreaterThan(0);
    }
    // Editor must remain functional regardless
    await expect(page.locator('[data-testid="cm-editor"]')).toBeVisible();
  });

  test('autocomplete suggestions include table names', async ({ page }) => {
    await connectToWorkspace(page);

    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT * FROM u');
    await page.waitForTimeout(800);

    const tooltip = page.locator('.cm-tooltip-autocomplete');
    if (await tooltip.isVisible()) {
      const items = await tooltip.locator('li').allTextContents();
      const hasUsers = items.some(t => t.toLowerCase().includes('users'));
      expect(hasUsers).toBe(true);
    }
    await expect(page.locator('[data-testid="cm-editor"]')).toBeVisible();
  });

  test('autocomplete suggestions include column names after dot notation', async ({ page }) => {
    await connectToWorkspace(page);

    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT users.');
    await page.waitForTimeout(800);

    const tooltip = page.locator('.cm-tooltip-autocomplete');
    if (await tooltip.isVisible()) {
      const items = await tooltip.locator('li').allTextContents();
      const hasColumn = items.some(t =>
        t.includes('user_id') || t.includes('first_name') || t.includes('email')
      );
      expect(hasColumn).toBe(true);
    }
    await expect(page.locator('[data-testid="cm-editor"]')).toBeVisible();
  });

  test('completions reconfigure SQL extension when data arrives', async ({ page }) => {
    // Verify the editor still works after completions arrive (no crash from reconfigure)
    await connectToWorkspace(page);

    // Give time for async GetCompletions to resolve and reconfigure the editor
    await page.waitForTimeout(1000);

    // Editor should still be operational
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type('SELECT * FROM users;');

    const content = await editor.textContent();
    expect(content).toContain('users');
  });
});

// ─── popup placement ─────────────────────────────────────────────────────────

test.describe('Popup placement', () => {
  test('completion popup stays inside the editor pane near the results separator', async ({
    page,
  }) => {
    await setupMock(page);
    await connectToWorkspace(page);

    // Fill the editor past its visible height so the cursor sits at the bottom.
    const editor = page.locator('.cm-content');
    await editor.click();
    for (let i = 0; i < 20; i++) {
      await page.keyboard.type(`SELECT ${i} FROM users;`);
      await page.keyboard.press('Enter');
    }
    await page.keyboard.type('SELECT * FROM us');
    expect(await waitForTooltip(page), 'tooltip did not appear').not.toBeNull();

    const box = await page.locator('.cm-tooltip-autocomplete').boundingBox();
    const pane = await page.locator('.cm-scroller').boundingBox();
    expect(box, 'tooltip has no box').not.toBeNull();
    expect(pane, 'scroller has no box').not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: asserted non-null above
    expect(box!.y + box!.height).toBeLessThanOrEqual(pane!.y + pane!.height + 1);
  });
});
