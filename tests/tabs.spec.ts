import { expect, test, type Page } from '@playwright/test';
import { makePdf } from './pdf-fixture.mjs';

async function openPdf(page: Page, name: string, title: string, pages = 3) {
  const picker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await (await picker).setFiles({ name, mimeType: 'application/pdf', buffer: makePdf(title, pages) });
  await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
}

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('preserves each PDF, page, zoom and scroll position with one viewer and worker', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openPdf(page, 'first.pdf', 'First document');
  await page.locator('#zoom').selectOption('1.5');
  await page.locator('#next').click();
  await expect(page.locator('#page-number')).toHaveValue('2');
  await page.locator('#viewer-container').evaluate(container => { container.scrollTop += 120; });
  const scroll = await page.locator('#viewer-container').evaluate(async container => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return container.scrollTop;
  });
  await openPdf(page, 'second.pdf', 'Second document', 2);
  await expect(page.locator('#page-count')).toHaveText('/ 2');
  await expect(page.locator('.page')).toHaveCount(2);
  await expect(page.locator('.page[data-page-number="1"] .textLayer span').first()).toHaveText('Second document page 1');
  await expect(page.locator('#zoom')).toHaveValue('page-width');
  await page.getByRole('tab', { name: 'first.pdf', exact: true }).click();
  await expect(page.locator('#page-count')).toHaveText('/ 3');
  await expect(page.locator('#page-number')).toHaveValue('2');
  await expect(page.locator('#zoom')).toHaveValue('1.5');
  await expect(page.locator('.page[data-page-number="2"] .textLayer span').first()).toHaveText('First document page 2');
  await expect.poll(() => page.locator('#viewer-container').evaluate(container => container.scrollTop)).toBeCloseTo(scroll, 0);
  expect(page.workers()).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('closing an inactive tab leaves the active canvas and view intact', async ({ page }) => {
  await openPdf(page, 'first.pdf', 'First');
  await openPdf(page, 'second.pdf', 'Second', 2);
  await expect(page.locator('.page canvas').first()).toBeVisible();
  const canvas = await page.locator('.page canvas').first().elementHandle();
  await page.getByRole('button', { name: 'Close first.pdf', exact: true }).click();
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(page.locator('#filename')).toHaveText('second.pdf');
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(true);
  await expect(page.locator('#page-count')).toHaveText('/ 2');
});

test('closing the active tab selects a neighbor and closing the last returns to welcome', async ({ page }) => {
  await openPdf(page, 'first.pdf', 'First');
  await page.locator('#zoom').selectOption('1.25');
  await page.locator('#next').click();
  await openPdf(page, 'second.pdf', 'Second');
  await openPdf(page, 'third.pdf', 'Third');
  await page.getByRole('tab', { name: 'second.pdf', exact: true }).click();
  await page.getByRole('button', { name: 'Close second.pdf', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'third.pdf', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Close third.pdf', exact: true }).click();
  await expect(page.locator('#page-number')).toHaveValue('2');
  await expect(page.locator('#zoom')).toHaveValue('1.25');
  await page.getByRole('button', { name: 'Close first.pdf', exact: true }).click();
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('.page')).toHaveCount(0);
  await expect(page.locator('#next')).toBeDisabled();
  await openPdf(page, 'reopened.pdf', 'Reopened', 1);
  await expect(page.locator('.textLayer span').first()).toHaveText('Reopened page 1');
  await expect(page.locator('#page-count')).toHaveText('/ 1');
});

test('supports keyboard switching, tab-list navigation and closing', async ({ page }) => {
  await openPdf(page, 'first.pdf', 'First');
  await openPdf(page, 'second.pdf', 'Second');
  await page.keyboard.press('Control+Tab');
  await expect(page.getByRole('tab', { name: 'first.pdf', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Control+Shift+Tab');
  await expect(page.getByRole('tab', { name: 'second.pdf', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'first.pdf', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'second.pdf', exact: true })).toBeFocused();
  await page.keyboard.press('Control+w');
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(page.locator('#filename')).toHaveText('first.pdf');
});

test('long tab titles scroll within the tab strip in a small window', async ({ page }) => {
  await page.setViewportSize({ width: 460, height: 500 });
  for (let i = 0; i < 4; i++) await openPdf(page, `a fairly long document title ${i}.pdf`, `Document ${i}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator('#document-tabs').evaluate(list => list.scrollWidth > list.clientWidth)).toBe(true);
  await expect(page.getByRole('tab').last()).toBeInViewport();
});
