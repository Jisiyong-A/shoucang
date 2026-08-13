#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/** After every next build, sync bundled ONNX models into dist/
 * (next's incremental export does not reliably re-copy public/ files). */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'public', 'models');
const dst = path.join(root, 'dist', 'models');

// Bundle the ONNX runtime WASM binaries from node_modules so the app never
// fetches them from the jsdelivr CDN (blocked by production CSP and against
// the local-first ADR). Idempotent; safe to run before every build.
function ensureOrtWasm() {
  const pkgDir = path.join(root, 'node_modules', 'onnxruntime-web', 'dist');
  const outDir = path.join(src, 'wasm');
  const files = [
    'ort-wasm-simd-threaded.asyncify.mjs',
    'ort-wasm-simd-threaded.asyncify.wasm',
  ];
  if (!fs.existsSync(pkgDir)) {
    console.log('[sync-models] onnxruntime-web not installed, skipping ORT wasm');
    return;
  }
  fs.mkdirSync(outDir, { recursive: true });
  let copied = 0;
  for (const file of files) {
    const from = path.join(pkgDir, file);
    if (!fs.existsSync(from)) continue;
    fs.copyFileSync(from, path.join(outDir, file));
    copied += 1;
  }
  console.log(`[sync-models] ORT wasm ensured (${copied}/${files.length} files)`);
}

ensureOrtWasm();

if (!fs.existsSync(src)) {
  console.log('[sync-models] no public/models, skipping');
  process.exit(0);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const srcPath = path.join(from, entry.name);
    const dstPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

copyDir(src, dst);
let totalBytes = 0;
for (const modelDir of fs.readdirSync(src)) {
  const onnxDir = path.join(dst, modelDir, 'onnx');
  if (fs.existsSync(onnxDir)) {
    for (const file of fs.readdirSync(onnxDir)) {
      totalBytes += fs.statSync(path.join(onnxDir, file)).size;
    }
  }
}
console.log(`[sync-models] models synced to dist/ (${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);
