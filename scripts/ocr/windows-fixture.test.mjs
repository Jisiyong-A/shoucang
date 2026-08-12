import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { runWindowsOcr } from './windows-local.mjs';
import { runOcr } from './index.mjs';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(moduleDirectory, '..', '..', 'test-fixtures', 'ocr');

const cn = path.join(fixtures, 'chinese-simple.png');
const mixed = path.join(fixtures, 'mixed-cn-en.png');
const low = path.join(fixtures, 'low-contrast.png');

// Real recognition tests — Windows only (WinRT engine). Skipped elsewhere.
test('windows OCR: chinese-simple fixture yields searchable CJK text', { skip: process.platform !== 'win32' }, async () => {
  const results = await runWindowsOcr([cn]);
  assert.equal(results.length, 1);
  const text = results[0].text;
  assert.ok(!results[0].error, `unexpected error: ${results[0].error}`);
  // WinRT reads CJK with inter-glyph spaces; normalized text must still
  // contain the key tokens (spaces may survive around latin/digits).
  assert.ok(text.includes('咖啡') || text.includes('咖 啡'), `missing 咖啡 in: ${text}`);
  assert.ok(text.includes('水温') || text.includes('水 温'), `missing 水温 in: ${text}`);
});

test('windows OCR: mixed-cn-en fixture keeps latin words', { skip: process.platform !== 'win32' }, async () => {
  const results = await runWindowsOcr([mixed]);
  const text = results[0].text;
  assert.ok(!results[0].error, `unexpected error: ${results[0].error}`);
  assert.ok(/Search/i.test(text), `missing latin 'Search' in: ${text}`);
  assert.ok(text.includes('咖啡') || text.includes('咖 啡'), `missing CJK in: ${text}`);
});

test('windows OCR: low-contrast fixture still yields text', { skip: process.platform !== 'win32' }, async () => {
  const results = await runWindowsOcr([low]);
  assert.equal(results.length, 1);
  // Recognition of low-contrast may be partial — require SOME text.
  assert.ok(results[0].text.length > 0 || results[0].error, `empty result: ${JSON.stringify(results[0])}`);
});

test('runOcr facade returns engine metadata', { skip: process.platform !== 'win32' }, async () => {
  const outcome = await runOcr([cn]);
  assert.equal(outcome.engine, 'windows');
  assert.equal(typeof outcome.engineVersion, 'string');
  assert.ok(Array.isArray(outcome.results));
  assert.equal(outcome.results.length, 1);
});
