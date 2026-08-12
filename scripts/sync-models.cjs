#!/usr/bin/env node
/** After every next build, sync bundled ONNX models into dist/
 * (next's incremental export does not reliably re-copy public/ files). */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'public', 'models');
const dst = path.join(root, 'dist', 'models');

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
const bytes = fs.statSync(path.join(dst, 'bge-small-zh-v1.5', 'onnx', 'model_quantized.onnx')).size;
console.log(`[sync-models] models synced to dist/ (quantized onnx ${(bytes / 1024 / 1024).toFixed(1)} MB)`);
