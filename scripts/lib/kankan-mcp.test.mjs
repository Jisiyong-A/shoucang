import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const mcpServerPath = fileURLToPath(new URL('../kankan-mcp.mjs', import.meta.url));

test('MCP server searches and reads saved local notes over stdio', async (t) => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'kankan-mcp-'));
  const noteId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  await writeFile(path.join(dataDirectory, 'notes.json'), JSON.stringify([{
    id: noteId,
    title: '博物馆网页设计',
    rawContent: '正文介绍胡同历史',
    ocrText: '图片中的展期是 2023 年',
    imageOcr: [{ text: '旧时遗韵' }],
    coverUrl: 'http://127.0.0.1:4318/media/cover.jpg',
    author: { name: 'Leo' },
    category: '设计美学',
    tags: ['网页设计'],
    savedAt: '2026-08-10T00:00:00.000Z',
  }]), 'utf8');

  const child = spawn(process.execPath, [mcpServerPath], {
    env: { ...process.env, LOCAL_APP_DATA_DIR: dataDirectory },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  t.after(async () => {
    child.kill();
    await rm(dataDirectory, { recursive: true, force: true });
  });

  let buffer = '';
  const pending = new Map();
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
  });

  const request = (id, method, params = {}) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`MCP timeout: ${method}`)), 3000);
    pending.set(id, (message) => {
      clearTimeout(timeout);
      resolve(message);
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });

  const initialized = await request(1, 'initialize', { protocolVersion: '2025-06-18' });
  assert.equal(initialized.result.serverInfo.name, 'kankan-notes');

  const listed = await request(2, 'tools/list');
  assert.deepEqual(listed.result.tools.map((tool) => tool.name), ['search_saved_notes', 'read_saved_note']);

  const searched = await request(3, 'tools/call', {
    name: 'search_saved_notes',
    arguments: { query: '旧时遗韵' },
  });
  assert.equal(searched.result.structuredContent.notes[0].id, noteId);

  const read = await request(4, 'tools/call', {
    name: 'read_saved_note',
    arguments: { note_id: noteId },
  });
  assert.equal(read.result.structuredContent.note.content, '正文介绍胡同历史');
  assert.equal(read.result.structuredContent.note.imageOcr[0].text, '旧时遗韵');
});

