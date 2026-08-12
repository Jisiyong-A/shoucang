# Architecture Baseline — 收藏

> Branch: `windows-redesign` · Baseline: upstream `main` @ 2026-08-12 · License: AGPL-3.0-or-later

## Frontend (Next.js 16 · React 19 · Tailwind 4 · framer-motion)

| Module | Role |
|---|---|
| `app/page.tsx` | Entry; polls `GET /notes` every 2 s, dispatches into store |
| `app/lib/store.tsx` | AppContext + useReducer (notes / loading / error) |
| `app/lib/xhs-client.ts` | Typed client for `127.0.0.1:4318` (health/setup/notes/import/delete) |
| `app/lib/drag-import.mjs` | Drag payload extraction (custom MIME + plain + uri-list) |
| `app/lib/note-search.mjs` (shared w/ Node) | NFKC/lowercase normalize; token AND search across title/body/OCR/tags/author/category |
| `app/lib/category-inference.mjs` | Rule-based scoring → category |
| `app/lib/desk-workspace.mjs` | Group state: create/rename/move/ensure |
| `app/components/*` | Dot-geometry UI (DashboardHeader, CategoryRail, NoteCard, NoteDetail, ImportOverlay, SetupDialog, EmptyState, ui) |
| `app/globals.css` | OLED-black tokens, dot-field, pixel blocks, no remote fonts |

## Desktop (Tauri 2 · Rust)

| Module | Role |
|---|---|
| `src-tauri/src/main.rs` | Window shell; spawns sidecar with bundled/dev node; kill child on exit |
| `src-tauri/tauri.conf.json` | Window config (resizable/min 1080×760/maximized), CSP, NSIS bundle, resources |
| `src-tauri/resources/node/` | Bundled portable Node v24.14.1 (release runtime, no PATH dependency) |
| `src-tauri/icons/` | icon.ico + PNG set (tauri icon from 1024 source) |

Sidecar lifecycle: setup → resolve `local-api.mjs` (cwd candidates → BaseDirectory::Resource) → resolve node (env override → bundled node.exe on Windows → system node fallback) → spawn with `LOCAL_API_PORT=4318` + `LOCAL_APP_DATA_DIR` → logs to data dir → ExitRequested/Exit kills child.

## Local service (Node sidecar · 127.0.0.1:4318)

| Item | Detail |
|---|---|
| `scripts/local-api.mjs` | Zero-dep stdlib HTTP server; CORS allowlist (localhost/127.0.0.1/tauri/chrome-extension); origin gate |
| `scripts/lib/anonymous-note-resolver.mjs` | Single public note page, `credentials: 'omit'`, no fallback to logged-in browser |
| `scripts/lib/note-import.mjs` | Payload validation, normalization, dedupe merge |
| `scripts/lib/media-import.mjs` | Image download (xhscdn/xhsimg whitelist, 15 MB cap, redirect limit) + OCR runner hook |
| `scripts/lib/ocr-adapter.mjs` | Platform dispatch: darwin→Vision/JXA, win32→Windows.Media.Ocr (PowerShell bridge), else [] |
| `scripts/lib/category-inference.mjs` | shared |
| `scripts/lib/note-search.mjs` | shared |
| `scripts/lib/cache-cover-recovery.mjs` | macOS WebKit cache recovery only (darwin guard) |
| Data | `%LOCALAPPDATA%\com.patrick.shoucang\` → `notes.json`, `media/`, `local-api.*.log`; legacy `~/.shoucang` merged as migration source only |
| MCP | `scripts/shoucang-mcp.mjs` (JSONL stdio; search_saved_notes / read_saved_note; read-only) |

## Browser extension (Manifest V3)

| File | Role |
|---|---|
| `manifest.json` | MV3; host_permissions only `http://127.0.0.1:4318/*`; NO tabs/cookies permissions |
| `content.js` | Drag payloads (SHOUCANG_NOTE:/SHOUCANG_CARD:) + capture-current-note + floating button |
| `page-data.js` | MAIN-world page-data bridge (window.postMessage) |
| `background.js` | IMPORT_NOTE → POST /notes/import; error surfaced to button state |

## Security invariants (frozen, unchanged by Windows port)
Single user-selected item only · no XHS cookies/tokens · anonymous requests · image domain whitelist · localhost-only service · local data · MCP read-only · failure never falls back to browser identity. Forbidden: cookie import, favorites sync, auto-scroll scraping, batch API, UA rotation, proxy pools, anti-verification, captcha bypass.
