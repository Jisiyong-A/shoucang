import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manifestUrl = new URL('../../browser-extension/manifest.json', import.meta.url);
const backgroundUrl = new URL('../../browser-extension/background.js', import.meta.url);
const contentUrl = new URL('../../browser-extension/content.js', import.meta.url);
const mcpServerUrl = new URL('../kankan-mcp.mjs', import.meta.url);

test('browser extension cannot open hidden tabs or read account credentials', async () => {
  const [manifestRaw, background, content] = await Promise.all([
    readFile(manifestUrl, 'utf8'),
    readFile(backgroundUrl, 'utf8'),
    readFile(contentUrl, 'utf8'),
  ]);
  const manifest = JSON.parse(manifestRaw);
  const permissions = manifest.permissions || [];

  assert.equal(permissions.includes('tabs'), false);
  assert.equal(permissions.includes('cookies'), false);
  assert.doesNotMatch(background, /chrome\.tabs\./);
  assert.doesNotMatch(`${background}\n${content}`, /chrome\.cookies|document\.cookie/);
  assert.doesNotMatch(`${background}\n${content}`, /CAPTURE_NOTE_URL|NOTE_PAGE_DATA/);
});

test('local Agent tools read saved files without network or account access', async () => {
  const source = await readFile(mcpServerUrl, 'utf8');

  assert.doesNotMatch(source, /node:https|node:http|fetch\s*\(|chrome\.|document\.cookie|Cookie/);
  assert.match(source, /readFile/);
  assert.match(source, /search_saved_notes/);
  assert.match(source, /read_saved_note/);
});
