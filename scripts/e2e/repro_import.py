"""Reproduce the import failure: grab a real note link from the user's
logged-in Chrome and POST it through the app's import endpoint."""
import json
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9222'
API = 'http://127.0.0.1:4318'

# 1) grab a feed link from the logged-in Chrome
with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
page = [p for p in pages if p.get('type') == 'page' and 'xiaohongshu' in p.get('url', '')]
if not page:
    print('no XHS page open in user chrome')
    raise SystemExit(1)
ws = websocket.create_connection(page[0]['webSocketDebuggerUrl'], timeout=120)
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
    return send('Runtime.evaluate', {'expression': expr, 'returnByValue': True}).get('result', {}).get('value')


# current page url (user's active tab)
cur = page[0].get('url', '')
print('current page:', cur[:80])
ws.close()

# 2) try importing it (the extension would send this exact POST)
if '/explore/' in cur and 'xsec_token' in cur:
    payload = json.dumps({'input': cur}).encode('utf-8')
    req = urllib.request.Request(f'{API}/notes/import', data=payload,
                                 headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            resp = json.load(r)
        note = resp.get('note') or {}
        print('IMPORT OK | id:', note.get('id', '?')[:20])
        print('  title:', (note.get('title') or '')[:40])
        print('  body chars:', len(note.get('rawContent') or ''))
        print('  images:', len(note.get('imageUrls') or []))
        print('  mediaStatus:', note.get('mediaStatus'))
        print('  ocrText chars:', len(note.get('ocrText') or ''))
        print('  category:', note.get('category'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', 'replace')[:400]
        print('IMPORT FAILED:', e.code, body)
    except Exception as e:
        print('IMPORT ERROR:', str(e)[:300])
else:
    print('current tab is not a note page — need a note URL')
