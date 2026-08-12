"""Check the DOM video element and the extension's own capture logic."""
import json
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9222'
with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
page = [p for p in pages if p.get('type') == 'page' and 'xiaohongshu' in p.get('url', '')][0]
ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=120)
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


print('page:', ev('document.title')[:50])
dump = ev("""
(() => {
  const videos = Array.from(document.querySelectorAll('video'));
  const sources = Array.from(document.querySelectorAll('video source[src]'));
  return {
    videoCount: videos.length,
    videoSrcs: videos.map((v) => (v.src || '').slice(0, 100)),
    sourceSrcs: sources.map((s) => (s.src || '').slice(0, 100)),
    videoHtml: videos.length ? videos[0].outerHTML.slice(0, 300) : '',
  };
})()
""")
print(json.dumps(dump, ensure_ascii=False)[:500])
ws.close()
