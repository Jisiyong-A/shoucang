import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// seed sample notes into a temp data dir
const DATA_DIR = path.join(process.env.TEMP || '.', 'shoucang-mcp-test');
fs.mkdirSync(path.join(DATA_DIR, 'media'), { recursive: true });
fs.writeFileSync(path.join(DATA_DIR, 'notes.json'), JSON.stringify([
  {
    id: '64cb12340000000001020301',
    title: '手冲咖啡入门水温表',
    rawContent: '浅烘 93-96°C，中烘 90-93°C，深烘 86-90°C。',
    ocrText: '水温 粉水比 1:15',
    category: '咖啡科学',
    tags: ['手冲'],
    author: { name: '咖啡师阿北' },
    savedAt: '2026-08-05T14:30:00.000Z',
  },
  {
    id: '64cb12340000000001020302',
    title: '极简书桌布置的 7 个原则',
    rawContent: '一物一用、留白、线缆收纳。',
    ocrText: '桌面收纳 灯光分层',
    category: '空间美学',
    tags: ['收纳'],
    author: { name: '家居研究员' },
    savedAt: '2026-08-01T10:00:00.000Z',
  },
], null, 2));

const server = spawn('node', [path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'shoucang-mcp.mjs')], {
  env: { ...process.env, LOCAL_APP_DATA_DIR: DATA_DIR },
  stdio: ['pipe', 'pipe', 'inherit'],
});

let nextId = 1;
const pending = new Map();
let output = '';

server.stdout.setEncoding('utf8');
server.stdout.on('data', (chunk) => {
  output += chunk;
  const lines = output.split(/\r?\n/);
  output = lines.pop() || '';
  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

function request(method, params) {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

const timeout = (ms, label) => new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' timeout')), ms));

(async () => {
  const init = await Promise.race([request('initialize', { protocolVersion: '2025-06-18' }), timeout(8000, 'initialize')]);
  console.log('initialize:', init.result?.serverInfo?.name, init.result?.protocolVersion, '| caps:', JSON.stringify(init.result?.capabilities));

  const tools = await Promise.race([request('tools/list', {}), timeout(8000, 'tools/list')]);
  console.log('tools:', tools.result?.tools?.map((t) => t.name).join(', '));

  const s1 = await Promise.race([request('tools/call', { name: 'search_saved_notes', arguments: { query: '水温' } }), timeout(8000, 'search1')]);
  const s1n = s1.result?.structuredContent || {};
  console.log('search 水温 -> count:', s1n.count, '| titles:', (s1n.notes || []).map((n) => n.title).join(' | '));

  const s2 = await Promise.race([request('tools/call', { name: 'search_saved_notes', arguments: { query: '收纳' } }), timeout(8000, 'search2')]);
  const s2n = s2.result?.structuredContent || {};
  console.log('search 收纳 -> count:', s2n.count, '| titles:', (s2n.notes || []).map((n) => n.title).join(' | '));

  const s3 = await Promise.race([request('tools/call', { name: 'search_saved_notes', arguments: { query: '灯光分层' } }), timeout(8000, 'search3')]);
  const s3n = s3.result?.structuredContent || {};
  console.log('search 灯光分层(OCR) -> count:', s3n.count, '| titles:', (s3n.notes || []).map((n) => n.title).join(' | '));

  const read = await Promise.race([request('tools/call', { name: 'read_saved_note', arguments: { note_id: '64cb12340000000001020301' } }), timeout(8000, 'read')]);
  const rn = read.result?.structuredContent?.note || {};
  console.log('read note ->', rn.title, '| ocrText:', rn.ocrText);

  const bad = await Promise.race([request('tools/call', { name: 'read_saved_note', arguments: { note_id: 'nope' } }), timeout(8000, 'bad')]);
  console.log('read missing -> isError:', bad.result?.isError === true, '| text:', bad.result?.content?.[0]?.text);

  server.kill();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  console.log('MCP_E2E_OK');
})().catch((e) => {
  console.error('FAIL:', e.message);
  server.kill();
  process.exit(1);
});
