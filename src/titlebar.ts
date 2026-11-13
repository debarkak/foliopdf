import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

if (isTauri() && /Windows/.test(navigator.userAgent)) {
  document.documentElement.dataset.customTitlebar = '';
  const window = getCurrentWindow();
  document.querySelector<HTMLElement>('#tabs-bar')!.hidden = false;
  document.querySelector<HTMLElement>('.window-controls')!.hidden = false;
  const actions = {
    'window-minimize': () => window.minimize(),
    'window-maximize': () => window.toggleMaximize(),
    'window-close': () => window.close(),
  };
  for (const [id, action] of Object.entries(actions)) {
    document.getElementById(id)!.addEventListener('click', () => {
      void action().catch(console.error);
    });
  }
}
