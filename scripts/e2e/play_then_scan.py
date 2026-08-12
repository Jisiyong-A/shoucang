"""Test: trigger video playback on a fresh video note page, then check if
the signed stream URL appears in scripts/window."""
import json
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9222'
with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
page = [p for p in pages if p.get('type') == 'page' and 'xiaohongshu' in p.get('url', '')][0]
ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=180)
mid = [0]


def send(method, params=None):
    mid[0] += 1
    ws.send(json.dumps({'id': mid[0], 'method': method, 'params': params or {}}))
    while True:
        d = json.loads(ws.recv())
        if d.get('id') == mid[0]:
            return d.get('result', {})


def ev(expr):
    return send('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True}).get('result', {}).get('value')


def scan():
    return ev("""
    (() => {
      const pattern = /https?:\\/\\/sns-video[a-z0-9-]*\\.xhscdn\\.com[^"'\\\\\\s)]*\\.mp4[^"'\\\\\\s)]*/g;
      const found = [];
      for (const el of document.querySelectorAll('script')) {
        if (el.textContent.includes('sns-video')) {
          const m = el.textContent.match(pattern) || [];
          found.push(...m);
        }
      }
      return { scripts: found.length, first: (found[0] || '').slice(0, 90) };
    })()
    """)


print('page:', ev('document.title')[:50])
print('BEFORE play:', json.dumps(scan()))
# trigger muted playback (user-gesture context not required for muted)
result = ev("""
(() => {
  const v = document.querySelector('video');
  if (!v) return { video: false };
  v.muted = true;
  const p = v.play().then(() => ({ playing: true })).catch((e) => ({ playing: false, err: String(e).slice(0, 60) }));
  return { video: true, promise: p };
})()
""")
print('play:', json.dumps(result, ensure_ascii=False)[:200])
time.sleep(4)
print('AFTER play:', json.dumps(scan()))
ws.close()
