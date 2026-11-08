import { isTauri } from '@tauri-apps/api/core';

export interface OpenedFile {
  name: string;
  data: Uint8Array;
}

export async function pickPdf(input: HTMLInputElement): Promise<OpenedFile | null> {
  if (isTauri()) {
    const [{ open }, { readFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ]);
    const path = await open({
      title: 'Open PDF',
      multiple: false,
      directory: false,
      filters: [{ name: 'PDF documents', extensions: ['pdf'] }],
    });
    if (!path) return null;
    return { name: path.split(/[\\/]/).pop() || 'Document.pdf', data: await readFile(path) };
  }

  // The browser adapter keeps development and reader tests independent of Tauri.
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
    };
    const onChange = async () => {
      cleanup();
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) });
      } catch (error) {
        reject(error);
      }
    };
    const onCancel = () => { cleanup(); resolve(null); };
    input.value = '';
    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    input.click();
  });
}

export async function savePdf(name: string, data: Uint8Array): Promise<boolean> {
  const suggested = name.replace(/\.pdf$/i, '') + ' - edited.pdf';
  if (isTauri()) {
    const [{ save }, { writeFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ]);
    const path = await save({ title: 'Save edited PDF', defaultPath: suggested, filters: [{ name: 'PDF documents', extensions: ['pdf'] }] });
    if (!path) return false;
    await writeFile(path, data);
    return true;
  }
  const url = URL.createObjectURL(new Blob([data.slice().buffer as ArrayBuffer], { type: 'application/pdf' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = suggested;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
