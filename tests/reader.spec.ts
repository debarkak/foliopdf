import { expect, test, type Page } from '@playwright/test';
import { makePdf } from './pdf-fixture';

async function openPdf(page: Page, name = 'reader.pdf', buffer = makePdf()) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await (await chooser).setFiles({ name, mimeType: 'application/pdf', buffer });
}

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('renders a local PDF with text that can be selected', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openPdf(page);
  await expect(page.locator('#filename')).toHaveText('reader.pdf');
  await expect(page.locator('#page-count')).toHaveText('/ 3');
  const text = page.locator('.page[data-page-number="1"] .textLayer span').first();
  await expect(text).toHaveText('Folio reader page 1');
  const bounds = await text.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width - 2, bounds!.y + bounds!.height / 2, { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toContain('Folio reader page');
  await expect.poll(() => page.locator('.page canvas').first().evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < data.length; i += 4) if (data[i] < 100 && data[i + 3] > 0) return true;
    return false;
  })).toBe(true);
  expect(errors).toEqual([]);
});

test('navigates with buttons, page numbers and vertical scrolling', async ({ page }) => {
  await openPdf(page);
  await expect(page.locator('#next')).toBeEnabled();
  await page.locator('#next').click();
  await expect(page.locator('#page-number')).toHaveValue('2');
  await page.locator('#page-number').fill('3');
  await page.locator('#page-number').press('Enter');
  await expect(page.locator('#next')).toBeDisabled();
  await page.locator('#page-number').fill('99');
  await page.locator('#page-number').press('Enter');
  await expect(page.locator('#page-number')).toHaveValue('3');
  await page.locator('#viewer-container').evaluate(container => { container.scrollTop = 0; });
  await expect(page.locator('#page-number')).toHaveValue('1');
  await expect(page.locator('#previous')).toBeDisabled();
});

test('supports percentage zoom, fit modes and keyboard shortcuts', async ({ page }) => {
  await openPdf(page);
  await expect(page.locator('#zoom')).toBeEnabled();
  await page.locator('#zoom').selectOption('1');
  const width = await page.locator('.page').first().evaluate(p => p.getBoundingClientRect().width);
  await page.locator('#zoom').selectOption('1.5');
  await expect.poll(() => page.locator('.page').first().evaluate(p => p.getBoundingClientRect().width)).toBeGreaterThan(width * 1.4);
  await page.keyboard.press('Control+0');
  await expect(page.locator('#zoom')).toHaveValue('1');
  await page.locator('#zoom-in').click();
  await expect(page.locator('#zoom')).toHaveValue('1.25');
  await page.locator('#zoom-out').click();
  await expect(page.locator('#zoom')).toHaveValue('1');
  await page.locator('#zoom').selectOption('page-fit');
  await expect(page.locator('#zoom')).toHaveValue('page-fit');
  await page.locator('#zoom').selectOption('page-width');
  await page.setViewportSize({ width: 700, height: 650 });
  await expect.poll(() => page.locator('.page').first().evaluate(p => p.getBoundingClientRect().width)).toBeLessThan(700);
});

test('reports invalid files and can open another PDF afterward', async ({ page }) => {
  await openPdf(page, 'broken.pdf', Buffer.from('not a PDF'));
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#error-message')).toContainText('not a valid PDF');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await openPdf(page);
  await expect(page.locator('#page-count')).toHaveText('/ 3');
  await expect(page.locator('#filename')).toHaveText('reader.pdf');
});

test('replaces the current document and resets its page and zoom', async ({ page }) => {
  await openPdf(page);
  await expect(page.locator('#next')).toBeEnabled();
  await page.locator('#next').click();
  await page.locator('#zoom').selectOption('2');
  await openPdf(page, 'another.pdf');
  await expect(page.locator('#filename')).toHaveText('another.pdf');
  await expect(page.locator('#page-number')).toHaveValue('1');
  await expect(page.locator('#zoom')).toHaveValue('page-width');
  await expect(page.locator('.page')).toHaveCount(3);
});

test('keeps the toolbar inside a small window', async ({ page }) => {
  await page.setViewportSize({ width: 460, height: 500 });
  await expect(page.getByRole('button', { name: 'Open PDF', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('keeps the current document when the file picker is cancelled', async ({ page }) => {
  await openPdf(page);
  await expect(page.locator('#next')).toBeEnabled();
  await page.locator('#next').click();
  await page.locator('#zoom').selectOption('1.5');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await (await chooser).setFiles([]);
  await expect(page.locator('#open')).toBeEnabled();
  await expect(page.locator('#filename')).toHaveText('reader.pdf');
  await expect(page.locator('#page-number')).toHaveValue('2');
  await expect(page.locator('#zoom')).toHaveValue('1.5');
});

test('clears stale pages after an invalid replacement', async ({ page }) => {
  await openPdf(page);
  await expect(page.locator('#next')).toBeEnabled();
  await openPdf(page, 'broken.pdf', Buffer.from('not a PDF'));
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('#viewer .page')).toHaveCount(0);
  await expect(page.locator('#next')).toBeDisabled();
});
