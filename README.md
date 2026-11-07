# FolioPDF

a lightweight PDF reader built on Mozilla's PDF.js, Tauri and TypeScript.

open local PDFs, select text, scroll through pages and adjust the zoom.

each document opens in a tab and keeps its page, zoom and reading position.
use Ctrl+Tab / Ctrl+Shift+Tab to switch and Ctrl+W to close.

## download

get the latest build from [GitHub Releases](https://github.com/debarkak/foliopdf/releases).

- Windows x64: use the setup installer or extract the portable zip and run `FolioPDF.exe`.
  WebView2 is required; the setup installer checks for it. build tools are only
  needed when compiling from source.
- Linux x64: use the `.deb` package on compatible Debian-based distributions,
  or the AppImage for a portable app. a traditional `.tar.gz` archive is also
  available; it needs the system WebKitGTK 4.1 and GTK 3 libraries.

Linux release packages are built on Ubuntu 22.04 and tested under Ubuntu 26.04
with WSLg. they are not guaranteed to work on every distribution.

## features

- selectable PDF text
- vertical scrolling and page navigation
- percentage zoom, actual size, fit width and fit page
- system light and dark appearance

## development

requires Node.js 22.16+ (or a supported newer release), npm and Rust. native builds
also need the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/):

- Windows: MSVC x64/x86 build tools, one Windows SDK, and WebView2
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

password-protected PDFs, external links, saving and editing are not supported yet.
macOS has not been tested.

## credits

PDF rendering uses [Mozilla's PDF.js](https://mozilla.github.io/pdf.js/).
interface icons are from [Lucide](https://lucide.dev/).

## license

Apache-2.0. see [LICENSE](LICENSE).
