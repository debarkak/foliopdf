import { expect, test, type Page } from '@playwright/test';

async function desktop(page: Page, options: { current?: boolean; portable?: boolean; checkFails?: boolean; downloadFails?: boolean } = {}) {
  await page.addInitScript(options => {
    const host = window as unknown as Record<string, unknown>;
    host.isTauri = true;
    host.calls = [];
    host.__TAURI_INTERNALS__ = {
      transformCallback: () => 1,
      invoke: async (command: string) => {
        (host.calls as string[]).push(command);
        if (command === 'plugin:app|version') return '1.0.1';
        if (command === 'update_install_supported') return !options.portable;
        if (command === 'plugin:updater|check') {
          if (options.checkFails) throw new Error('offline');
          return options.current ? null : { rid: 1, currentVersion: '1.0.1', version: '1.0.2', body: '<b>Release notes</b>', rawJson: {} };
        }
        if (command === 'plugin:updater|download') {
          if (options.downloadFails) throw new Error('invalid signature');
          return 2;
        }
      },
    };
  }, options);
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'About & updates Version and updates' }).click();
  await page.getByRole('button', { name: 'Check for updates' }).click();
}

test('downloads first and requires a separate install confirmation', async ({ page }) => {
  await desktop(page);
  await expect(page.locator('#app-version')).toHaveText('Version 1.0.1');
  await expect(page.locator('#update-notes')).toHaveText('<b>Release notes</b>');
  await expect(page.locator('#update-notes b')).toHaveCount(0);
  await page.getByRole('button', { name: 'Download update', exact: true }).click();
  await expect(page.locator('#update-warning')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { calls: string[] }).calls)).not.toContain('plugin:updater|install');
  await page.getByRole('button', { name: 'Install and restart' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { calls: string[] }).calls)).toContain('plugin:process|restart');
});

test('reports no update without offering installation', async ({ page }) => {
  await desktop(page, { current: true });
  await expect(page.locator('#update-status')).toHaveText('You’re up to date.');
  await expect(page.locator('#update-action')).toBeHidden();
});

test('keeps failed checks retryable and lets the user close the dialog', async ({ page }) => {
  await desktop(page, { checkFails: true });
  await expect(page.locator('#update-status')).toContainText('Couldn’t check');
  await expect(page.locator('#update-check')).toBeEnabled();
  await page.locator('#update-close').click();
  await expect(page.locator('#updates-dialog')).not.toBeVisible();
});

test('never offers installation after a rejected download', async ({ page }) => {
  await desktop(page, { downloadFails: true });
  await page.getByRole('button', { name: 'Download update', exact: true }).click();
  await expect(page.locator('#update-status')).toContainText('couldn’t be completed');
  await expect(page.getByRole('button', { name: 'Install and restart' })).toHaveCount(0);
  await expect(page.locator('#update-close')).toBeEnabled();
});

test('portable copies offer downloads instead of an installer', async ({ page }) => {
  await desktop(page, { portable: true });
  await page.getByRole('button', { name: 'Open downloads' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { calls: string[] }).calls)).toContain('plugin:opener|open_url');
  expect(await page.evaluate(() => (window as unknown as { calls: string[] }).calls)).not.toContain('plugin:updater|download');
});

test('closing releases the pending update and clears the next dialog', async ({ page }) => {
  await desktop(page);
  await expect(page.locator('#update-action')).toBeVisible();
  await page.locator('#update-close').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { calls: string[] }).calls)).toContain('plugin:resources|close');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'About & updates Version and updates' }).click();
  await expect(page.locator('#update-action')).toBeHidden();
  await expect(page.locator('#update-status')).toHaveText('Check for a newer version.');
});
