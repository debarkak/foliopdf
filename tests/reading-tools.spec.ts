import { expect, test, type Page } from '@playwright/test';
import { makePdf } from './pdf-fixture.mjs';

async function openPdf(page: Page, name = 'notes.pdf', title = 'Needle') {
  const picker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await (await picker).setFiles({ name, mimeType: 'application/pdf', buffer: makePdf(title) });
  await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
}

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('finds case-insensitive text, highlights it and navigates between pages', async ({ page }) => {
  await openPdf(page);
  await page.keyboard.press('Control+f');
  await expect(page.getByRole('searchbox', { name: 'Find text' })).toBeFocused();
  await page.locator('#find-query').fill('NEEDLE');
  await expect(page.locator('#find-count')).toHaveText('1 of 3');
  await expect(page.locator('.textLayer .highlight.selected').first()).toHaveText('Needle');
  await page.keyboard.press('Enter');
  await expect(page.locator('#find-count')).toHaveText('2 of 3');
  await expect(page.locator('#page-number')).toHaveValue('2');
  await page.keyboard.press('Shift+Enter');
  await expect(page.locator('#find-count')).toHaveText('1 of 3');
  await page.getByRole('button', { name: 'Previous match', exact: true }).click();
  await expect(page.locator('#find-count')).toHaveText('3 of 3');
  await expect(page.locator('#page-number')).toHaveValue('3');
});

test('handles missing text, clearing and closing without leaving highlights', async ({ page }) => {
  await openPdf(page);
  await page.getByRole('button', { name: 'Find in document', exact: true }).click();
  await page.locator('#find-query').fill('not in this document');
  await expect(page.locator('#find-count')).toHaveText('No matches');
  await expect(page.locator('#find-next')).toBeDisabled();
  await page.locator('#find-query').fill('Selectable text');
  await expect(page.locator('#find-count')).toHaveText('1 of 3');
  await page.locator('#find-query').fill('');
  await expect(page.locator('#find-count')).toBeEmpty();
  await expect(page.locator('.textLayer .highlight')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#find-bar')).toBeHidden();
  await expect(page.locator('#find-toggle')).toBeFocused();
});

test('scopes search to the active document and keeps it when an inactive tab closes', async ({ page }) => {
  await openPdf(page, 'first.pdf', 'First');
  await openPdf(page, 'second.pdf', 'Second');
  await page.keyboard.press('Control+f');
  await page.locator('#find-query').fill('Second');
  await expect(page.locator('#find-count')).toHaveText('1 of 3');
  await page.getByRole('button', { name: 'Close first.pdf', exact: true }).click();
  await expect(page.locator('#find-count')).toHaveText('1 of 3');
  await openPdf(page, 'third.pdf', 'Third');
  await expect(page.locator('#find-bar')).toBeHidden();
  await page.keyboard.press('Control+f');
  await expect(page.locator('#find-query')).toHaveValue('');
  await page.locator('#find-query').fill('Second');
  await expect(page.locator('#find-count')).toHaveText('No matches');
});

test('supports F3 and Ctrl+G without opening a browser find panel', async ({ page }) => {
  await openPdf(page);
  await page.keyboard.press('Control+f');
  await page.locator('#find-query').fill('Needle');
  await expect(page.locator('#find-count')).toHaveText('1 of 3');
  await page.keyboard.press('F3');
  await expect(page.locator('#find-count')).toHaveText('2 of 3');
  await page.keyboard.press('Control+Shift+g');
  await expect(page.locator('#find-count')).toHaveText('1 of 3');
});

test('reads pages horizontally and remembers direction, page and zoom in each tab', async ({ page }) => {
  await openPdf(page, 'first.pdf');
  await page.locator('#zoom').selectOption('1.25');
  await page.locator('#next').click();
  await page.getByRole('button', { name: 'Horizontal pages', exact: true }).click();
  await expect(page.locator('#page-number')).toHaveValue('2');
  await expect(page.locator('#viewer')).toHaveClass(/scrollHorizontal/);
  const boxes = await page.locator('.page').evaluateAll(pages => pages.map(page => {
    const { x, y, width } = page.getBoundingClientRect(); return { x, y, width };
  }));
  expect(boxes[1].x).toBeGreaterThan(boxes[0].x + boxes[0].width);
  expect(Math.abs(boxes[1].y - boxes[0].y)).toBeLessThan(2);
  await openPdf(page, 'second.pdf');
  await expect(page.locator('#layout-vertical')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: 'first.pdf', exact: true }).click();
  await expect(page.locator('#layout-horizontal')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#page-number')).toHaveValue('2');
  await expect(page.locator('#zoom')).toHaveValue('1.25');
  await page.getByRole('button', { name: 'Vertical pages', exact: true }).click();
  await expect(page.locator('#page-number')).toHaveValue('2');
  await expect(page.locator('#viewer')).not.toHaveClass(/scrollHorizontal/);
});

test('finds a match on another horizontal page and keeps a small window usable', async ({ page }) => {
  await page.setViewportSize({ width: 460, height: 560 });
  await openPdf(page);
  await page.getByRole('button', { name: 'Horizontal pages', exact: true }).click();
  await page.locator('#zoom').selectOption('page-fit');
  await page.keyboard.press('Control+f');
  await page.locator('#find-query').fill('page 3');
  await expect(page.locator('#find-count')).toHaveText('1 of 1');
  await expect(page.locator('#page-number')).toHaveValue('3');
  await expect(page.locator('.page[data-page-number="3"] .highlight.selected')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.toolbar').evaluate(toolbar => toolbar.getBoundingClientRect().height)).toBeLessThan(110);
});


test('rotates pages without changing other tabs or the PDF', async ({ page }) => {
  const rotate = page.getByRole('button', { name: 'Rotate pages clockwise' });
  await expect(rotate).toBeDisabled();
  await openPdf(page, 'first.pdf');
  const pdfPage = page.locator('.page[data-page-number="1"]');
  await expect(pdfPage).toHaveAttribute('data-page-number', '1');
  const before = await pdfPage.evaluate(el => ({ width: el.clientWidth, height: el.clientHeight }));
  await rotate.click();
  await expect.poll(() => pdfPage.evaluate(el => el.clientWidth > el.clientHeight)).toBe(true);
  await openPdf(page, 'second.pdf');
  await expect.poll(() => pdfPage.evaluate(el => el.clientWidth < el.clientHeight)).toBe(true);
  await page.getByRole('tab', { name: 'first.pdf', exact: true }).click();
  await expect.poll(() => pdfPage.evaluate(el => el.clientWidth > el.clientHeight)).toBe(true);
  for (let i = 0; i < 3; i++) await rotate.click();
  await expect.poll(() => pdfPage.evaluate(el => el.clientWidth < el.clientHeight)).toBe(true);
  expect(before.width).toBeLessThan(before.height);
});


test('keyboard shortcuts navigate and rotate without intercepting text input', async ({ page }) => {
  await openPdf(page);
  await page.locator('#document-area').click({ position: { x: 2, y: 2 } });
  await page.keyboard.press('Control+End');
  await expect(page.locator('#page-number')).toHaveValue('3');
  await page.keyboard.press('Control+Home');
  await expect(page.locator('#page-number')).toHaveValue('1');
  const pdfPage = page.locator('.page[data-page-number="1"]');
  await page.keyboard.press('r');
  await expect.poll(() => pdfPage.evaluate(el => el.clientWidth > el.clientHeight)).toBe(true);
  await page.keyboard.press('Shift+r');
  await expect.poll(() => pdfPage.evaluate(el => el.clientWidth < el.clientHeight)).toBe(true);
  await page.getByRole('button', { name: 'Find in document' }).click();
  await page.getByRole('searchbox', { name: 'Find text' }).fill('reader');
  await expect(page.getByRole('searchbox', { name: 'Find text' })).toHaveValue('reader');
  await expect.poll(() => pdfPage.evaluate(el => el.clientWidth < el.clientHeight)).toBe(true);
});
