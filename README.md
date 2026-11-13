# FolioPDF

a lightweight PDF reader built on Mozilla's PDF.js, Tauri and TypeScript.

open local PDFs, select text, scroll through pages and adjust the zoom.

each document opens in a tab and keeps its page, zoom and reading position.
use Ctrl+Tab / Ctrl+Shift+Tab to switch and Ctrl+W to close.

find text with Ctrl+F. use Enter / Shift+Enter, F3 / Shift+F3 or the match buttons
to move through results. use the search options for case-sensitive or whole-word
matches. Escape closes search. search is limited to the active PDF.
the page direction buttons switch between vertical and horizontal reading;
each tab keeps its own direction. use R / Shift+R to rotate pages, and
Ctrl+Home / Ctrl+End to jump to the first / last page.
to add text, choose the type tool and click a page. save the changes as an
edited copy so the original PDF stays as it is.

## docs

- [user guide](docs/user-guide.md)
- [developer guide](docs/developer-guide.md)

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
- horizontal page scrolling
- rotate pages while reading
- document text search with match counts and highlights
- percentage zoom, actual size, fit width and fit page
- system, light and dark themes with seven color palettes
- Mica on supported Windows 11 systems
- add and edit free text annotations, then save an edited copy
- manual update checks from Settings

## updates

Windows installer and Linux AppImage builds can download signed updates from
GitHub Releases. open Settings, check for a new version, then download it.
installation requires a separate confirmation and closes the current tabs.
portable Windows, Debian and tar archive builds offer the release download page.
there are no background update checks.

version 1.0 needs a manual upgrade to 1.0.1 or newer to gain the updater.

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

the browser tests cover rendering, text selection, navigation, zoom, tabs,
invalid-file recovery and the update dialog. native file dialogs and WebView rendering
need separate desktop checks.

## preparing updates

the packaging workflows need `TAURI_SIGNING_PRIVATE_KEY` and, if the key is
encrypted, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as repository secrets. keep a
secure backup of the signing key outside the repository. the app embeds only
the matching public key. update signatures are separate from Windows code signing.

build Windows and Linux packages from the same version and commit. after collecting
the installer, AppImage and their adjacent `.sig` files, generate the update feed:

```sh
node scripts/update-manifest.mjs output path/to/FolioPDF-setup.exe path/to/FolioPDF.AppImage release-notes.txt
```

the output directory must already exist. upload the packages and signatures to
the matching `v<version>` GitHub release, and upload `output/latest.json` last,
after checking both downloads. its URLs use the exact package filenames.
publish only after an actual upgrade has been checked on Windows and Linux.
never publish manifests from local test builds.

## current limits

password-protected PDFs and external links are not supported yet. editing currently
covers free text annotations; existing form fields, highlighting, drawing and deleting
annotations are not available yet. edited PDFs are saved as a separate copy.
macOS has not been tested.

## credits

PDF rendering uses [Mozilla's PDF.js](https://mozilla.github.io/pdf.js/).
interface icons are from [Lucide](https://lucide.dev/).

## license

Apache-2.0. see [LICENSE](LICENSE).
