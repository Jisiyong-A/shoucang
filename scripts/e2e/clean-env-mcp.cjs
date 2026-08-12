/* Clean-env MCP check against the INSTALLED server (bundled node). */
const { spawn } = require('node:child_process');
const fs = require('node:fs');

const DIR = 'C:/Users/12155/AppData/Local/com.patrick.shoucang';
const SERVER = 'C:/Users/12155/AppData/Local/收藏/shoucang-mcp.mjs';

fs.writeFileSync(DIR + '/notes.json', JSON.stringify([
  { id: '64cb1234000000000102b001', title: '干净环境测试笔记', rawContent: '正文', ocrText: '独有OCR词', category: '测试', savedAt: '2026-08-12T00:00:00.000Z' },
]));

const child = spawn(process.execPath, [SERVER], {
  env: { ...process.env, LOCAL_APP_DATA_DIR: DIR },
  stdio: ['pipe', 'pipe', 'inherit'],
  windowsHide: true,
});
let out = '';
const timer = setTimeout(() => { console.log('TIMEOUT'); process.exit(2); }, 20000);
child.stdout.on('data', (d) => {
  out += d;
  let idx;
  while ((idx = out.indexOf('\n')) >= 0) {
    const line = out.slice(0, idx);
    out = out.slice(idx + 1);
    if (!line.trim()) continue;
    try {
      const m = JSON.parse(line);
      if (m.id === 2) {
        clearTimeout(timer);
        const text = m.result?.content?.[0]?.text || JSON.stringify(m);
        console.log('MCP search hit:', text.includes('干净环境测试笔记') ? 'PASS' : 'FAIL ' + text.slice(0, 100));
        child.kill();
        process.exit(0);
      }
    } catch { /* keep reading */ }
  }
});
child.on('error', (e) => { console.log('spawn error', e.message); process.exit(3); });
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'clean', version: '1' } }}) + '\n');
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'search_saved_notes', arguments: { query: '独有OCR词' } }}) + '\n');
child.stdin.end();
