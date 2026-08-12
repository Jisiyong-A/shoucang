/* Diagnose: what does __INITIAL_STATE__ contain for a note page, and
 * which object does our findNote() actually return? */
import { readFile } from 'node:fs/promises';

// reuse the resolver's internal helpers by importing the module
const mod = await import('../lib/anonymous-note-resolver.mjs');
const { extractInitialState } = mod;

const url = process.argv[2];
if (!url) { console.error('usage: node diag_resolve.mjs <note-url>'); process.exit(1); }

const res = await fetch(url, {
  headers: {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    accept: 'text/html,application/xhtml+xml',
  },
  redirect: 'follow',
  credentials: 'omit',
});
console.log('status:', res.status);
const html = await res.text();
console.log('html bytes:', html.length);

const state = extractInitialState(html);
console.log('initial state found:', Boolean(state));
if (!state) process.exit(1);

// walk the state for noteDetailMap
function findKey(obj, key, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 6) return null;
  if (key in obj) return obj[key];
  for (const v of Object.values(obj)) {
    const r = findKey(v, key, depth + 1);
    if (r) return r;
  }
  return null;
}
const detailMap = findKey(state, 'noteDetailMap');
console.log('noteDetailMap found:', Boolean(detailMap));
if (detailMap) {
  for (const [id, entry] of Object.entries(detailMap)) {
    const n = entry?.note || {};
    console.log('--- noteDetail', id.slice(0, 8));
    console.log('  title:', (n.title || n.displayTitle || '').slice(0, 40));
    console.log('  desc len:', (n.desc || '').length);
    console.log('  imageList:', Array.isArray(n.imageList) ? n.imageList.length : typeof n.imageList);
    console.log('  type:', n.type, '| video:', Boolean(n.video));
  }
}
