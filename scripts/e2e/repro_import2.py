"""Grab a feed note link from user's Chrome and try the import API."""
import json
import time
import urllib.request
import urllib.error
import websocket

CDP = 'http://127.0.0.1:9222'
API = 'http://127.0.0.1:4318'

with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
page = [p for p in pages if p.get('type') == 'page' and 'xiaohongshu' in p.get('url', '')]
if not page:
    print('no XHS page')
    raise SystemExit(1)
ws = websocket.create_connection(page[0]['webSocketDebuggerUrl'], timeout=120)
mid = [0]


def send(method, params=None):
    mid[0] += 1
    ws.send(json.dumps({'id': mid[0], 'method': method, 'params': params or {}}))
    while True:
        d = json.loads(ws.recv())
        if d.get('id') == mid[0]:
            return d.get('result', {})


def ev(expr):
    return send('Runtime.evaluate', {'expression': expr, 'returnByValue': True}).get('result', {}).get('value')


# ensure we're on explore, grab a feed link
send('Page.navigate', {'url': 'https://www.xiaohongshu.com/explore'})
time.sleep(6)
links = ev("""
(() => {
  const anchors = Array.from(document.querySelectorAll('a[href*="/explore/"][href*="xsec_token"]'));
  return anchors.slice(0, 5).map(a => a.href);
})()
""")
print('feed links:', len(links or []))
if not links:
    ws.close()
    raise SystemExit(1)
ws.close()

url = links[0]
print('testing:', url[:90])
payload = json.dumps({'input': url}).encode('utf-8')
req = urllib.request.Request(f'{API}/notes/import', data=payload,
                             headers={'Content-Type': 'application/json'}, method='POST')
try:
    with urllib.request.urlopen(req, timeout=90) as r:
        resp = json.load(r)
    note = resp.get('note') or {}
    print('IMPORT OK')
    print('  title:', (note.get('title') or '')[:40])
    print('  body chars:', len(note.get('rawContent') or ''))
    print('  images:', len(note.get('imageUrls') or []))
    print('  mediaStatus:', note.get('mediaStatus'))
    print('  ocrText chars:', len(note.get('ocrText') or ''))
    print('  category:', note.get('category'))
except urllib.error.HTTPError as e:
    print('IMPORT FAILED:', e.code, e.read().decode('utf-8', 'replace')[:500])
except Exception as e:
    print('IMPORT ERROR:', str(e)[:300])
