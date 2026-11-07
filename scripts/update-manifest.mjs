import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

// Run after both signed release packages are built, before uploading latest.json.
const [directory, windows, linux, notesFile] = process.argv.slice(2);
if (!directory || !windows || !linux || !notesFile) throw new Error('Usage: node scripts/update-manifest.mjs <output-dir> <windows-setup.exe> <linux.AppImage> <release-notes.txt>');
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const platforms = {};
for (const [target, file] of [['windows-x86_64', windows], ['linux-x86_64', linux]]) {
  const signature = (await readFile(`${file}.sig`, 'utf8')).trim();
  if (!signature) throw new Error(`Empty signature: ${file}.sig`);
  platforms[target] = {
    signature,
    url: `https://github.com/debarkak/foliopdf/releases/download/v${version}/${encodeURIComponent(basename(file))}`,
  };
}
await writeFile(join(directory, 'latest.json'), JSON.stringify({ version, notes: await readFile(notesFile, 'utf8'), pub_date: new Date().toISOString(), platforms }, null, 2) + '\n');
