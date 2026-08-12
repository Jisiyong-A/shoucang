"""Check if the 收藏 extension button actually appears on a video note
page in the user's logged-in Chrome (9222)."""
import json
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9222'
with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
page = [p for p in pages if p.get('type') == 'page' and 'xiaohongshu' in p.get('url', '')]
if not page:
    page = [p for p in pages if p.get('type') == 'page']
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
    return send('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True}).get('result', {}).get('value')


# navigate to a video note (the one we imported before)
send('Page.navigate', {'url': 'https://www.xiaohongshu.com/explore/6a7c5ccb0000000025001dae'})
time.sleep(8)
print('page:', ev('document.title')[:60])
result = ev("""
(() => {
  const btn = document.getElementById('shoucang-note-import-button');
  const anyBtn = document.querySelector('[id*="import-button"], [class*="import-button"]');
  const videos = document.querySelectorAll('video').length;
  return { shoucangButton: Boolean(btn), anyButton: Boolean(anyBtn), videoCount: videos, extScripts: window.__SHOUCANG_EXT__ || null };
})()
""")
print('button check:', json.dumps(result, ensure_ascii=False))
ws.close()
