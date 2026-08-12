"""WebView2-side drop handling test: dispatch a synthetic drop on the real
production UI (localhost:8080) with the extension's exact drag payload
(text/plain SHOUCANG payload + uri-list). Asserts import pipeline runs."""
import json
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9232'
API = 'http://127.0.0.1:4318'

with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
ws = websocket.create_connection([p['webSocketDebuggerUrl'] for p in pages if p.get('type') == 'page'][0], timeout=120)
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


time.sleep(6)
print('title:', ev('document.title'))
print('status:', ev("document.body.innerText.includes('LOCAL ENGINE READY') ? 'READY' : document.body.innerText.slice(-200)"))

# Build the exact payload the extension sets (captureCurrentNote shape)
# NOTE: sourceUrl must be resolvable — use the real tokenized URL.
payload = json.dumps({
    'id': '6a7acd410000000022013d61',
    'sourceUrl': 'https://www.xiaohongshu.com/explore/6a7acd410000000022013d61?xsec_token=ABrYcxjla_hOzPc5V-0IA-oVbWe45oNQdQKXiSh2UM89A=&xsec_source=',
    'title': '西湖区三墩🏠整租1300，一室一厅1800起',
    'content': '一室一厅整租 1800 起，近地铁',
    'imageUrls': [],
    'author': {'name': '租房小管家', 'avatarUrl': ''},
}, ensure_ascii=False)

result = ev(f"""
(async () => {{
  const dt = new DataTransfer();
  dt.setData('text/plain', 'SHOUCANG_CARD:{payload}');
  dt.setData('text/uri-list', 'https://www.xiaohongshu.com/explore/6a7acd410000000022013d61');
  const root = Array.from(document.querySelectorAll('div')).find(d => d.style && d.style.height === '100vh')
    || document.body;
  const ok = root.dispatchEvent(new DragEvent('drop', {{
    bubbles: true,
    cancelable: true,
    dataTransfer: dt,
  }}));
  return ok;
}})()
""")
print('drop dispatched:', result)

time.sleep(12)
with urllib.request.urlopen(f'{API}/notes', timeout=10) as r:
    notes = json.load(r).get('notes', [])
print('notes in archive:', len(notes))
for n in notes:
    print(' -', n['id'][:12], '|', n['title'][:24], '| mediaStatus:', n.get('mediaStatus'), '| ocrText len:', len(n.get('ocrText') or ''))
ws.close()
print('RESULT:', 'DROP_IMPORT_OK' if len(notes) > 0 else 'DROP_NOT_HANDLED')
