"""Check extension button on the XHS explore page (Edge 9230)."""
import json
import urllib.request
import websocket

with urllib.request.urlopen('http://127.0.0.1:9230/json/list', timeout=5) as r:
    pages = json.load(r)
ws = websocket.create_connection([p['webSocketDebuggerUrl'] for p in pages if p.get('type') == 'page' and 'xiaohongshu' in p.get('url', '')][0], timeout=60)
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


info = ev("""
(() => {
  const btn = document.getElementById('shoucang-note-import-button');
  return btn ? { found: true, text: btn.textContent, title: btn.title } : { found: false };
})()
""")
print('button:', json.dumps(info, ensure_ascii=False))
print('page title:', ev('document.title')[:50])
ws.close()
