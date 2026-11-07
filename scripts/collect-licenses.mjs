import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const sections = ['FolioPDF — third-party notices\n\nDependency license texts included with this build.'];
const licenseName = /^(licen[cs]e|copying|notice|authors)([._-]|$)/i;

async function collect(directory, label) {
  if (directory instanceof URL) directory = fileURLToPath(directory);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!licenseName.test(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const file of await readdir(path, { withFileTypes: true })) {
        if (file.isFile()) sections.push(`${label} / ${entry.name}/${file.name}\n\n${await readFile(join(path, file.name), 'utf8')}`);
      }
    } else if (entry.isFile()) {
      sections.push(`${label} / ${entry.name}\n\n${await readFile(path, 'utf8')}`);
    }
  }
}

// Include runtime JavaScript dependencies; development tools are not shipped.
const lock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));
for (const [path, pkg] of Object.entries(lock.packages)) {
  if (!path || pkg.dev || pkg.optional) continue;
  await collect(new URL(path, root), `${path.replace(/^node_modules\//, '')} ${pkg.version}`);
}

// Cargo's lockfile also covers other platforms. Include license texts for the
// locked crates available in this platform's registry cache, including build deps.
const cargoLock = await readFile(new URL('src-tauri/Cargo.lock', root), 'utf8');
const crates = [...cargoLock.matchAll(/\[\[package\]\]\s+name = "([^"]+)"\s+version = "([^"]+)"/g)].map(match => `${match[1]}-${match[2]}`);
const registry = join(process.env.CARGO_HOME || join(homedir(), '.cargo'), 'registry', 'src');
const registries = await readdir(registry, { withFileTypes: true }).catch(() => []);
for (const crate of crates) {
  for (const source of registries) {
    try {
      await collect(join(registry, source.name, crate), crate);
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}
await mkdir(new URL('public/', root), { recursive: true });
await writeFile(new URL('public/THIRD-PARTY-NOTICES.txt', root), sections.join('\n\n' + '='.repeat(72) + '\n\n'));
