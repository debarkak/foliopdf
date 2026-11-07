import { cp, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const source = dirname(require.resolve('pdfjs-dist/package.json'));
const destination = new URL('../public/pdfjs/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) {
  await cp(join(source, folder), new URL(folder, destination), { recursive: true });
}
await cp(join(source, 'web/images'), new URL('images', destination), { recursive: true });
