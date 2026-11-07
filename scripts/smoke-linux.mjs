import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { makePdf } from '../tests/pdf-fixture.mjs';

const application = resolve(process.argv[2] || 'src-tauri/target/release/foliopdf');
const output = resolve(process.argv[3] || join(tmpdir(), 'foliopdf-smoke'));
await mkdir(output, { recursive: true });
const sample = join(output, 'sample.pdf');
await writeFile(sample, makePdf());
const driver = spawn(join(homedir(), '.cargo/bin/tauri-driver'), ['--port', '4444'], {
  stdio: 'inherit', env: { ...process.env, GDK_BACKEND: 'x11' },
});
let session;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(method, route, body) {
  const response = await fetch(`http://127.0.0.1:4444${route}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (result.value?.error) throw new Error(JSON.stringify(result.value));
  return result.value;
}
const js = script => request('POST', `/session/${session}/execute/sync`, { script, args: [] });
async function until(check, label) {
  for (let i = 0; i < 150; i++) { if (await check()) return; await pause(200); }
  throw new Error(`Timed out: ${label}`);
}
try {
  await until(async () => { try { await request('GET', '/status'); return true; } catch { return false; } }, 'driver');
  const started = await request('POST', '/session', {
    capabilities: { alwaysMatch: { browserName: 'wry', 'tauri:options': { application } } },
  });
  session = started.sessionId;
  await until(() => js("return !!document.querySelector('#open svg')"), 'reader initialization');
  assert.equal(await js("return document.querySelector('.statusbar').innerText.includes('PDF.js')"), false);
  await js("document.querySelector('#open').click()");
  let dialog;
  await until(async () => {
    try {
      dialog = execFileSync('xdotool', ['search', '--name', '^Open PDF$'], { encoding: 'utf8' }).trim().split('\n').at(-1);
      return !!dialog;
    } catch { return false; }
  }, 'native file dialog');
  execFileSync('xdotool', ['windowfocus', '--sync', dialog]);
  execFileSync('xdotool', ['key', '--window', dialog, 'ctrl+l']);
  await pause(300);
  execFileSync('xdotool', ['type', '--window', dialog, '--clearmodifiers', sample]);
  execFileSync('xdotool', ['key', '--window', dialog, 'Return']);
  await pause(500);
  try { execFileSync('xdotool', ['key', '--window', dialog, 'Return']); } catch {}
  await until(() => js("return document.querySelector('#filename').textContent === 'sample.pdf'"), 'native file read');
  await until(() => js("return !!document.querySelector('.textLayer span')"), 'PDF text');
  await until(() => js("const c=document.querySelector('.page canvas');if(!c)return false;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<d.length;i+=4)if(d[i]<100&&d[i+3]>0)return true;return false"), 'PDF canvas ink');
  await js("document.querySelector('#next').click()");
  await until(() => js("return document.querySelector('#page-number').value === '2'"), 'page navigation');
  await js("const s=document.querySelector('#zoom');s.value='1.5';s.dispatchEvent(new Event('change'))");
  await until(() => js("return document.querySelector('.page').getBoundingClientRect().width > 1100"), 'percentage zoom');
  await js("const s=document.querySelector('#zoom');s.value='page-fit';s.dispatchEvent(new Event('change'))");
  await pause(500);
  await writeFile(join(output, 'reader.png'), Buffer.from(await request('GET', `/session/${session}/screenshot`), 'base64'));
  console.log('Native Linux smoke check passed: open, render, text, navigation and zoom.');
} finally {
  if (session) await request('DELETE', `/session/${session}`).catch(() => {});
  driver.kill();
}
