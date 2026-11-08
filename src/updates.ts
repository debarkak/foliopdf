import { isTauri, invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { openUrl } from '@tauri-apps/plugin-opener';
import { version } from '../package.json';

const dialog = document.querySelector<HTMLDialogElement>('#updates-dialog')!;
const status = document.querySelector<HTMLElement>('#update-status')!;
const notes = document.querySelector<HTMLElement>('#update-notes')!;
const progress = document.querySelector<HTMLProgressElement>('#update-progress')!;
const warning = document.querySelector<HTMLElement>('#update-warning')!;
const checkButton = document.querySelector<HTMLButtonElement>('#update-check')!;
const action = document.querySelector<HTMLButtonElement>('#update-action')!;
const close = document.querySelector<HTMLButtonElement>('#update-close')!;
const back = document.querySelector<HTMLButtonElement>('#settings-back')!;
const home = document.querySelector<HTMLElement>('#settings-home')!;
const appearancePage = document.querySelector<HTMLElement>('#settings-appearance-page')!;
const gesturePage = document.querySelector<HTMLElement>('#settings-gestures-page')!;
const helpPage = document.querySelector<HTMLElement>('#settings-help-page')!;
const aboutPage = document.querySelector<HTMLElement>('#settings-about-page')!;
let update: Update | null = null;
let canInstall = false;
let downloaded = false;
let busy = false;

function working(value: boolean): void {
  busy = value;
  checkButton.disabled = action.disabled = close.disabled = back.disabled = value;
}

async function release(): Promise<void> {
  const old = update;
  update = null;
  downloaded = false;
  await old?.close();
}

function showPage(page: 'home' | 'appearance' | 'gestures' | 'help' | 'about'): void {
  home.hidden = page !== 'home';
  appearancePage.hidden = page !== 'appearance';
  gesturePage.hidden = page !== 'gestures';
  helpPage.hidden = page !== 'help';
  aboutPage.hidden = page !== 'about';
  back.hidden = page === 'home';
}
document.querySelector<HTMLButtonElement>('#settings-appearance')!.addEventListener('click', () => { showPage('appearance'); back.focus(); });
document.querySelector<HTMLButtonElement>('#settings-about')!.addEventListener('click', () => { showPage('about'); back.focus(); });
document.querySelector<HTMLButtonElement>('#settings-gestures')!.addEventListener('click', () => { showPage('gestures'); back.focus(); });
document.querySelector<HTMLButtonElement>('#settings-help')!.addEventListener('click', () => { showPage('help'); back.focus(); });
function returnToSettings(): void {
  const previous = !appearancePage.hidden ? '#settings-appearance' : !gesturePage.hidden ? '#settings-gestures' : !helpPage.hidden ? '#settings-help' : '#settings-about';
  showPage('home');
  document.querySelector<HTMLButtonElement>(previous)!.focus();
}
back.addEventListener('click', returnToSettings);

document.querySelector('#settings-open')!.addEventListener('click', async () => {
  showPage('home');
  dialog.showModal();
  document.querySelector('#app-version')!.textContent = `Version ${isTauri() ? await getVersion() : version}`;
});
close.addEventListener('click', () => dialog.close());
dialog.addEventListener('cancel', event => {
  if (busy) { event.preventDefault(); return; }
  if (!home.hidden) return;
  event.preventDefault();
  returnToSettings();
});
dialog.addEventListener('close', () => { void release(); action.hidden = warning.hidden = progress.hidden = notes.hidden = true; status.textContent = 'Check for a newer version.'; });

checkButton.addEventListener('click', async () => {
  if (busy) return;
  working(true);
  action.hidden = warning.hidden = progress.hidden = notes.hidden = true;
  status.textContent = 'Checking for updates…';
  try {
    await release();
    if (!isTauri()) { status.textContent = 'Updates are available in the desktop app.'; return; }
    canInstall = await invoke<boolean>('update_install_supported');
    update = await check({ timeout: 15000 });
    if (!update) { status.textContent = 'You’re up to date.'; return; }
    status.textContent = `FolioPDF ${update.version} is available.`;
    notes.textContent = update.body || 'No release notes provided.';
    notes.hidden = false;
    action.textContent = canInstall ? 'Download update' : 'Open downloads';
    action.hidden = false;
    if (!canInstall) status.textContent += ' Download the new package to update this copy.';
  } catch (error) {
    console.error('Update check failed:', error);
    status.textContent = 'Couldn’t check for updates. Check your connection and try again.';
  } finally { working(false); }
});

action.addEventListener('click', async () => {
  if (busy || !update) return;
  if (!canInstall) { await openUrl('https://github.com/debarkak/foliopdf/releases/latest'); return; }
  working(true);
  try {
    if (!downloaded) {
      status.textContent = 'Downloading and verifying update…';
      progress.hidden = false;
      progress.removeAttribute('value');
      progress.max = 1;
      let received = 0;
      await update.download(event => {
        if (event.event === 'Started' && event.data.contentLength) progress.max = event.data.contentLength;
        if (event.event === 'Progress') { received += event.data.chunkLength; if (progress.max > 1) progress.value = received; }
      }, { timeout: 120000 });
      downloaded = true;
      progress.hidden = true;
      status.textContent = 'Update verified and ready to install.';
      warning.hidden = false;
      action.textContent = 'Install and restart';
    } else {
      status.textContent = 'Installing update…';
      await update.install();
      await relaunch();
    }
  } catch (error) {
    console.error('Update failed:', error);
    status.textContent = 'The update couldn’t be completed. Try again, or download the latest release manually.';
    progress.hidden = true;
  } finally { working(false); }
});
