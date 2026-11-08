import { expect, test } from '@playwright/test';

test('appearance changes apply and persist after reopening', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('system');
  await page.getByLabel('Theme', { exact: true }).selectOption('dark');
  await page.getByLabel('Ocean').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'ocean');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'ocean');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByLabel('Ocean')).toBeChecked();
});

test('invalid preferences fall back to defaults', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('foliopdf.appearance', '{bad json'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'sage');
});
