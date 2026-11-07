# foliopdf

a lightweight PDF reader built on Mozilla's PDF.js, Tauri and TypeScript.

the first reader stage supports opening a local PDF, selecting text, vertical
scrolling, page navigation and zoom. tabs and editing are planned for later.

## development

requires Node.js 22.16+ (or a supported newer release), npm and Rust. native builds
also need the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/):

- Windows: Microsoft C++ Build Tools with the desktop C++ workload, and WebView2
- Ubuntu / WSL2: WebKitGTK development libraries and a working WSLg session

```sh
npm ci
npm run tauri dev
```

run Windows builds with the Windows toolchain and Linux builds inside WSL.
use separate checkouts or build directories so their dependencies stay separate.

for browser development:

```sh
npm run dev
```

## checks

```sh
npm run build
npx playwright install chromium
npm test
```

the browser tests cover rendering, text selection, navigation, zoom, document
replacement and invalid-file recovery. native file dialogs and WebView rendering
need separate desktop checks.

## current limits

one document at a time. password-protected PDFs, external links, saving and editing
are not supported yet. macOS has not been tested.

## credits

PDF rendering uses [Mozilla's PDF.js](https://mozilla.github.io/pdf.js/).
interface icons are from [Lucide](https://lucide.dev/).

## license

Apache-2.0. see [LICENSE](LICENSE).
