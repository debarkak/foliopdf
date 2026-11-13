import { invoke, isTauri } from '@tauri-apps/api/core';

interface RecentPdf { name: string; path: string; opened: number }
const enabled = document.querySelector<HTMLInputElement>('#history-enabled')!;
const days = document.querySelector<HTMLSelectElement>('#history-days')!;
const panel = document.querySelector<HTMLElement>('#recent-panel')!;
const list = document.querySelector<HTMLUListElement>('#recent-list')!;
const empty = document.querySelector<HTMLElement>('#recent-empty')!;
let open: (entry: RecentPdf) => Promise<void>;
let operation = Promise.resolve();

function refresh(path?: string): Promise<void> {
  const keepDays = enabled.checked ? Number(days.value) : 0;
  operation = operation.then(async () => {
    if (!isTauri()) return;
    const entries = await invoke<RecentPdf[]>('recent_pdfs', { keepDays, path: path ?? null });
    panel.hidden = !enabled.checked;
    empty.hidden = entries.length > 0;
    list.replaceChildren(...entries.map(entry => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.textContent = entry.name;
      button.title = entry.path;
      button.addEventListener('click', () => { void open(entry); });
      item.append(button);
      return item;
    }));
  }).catch(console.error);
  return operation;
}

export function initHistory(onOpen: typeof open): void {
  open = onOpen;
  try {
    const saved = JSON.parse(localStorage.getItem('foliopdf.history') || '{}');
    enabled.checked = saved.enabled !== false;
    if (['7', '30', '90', '365'].includes(saved.days)) days.value = saved.days;
  } catch { /* Use the default retention. */ }
  const change = () => {
    days.disabled = !enabled.checked;
    panel.hidden = !enabled.checked || !isTauri();
    try { localStorage.setItem('foliopdf.history', JSON.stringify({ enabled: enabled.checked, days: days.value })); }
    catch { /* Use preferences for this session. */ }
    void refresh();
  };
  enabled.addEventListener('change', change);
  days.addEventListener('change', change);
  change();
}

export function rememberPdf(path: string): Promise<void> {
  return refresh(path);
}
