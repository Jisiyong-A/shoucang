/* Task 06 §8 acceptance A–E via the real MCP server + real data dir. */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = 'C:/Users/12155/AppData/Local/com.patrick.shoucang';
const NOTES = path.join(DATA_DIR, 'notes.json');
const SERVER = path.join(__dirname, '..', '..', 'scripts', 'shoucang-mcp.mjs');

const notes = [
  { id: '64cb1234000000000102a101', title: '鎏金独木舟建造手册', rawContent: '普通正文', ocrText: '', category: '手工', savedAt: '2026-08-01T00:00:00.000Z' },
  { id: '64cb1234000000000102a102', title: '普通标题', rawContent: '水磨石地面养护指南', ocrText: '', category: '家居', savedAt: '2026-08-02T00:00:00.000Z' },
  { id: '64cb1234000000000102a103', title: '普通标题二', rawContent: '普通正文二', ocrText: '苔藓微景观湿度控制', category: '植物', savedAt: '2026-08-03T00:00:00.000Z' },
];
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(NOTES, JSON.stringify(notes));

function call(method, params, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER], {
      env: { ...process.env, LOCAL_APP_DATA_DIR: DATA_DIR },
      stdio: ['pipe', 'pipe', 'inherit'],
      windowsHide: true,
    });
    const timer = setTimeout(() => { child.kill(); reject(new Error('timeout')); }, timeoutMs);
    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
      let idx;
      while ((idx = out.indexOf('\n')) >= 0) {
        const line = out.slice(0, idx);
        out = out.slice(idx + 1);
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id === 2) {
            clearTimeout(timer);
            child.kill();
            resolve(msg.result);
            return;
          }
        } catch { /* partial/noise */ }
      }
    });
    child.on('error', reject);
    child.stdin.write(JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'task06-accept', version: '1' } },
    }) + '\n');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method, params }) + '\n');
    child.stdin.end();
  });
}

function text(result) {
  return result?.content?.[0]?.text || JSON.stringify(result);
}

async function main() {
  const a = text(await call('tools/call', { name: 'search_saved_notes', arguments: { query: '鎏金独木舟' } }));
  console.log('A title-only:', a.includes('鎏金独木舟建造手册') ? 'PASS' : 'FAIL ' + a.slice(0, 120));

  const b = text(await call('tools/call', { name: 'search_saved_notes', arguments: { query: '水磨石' } }));
  console.log('B body-only:', b.includes('水磨石地面养护指南') ? 'PASS' : 'FAIL ' + b.slice(0, 120));

  const c = text(await call('tools/call', { name: 'search_saved_notes', arguments: { query: '苔藓微景观' } }));
  console.log('C OCR-only:', c.includes('64cb1234000000000102a103') ? 'PASS' : 'FAIL ' + c.slice(0, 160));

  const d = text(await call('tools/call', { name: 'read_saved_note', arguments: { note_id: '64cb1234000000000102a101' } }));
  console.log('D read-note:', d.includes('鎏金独木舟建造手册') && d.includes('手工') ? 'PASS' : 'FAIL ' + d.slice(0, 160));

  const e = text(await call('tools/call', { name: 'search_saved_notes', arguments: { query: '鎏金独木舟' } }));
  console.log('E app-closed-readable:', e.includes('鎏金独木舟建造手册') ? 'PASS' : 'FAIL');

  const tools = text(await call('tools/list', {}));
  console.log('tools:', tools.slice(0, 160));
  console.log('write-capable tools:', /delete|write|create|update|import/i.test(tools) ? 'FOUND (BAD)' : 'none (read-only OK)');
}

main().catch((err) => { console.error('ERR', err.message); process.exit(1); });
