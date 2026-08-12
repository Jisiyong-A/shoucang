import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeWindowsOcrText,
  parseWindowsOcrOutput,
} from './normalize.mjs';
import { probeLocalOcr } from './index.mjs';

// Windows-only live probe: engine must be truthy and shaped correctly.
// Skipped elsewhere (probe would return the unsupported-platform shape).
test('probeLocalOcr reports an engine with languages on win32', { skip: process.platform !== 'win32' }, async () => {
  const probe = await probeLocalOcr();
  assert.equal(probe.engine, 'windows');
  assert.equal(typeof probe.available, 'boolean');
  assert.ok(Array.isArray(probe.languages));
  assert.ok(probe.languages.length > 0, 'expected at least one recognizer language');
});

test('normalizeWindowsOcrText removes spaces between CJK glyphs', () => {
  // fixture image text kept as-is (test asset, not product naming)
  assert.equal(
    normalizeWindowsOcrText('看 看 收 藏 本 地 测 试'),
    '看看收藏本地测试',
  );
});

test('normalizeWindowsOcrText keeps latin word spacing', () => {
  assert.equal(
    normalizeWindowsOcrText('手 冲 咖 啡 93°C with milk'),
    '手冲咖啡 93°C with milk',
  );
});

test('normalizeWindowsOcrText trims and handles non-strings', () => {
  assert.equal(normalizeWindowsOcrText('  咖啡  '), '咖啡');
  assert.equal(normalizeWindowsOcrText(null), '');
  assert.equal(normalizeWindowsOcrText(undefined), '');
});

test('parseWindowsOcrOutput handles an array payload with CRLF tail', () => {
  const stdout = '[{"path":"a.png","text":"手 冲 咖 啡","lines":1,"error":null}]\r\n';
  const results = parseWindowsOcrOutput(stdout);
  assert.equal(results.length, 1);
  assert.equal(results[0].path, 'a.png');
  assert.equal(results[0].text, '手冲咖啡');
  assert.equal(results[0].error, '');
});

test('parseWindowsOcrOutput tolerates stray leading lines', () => {
  const stdout = 'WARNING: something\r\n[{"path":"b.png","text":"Hello world","error":null}]\r\n';
  const results = parseWindowsOcrOutput(stdout);
  assert.equal(results.length, 1);
  assert.equal(results[0].text, 'Hello world');
});

test('parseWindowsOcrOutput returns [] on garbage', () => {
  assert.deepEqual(parseWindowsOcrOutput(''), []);
  assert.deepEqual(parseWindowsOcrOutput('no json here'), []);
  assert.deepEqual(parseWindowsOcrOutput('{"broken"'), []);
  assert.deepEqual(parseWindowsOcrOutput(null), []);
});

test('parseWindowsOcrOutput maps per-entry errors', () => {
  const stdout = '[{"path":"c.png","text":"","error":"image file not found"}]';
  const results = parseWindowsOcrOutput(stdout);
  assert.equal(results[0].error, 'image file not found');
  assert.equal(results[0].text, '');
});
