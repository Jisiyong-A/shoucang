/* Self-contained: inspect __INITIAL_STATE__ noteDetailMap for a note page. */
function extractInitialState(html) {
  const marker = 'window.__INITIAL_STATE__=';
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const valueStart = start + marker.length;
  const valueEnd = html.indexOf('</script>', valueStart);
  if (valueEnd === -1) return null;
  const serialized = html.slice(valueStart, valueEnd).trim().replace(/;$/, '');
  try {
    return JSON.parse(serialized);
  } catch {
    try {
      return JSON.parse(serialized.replace(/\bundefined\b/g, 'null'));
    } catch {
      return null;
    }
  }
}

function findKey(obj, key, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 8) return null;
  if (key in obj) return obj[key];
  for (const v of Object.values(obj)) {
    const r = findKey(v, key, depth + 1);
    if (r) return r;
  }
  return null;
}

const url = process.argv[2];
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

const detailMap = findKey(state, 'noteDetailMap');
console.log('noteDetailMap found:', Boolean(detailMap), '| entries:', detailMap ? Object.keys(detailMap).length : '-');
if (detailMap && Object.keys(detailMap).length > 0) {
  for (const [id, entry] of Object.entries(detailMap)) {
    const n = entry?.note || {};
    console.log('--- noteDetail', id.slice(0, 12));
    console.log('  title:', (n.title || n.displayTitle || '').slice(0, 50));
    console.log('  desc len:', (n.desc || n.description || '').length);
    console.log('  imageList:', Array.isArray(n.imageList) ? n.imageList.length : typeof n.imageList);
    console.log('  type:', n.type, '| video:', Boolean(n.video));
    console.log('  keys:', Object.keys(n).slice(0, 20).join(','));
  }
} else {
  // maybe structure differs — dump top-level keys
  console.log('state top keys:', Object.keys(state).slice(0, 25).join(','));
  const noteRoot = state?.note || state?.noteData;
  if (noteRoot) console.log('note/noteData keys:', Object.keys(noteRoot).slice(0, 25).join(','));
}
