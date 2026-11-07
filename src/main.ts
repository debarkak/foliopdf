import { createIcons, BookOpen, ChevronLeft, ChevronRight, FolderOpen, Minus, Plus } from 'lucide';
import 'pdfjs-dist/web/pdf_viewer.css';
import './style.css';
import { pickPdf } from './platform';
import { Reader, type ReaderState } from './reader';

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing element: ${id}`);
  return value as T;
}

createIcons({ icons: { BookOpen, ChevronLeft, ChevronRight, FolderOpen, Minus, Plus } });
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
let busy = false;
let loaded = false;

function update(state: ReaderState): void {
  const available = state.pages > 0 && !busy;
  pageNumber.value = String(state.page);
  pageNumber.max = String(state.pages);
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

const reader = new Reader(container, update);

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'PasswordException') return 'This PDF needs a password. Password-protected files are not supported yet.';
    if (error.name === 'InvalidPDFException') return 'This file is damaged or is not a valid PDF. Try another file.';
  }
  return 'The file could not be read. Check that it is available and try again.';
}

async function open(): Promise<void> {
  if (busy) return;
  busy = true;
  openButton.disabled = emptyButton.disabled = true;
  try {
    const file = await pickPdf(element<HTMLInputElement>('file-input'));
    if (!file) return;
    loaded = false;
    filename.textContent = 'FolioPDF';
    document.title = 'FolioPDF';
    status.textContent = 'Opening PDF…';
    element('document-area').setAttribute('aria-busy', 'true');
    loading.hidden = false;
    empty.hidden = true;
    container.hidden = false;
    update({ page: 1, pages: 0, scale: 1, scaleValue: 'page-width' });
    await reader.open(file.data);
    loaded = true;
    filename.textContent = file.name;
    filename.title = file.name;
    document.title = `${file.name} — FolioPDF`;
  } catch (error) {
    console.error('Could not open PDF:', error);
    element('error-message').textContent = errorMessage(error);
    if (!errorDialog.open) errorDialog.showModal();
    status.textContent = loaded ? 'Could not open file' : 'No document open';
  } finally {
    busy = false;
    openButton.disabled = emptyButton.disabled = false;
    loading.hidden = true;
    container.hidden = !loaded;
    empty.hidden = loaded;
    element('document-area').setAttribute('aria-busy', 'false');
    update(reader.state);
  }
}

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
  if (errorDialog.open || !(event.ctrlKey || event.metaKey) || event.altKey) return;
  if (event.key.toLowerCase() === 'o') { event.preventDefault(); void open(); }
  if (!loaded || busy) return;
  if (event.key === '+' || event.key === '=') { event.preventDefault(); reader.stepZoom(1); }
  if (event.key === '-') { event.preventDefault(); reader.stepZoom(-1); }
  if (event.key === '0') { event.preventDefault(); reader.zoom('1'); }
});
