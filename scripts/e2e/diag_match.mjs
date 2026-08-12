/* Find the exact noteId object in the anonymous page state and dump fields. */
function extractInitialState(html) {
  const marker = 'window.__INITIAL_STATE__=';
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const valueStart = start + marker.length;
  const valueEnd = html.indexOf('</script>', valueStart);
  if (valueEnd === -1) return null;
  const serialized = html.slice(valueStart, valueEnd).trim().replace(/;$/, '');
  try { return JSON.parse(serialized); }
  catch { try { return JSON.parse(serialized.replace(/\bundefined\b/g, 'null')); } catch { return null; } }
}

const url = process.argv[2];
const noteId = url.match(/\/explore\/([0-9a-f]{24})/i)?.[1];
console.log('target noteId:', noteId);

const res = await fetch(url, {
  headers: {
    'user-agent': 'ShouCangFavorites/0.1 anonymous-local-resolver',
    'Accept-Language': 'zh-CN,zh;q=0.9',
  },
  redirect: 'manual',
  credentials: 'omit',
  signal: AbortSignal.timeout(30000),
});
console.log('status:', res.status, '| location:', (res.headers.get('location') || '').slice(0, 80));
let html = await res.text();
if (res.status >= 300 && res.status < 400) {
  const r2 = await fetch(new URL(res.headers.get('location'), url).toString(), {
    headers: { 'User-Agent': 'ShouCangFavorites/0.1 anonymous-local-resolver', 'Accept-Language': 'zh-CN,zh;q=0.9' },
    credentials: 'omit', signal: AbortSignal.timeout(30000),
  });
  html = await r2.text();
}
console.log('html bytes:', html.length);
const state = extractInitialState(html);
if (!state) { console.log('no state'); process.exit(1); }

// BFS: find objects whose id matches noteId, collect all distinct shapes
const found = [];
const seen = new WeakSet();
const queue = [{ value: state, depth: 0 }];
while (queue.length) {
  const { value, depth } = queue.shift();
  if (!value || typeof value !== 'object' || seen.has(value)) continue;
  seen.add(value);
  const id = String(value.noteId || value.note_id || value.id || '');
  if (id.toLowerCase() === noteId.toLowerCase()) found.push(value);
  if (depth >= 9) continue;
  for (const v of (Array.isArray(value) ? value : Object.values(value))) {
    if (v && typeof v === 'object') queue.push({ value: v, depth: depth + 1 });
  }
}
console.log('objects matching noteId:', found.length);
found.forEach((obj, i) => {
  console.log(`--- match ${i}: keys:`, Object.keys(obj).slice(0, 25).join(','));
  console.log('    title:', String(obj.title || obj.displayTitle || '').slice(0, 50));
  console.log('    desc len:', String(obj.desc || obj.description || obj.content || '').length);
  console.log('    imageList:', Array.isArray(obj.imageList) ? obj.imageList.length : typeof obj.imageList);
});
