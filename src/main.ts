import { createElement, createIcons, ArrowDown, ArrowUp, BookOpen, ChevronLeft, ChevronRight, Columns2, FolderOpen, Minus, Plus, Rows2, Search, Settings2, X } from 'lucide';
import 'pdfjs-dist/web/pdf_viewer.css';
import './style.css';
import './updates';
import './appearance';
import { pickPdf } from './platform';
import { Reader, type ReaderDocument, type ReaderState } from './reader';
import { FindBar } from './find';

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing element: ${id}`);
  return value as T;
}

createIcons({ icons: { ArrowDown, ArrowUp, BookOpen, ChevronLeft, ChevronRight, Columns2, FolderOpen, Minus, Plus, Rows2, Search, Settings2, X } });
const container = element<HTMLDivElement>('viewer-container');
const pageNumber = element<HTMLInputElement>('page-number');
const zoom = element<HTMLSelectElement>('zoom');
const status = element('status');
const openButton = element<HTMLButtonElement>('open');
const emptyButton = element<HTMLButtonElement>('open-empty');
const previous = element<HTMLButtonElement>('previous');
const next = element<HTMLButtonElement>('next');
const zoomIn = element<HTMLButtonElement>('zoom-in');
const zoomOut = element<HTMLButtonElement>('zoom-out');
const empty = element('empty-state');
const loading = element('loading');
const filename = element('filename');
const errorDialog = element<HTMLDialogElement>('error-dialog');
const tabList = element('document-tabs');
interface Tab { id: number; name: string; document: ReaderDocument }
const tabs: Tab[] = [];
let active: Tab | null = null;
let nextId = 1;
let busy = false;
let findBar: FindBar | null = null;
const vertical = element<HTMLButtonElement>('layout-vertical');
const horizontal = element<HTMLButtonElement>('layout-horizontal');

function update(state: ReaderState): void {
  const available = !!active && state.pages > 0 && !busy;
  findBar?.setAvailable(available);
  vertical.disabled = horizontal.disabled = !available;
  vertical.setAttribute('aria-pressed', String(state.layout === 'vertical'));
  horizontal.setAttribute('aria-pressed', String(state.layout === 'horizontal'));
  pageNumber.value = String(state.page);
  pageNumber.max = String(state.pages || 1);
  element('page-count').textContent = `/ ${state.pages}`;
  pageNumber.disabled = zoom.disabled = zoomIn.disabled = zoomOut.disabled = !available;
  previous.disabled = !available || state.page <= 1;
  next.disabled = !available || state.page >= state.pages;
  zoom.querySelector('option[data-custom]')?.remove();
  if (![...zoom.options].some(option => option.value === state.scaleValue)) {
    const option = new Option(`${Math.round(state.scale * 100)}%`, state.scaleValue);
    option.dataset.custom = '';
    zoom.add(option);
  }
  zoom.value = state.scaleValue;
  if (available) status.textContent = `Page ${state.page} of ${state.pages}`;
}

const reader = new Reader(container, update, result => findBar?.update(result));
findBar = new FindBar(reader);
vertical.addEventListener('click', () => reader.setLayout('vertical'));
horizontal.addEventListener('click', () => reader.setLayout('horizontal'));

function renderTabs(): void {
  element('tabs-bar').hidden = tabs.length === 0;
  tabList.replaceChildren();
  for (const tab of tabs) {
    const group = document.createElement('div');
    group.className = `document-tab${tab === active ? ' is-active' : ''}`;
    const button = document.createElement('button');
    button.id = `tab-${tab.id}`;
    button.dataset.tab = String(tab.id);
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(tab === active));
    button.setAttribute('aria-controls', 'viewer-container');
    button.tabIndex = tab === active ? 0 : -1;
    button.textContent = button.title = tab.name;
    button.disabled = busy;
    const close = document.createElement('button');
    close.dataset.close = String(tab.id);
    close.className = 'close-tab';
    close.setAttribute('aria-label', `Close ${tab.name}`);
    close.title = 'Close tab (Ctrl+W)';
    close.append(createElement(X, { 'aria-hidden': 'true' }));
    close.disabled = busy;
    group.append(button, close);
    tabList.append(group);
  }
  if (active) {
    container.setAttribute('aria-labelledby', `tab-${active.id}`);
    tabList.querySelector(`#tab-${active.id}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } else container.removeAttribute('aria-labelledby');
}

function render(): void {
  filename.textContent = filename.title = active?.name || 'FolioPDF';
  filename.classList.toggle('sr-only', !!active);
  document.title = active ? `${active.name} — FolioPDF` : 'FolioPDF';
  container.hidden = !active;
  empty.hidden = !!active;
  if (!active) status.textContent = 'Ready';
  update(reader.state);
  renderTabs();
}

function setBusy(value: boolean): void {
  busy = value;
  openButton.disabled = emptyButton.disabled = value;
  element('document-area').setAttribute('aria-busy', String(value));
  update(reader.state);
  renderTabs();
}

function report(error: unknown): void {
  console.error('Could not open PDF:', error);
  element('error-message').textContent = errorMessage(error);
  if (!errorDialog.open) errorDialog.showModal();
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'PasswordException') return 'This PDF needs a password. Password-protected files are not supported yet.';
    if (error.name === 'InvalidPDFException') return 'This file is damaged or is not a valid PDF. Try another file.';
  }
  return 'The file could not be read. Check that it is available and try again.';
}

async function open(): Promise<void> {
  if (busy) return;
  setBusy(true);
  const previousTab = active;
  let pending: ReaderDocument | null = null;
  try {
    const file = await pickPdf(element<HTMLInputElement>('file-input'));
    if (!file) return;
    status.textContent = 'Opening PDF…';
    loading.hidden = false;
    empty.hidden = true;
    container.hidden = false;
    pending = await reader.load(file.data);
    findBar?.reset();
    await reader.show(pending);
    active = { id: nextId++, name: file.name, document: pending };
    tabs.push(active);
    pending = null;
  } catch (error) {
    if (pending) {
      await reader.close(pending);
      await reader.show(previousTab?.document || null);
    }
    report(error);
  } finally {
    loading.hidden = true;
    setBusy(false);
    render();
  }
}

async function activate(tab: Tab): Promise<void> {
  if (busy) return;
  const previousTab = active;
  setBusy(true);
  try {
    if (tab !== active) { findBar?.reset(); await reader.show(tab.document); }
    active = tab;
  } catch (error) {
    await reader.show(previousTab?.document || null);
    report(error);
  } finally {
    setBusy(false);
    render();
    tabList.querySelector<HTMLButtonElement>(`#tab-${active?.id}`)?.focus();
  }
}

async function closeTab(tab: Tab): Promise<void> {
  if (busy) return;
  setBusy(true);
  try {
    const index = tabs.indexOf(tab);
    if (tab === active) {
      findBar?.reset();
      const neighbor = tabs[index + 1] || tabs[index - 1] || null;
      await reader.show(neighbor?.document || null);
      active = neighbor;
    }
    tabs.splice(index, 1);
    await reader.close(tab.document);
  } catch (error) {
    report(error);
  } finally {
    setBusy(false);
    render();
    if (active) tabList.querySelector<HTMLButtonElement>(`#tab-${active.id}`)?.focus();
    else openButton.focus();
  }
}

tabList.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button) return;
  const tab = tabs.find(tab => tab.id === Number(button.dataset.tab || button.dataset.close));
  if (tab) void (button.dataset.close ? closeTab(tab) : activate(tab));
});
tabList.addEventListener('keydown', event => {
  if (busy || !active || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
    : (tabs.indexOf(active) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  void activate(tabs[index]);
});

openButton.addEventListener('click', open);
emptyButton.addEventListener('click', open);
previous.addEventListener('click', () => reader.goTo(reader.state.page - 1));
next.addEventListener('click', () => reader.goTo(reader.state.page + 1));
pageNumber.addEventListener('change', () => {
  reader.goTo(Number(pageNumber.value));
  pageNumber.value = String(reader.state.page);
});
pageNumber.addEventListener('keydown', event => {
  if (event.key === 'Enter') pageNumber.blur();
});
zoom.addEventListener('change', () => reader.zoom(zoom.value));
zoomIn.addEventListener('click', () => reader.stepZoom(1));
zoomOut.addEventListener('click', () => reader.stepZoom(-1));
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]') || !(event.ctrlKey || event.metaKey) || event.altKey) return;
  if (event.key.toLowerCase() === 'o') { event.preventDefault(); void open(); }
  if (!active || busy) return;
  if (event.key.toLowerCase() === 'w') { event.preventDefault(); void closeTab(active); }
  if (event.key === 'Tab') {
    event.preventDefault();
    void activate(tabs[(tabs.indexOf(active) + (event.shiftKey ? -1 : 1) + tabs.length) % tabs.length]);
  }
  if (event.key === '+' || event.key === '=') { event.preventDefault(); reader.stepZoom(1); }
  if (event.key === '-') { event.preventDefault(); reader.stepZoom(-1); }
  if (event.key === '0') { event.preventDefault(); reader.zoom('1'); }
});
