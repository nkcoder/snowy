import type { Page } from '@playwright/test';
import {
  buildMockBridgeScript,
  mockConfig,
  mockCompletions,
  mockQueryResult,
  mockHistoryEntries,
} from './mock-bridge';

export async function setupMock(page: Page, customCompletions?: object) {
  await page.addInitScript(
    buildMockBridgeScript(
      mockConfig,
      customCompletions ?? mockCompletions,
      mockQueryResult,
      mockHistoryEntries,
    ),
  );
}

export async function connectToWorkspace(page: Page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="ds-item-ds-1"]', { timeout: 10_000 });
  await page.dblclick('[data-testid="ds-item-ds-1"]');
  await page.waitForSelector('[data-testid="sidebar-search"]', { timeout: 10_000 });
  await page.waitForTimeout(300); // let GetCompletions resolve
}

export async function setEditorText(page: Page, text: string) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type(text);
}

export async function waitForTooltip(page: Page, ms = 1_000): Promise<number | null> {
  const t0 = Date.now();
  try {
    await page.waitForSelector('.cm-tooltip-autocomplete', { state: 'visible', timeout: ms });
    return Date.now() - t0;
  } catch {
    return null;
  }
}

export async function getTooltipItems(page: Page): Promise<string[]> {
  return page.locator('.cm-tooltip-autocomplete li').allTextContents();
}

export async function runQuery(
  page: Page,
  sql = 'SELECT * FROM users LIMIT 10;',
  waitText = 'user_id',
) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type(sql);
  await page.locator('[data-testid="run-button"]').click();
  await page.locator(`text=${waitText}`).first().waitFor({ timeout: 5_000 });
}

export async function expandToTable(page: Page, tableName: string) {
  await page.waitForSelector('[data-testid="schema-row-public"]', { timeout: 5_000 });
  await page.click('[data-testid="schema-row-public"]');
  await page.waitForSelector(`[data-testid="table-row-public-${tableName}"]`, { timeout: 5_000 });
  await page.click(`[data-testid="table-row-public-${tableName}"]`);
}
