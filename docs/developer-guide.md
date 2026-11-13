# Developer guide

FolioPDF uses TypeScript, Vite, PDF.js and Tauri. The frontend owns tabs, document rendering and settings. Tauri handles the desktop window, native dialogs and updater.

## Run locally

Use Node.js 22 and Rust stable. Windows needs MSVC, a Windows SDK and WebView2. Linux needs WebKitGTK 4.1 and the Tauri system dependencies. Under WSL, use WSLg for native window checks and a checkout inside the Linux filesystem.

```sh
npm ci
npm run tauri dev
```

Use `npm run dev` for the browser preview. For a production frontend build and browser checks, run:

```sh
npm run build
npx playwright install chromium
npm test
```

Browser tests use the browser file picker. Check desktop integrations in a separate native build.

## Packaging

Keep the npm, Cargo and Tauri versions aligned. The Windows and Linux packaging workflows build from the same source revision. Follow the [update publishing steps](../README.md#preparing-updates) to publish signed packages and the updater manifest.
