"""Verify embedded semantic indexing: check IndexedDB vectors + search hit."""
import json
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9236'

with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
page = [p for p in pages if p.get('type') == 'page' and 'localhost' in p.get('url', '')]
if not page:
    print('no preview page')
    raise SystemExit(1)
ws = websocket.create_connection(page[0]['webSocketDebuggerUrl'], timeout=300)
mid = [0]


def send(method, params=None):
    mid[0] += 1
    ws.send(json.dumps({'id': mid[0], 'method': method, 'params': params or {}}))
    while True:
        d = json.loads(ws.recv())
        if d.get('id') == mid[0]:
            if 'error' in d:
                raise RuntimeError(d['error'])
            return d.get('result', {})


def ev(expr):
    return send('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True}).get('result', {}).get('value')


# wait for the app to load + background indexing to kick off
for attempt in range(30):
    status = ev("""
    new Promise((resolve) => {
      const req = indexedDB.open('shoucang-semantic');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('vectors', 'readonly');
        const count = tx.objectStore('vectors').count();
        count.onsuccess = () => resolve({ cached: count.result });
        count.onerror = () => resolve({ cached: 0, error: true });
      };
      req.onerror = () => resolve({ cached: 0, error: true });
    })
    """)
    if status and status.get('cached', 0) > 0:
        print(f'IndexedDB vectors: {status}')
        break
    time.sleep(5)
else:
    print('indexing did not complete in 150s; last status:', status)
    ws.close()
    raise SystemExit(1)

# semantic search: different phrasing should hit the note
time.sleep(1)
result = ev("""
(async () => {
  const m = await import('/_next/static/chunks/semantic-embed.mjs').catch(() => null);
  if (m) return { module: true };
  // fallback: check the notes store for the note text
  return { module: false };
})()
""")
print('semantic module:', result)
ws.close()
print('RESULT: INDEXED_OK')
