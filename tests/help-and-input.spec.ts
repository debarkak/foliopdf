import { expect, test } from '@playwright/test';
import { makePdf } from './pdf-fixture.mjs';

test('Help opens the user guide and plus opens another PDF tab', async ({ page }) => {
  await page.route('https://github.com/**', route => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Help Open the user guide' }).click();
  await expect(page.getByRole('tab', { name: 'FolioPDF user guide.pdf', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.textLayer')).toContainText('FolioPDF user guide');

  for (const [name, button] of [
    ['first.pdf', page.getByRole('button', { name: 'Open', exact: true })],
    ['second.pdf', page.locator('#open-empty')],
  ] as const) {
    if (name === 'second.pdf') {
      await page.getByRole('button', { name: 'New tab', exact: true }).click();
      await expect(page.getByRole('tab', { name: 'Home', exact: true })).toHaveAttribute('aria-selected', 'true');
    }
    const chooser = page.waitForEvent('filechooser');
    await button.click();
    await (await chooser).setFiles({ name, mimeType: 'application/pdf', buffer: makePdf(name) });
    await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
  }
  await expect(page.getByRole('tab')).toHaveCount(3);
});

test('pinch and Ctrl-wheel respect separate settings', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('foliopdf.gestures', '{"pinch":true,"wheel":false}'));
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await (await chooser).setFiles({ name: 'zoom.pdf', mimeType: 'application/pdf', buffer: makePdf('Zoom') });
  const zoom = page.locator('#zoom');
  const viewer = page.locator('#viewer-container');
  await zoom.selectOption('1');
  await page.keyboard.down('Control');
  await viewer.dispatchEvent('wheel', { ctrlKey: true, deltaY: -100, cancelable: true });
  await page.keyboard.up('Control');
  await expect(zoom).toHaveValue('1');
  await viewer.dispatchEvent('wheel', { ctrlKey: true, deltaY: -100, cancelable: true });
  await expect(zoom).not.toHaveValue('1');
});
