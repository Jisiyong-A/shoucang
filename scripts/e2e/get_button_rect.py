"""Get the extension button's screen coords via CDP 9231 (CFT Chrome)."""
import json
import urllib.request
import websocket

with urllib.request.urlopen('http://127.0.0.1:9231/json/list', timeout=5) as r:
    pages = json.load(r)
ws = websocket.create_connection([p['webSocketDebuggerUrl'] for p in pages if p.get('type') == 'page'][0], timeout=30)
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
  if (!btn) return {found: false};
  const r = btn.getBoundingClientRect();
  return {
    found: true,
    text: btn.textContent,
    x: r.x, y: r.y, w: r.width, h: r.height,
    winX: window.screenX, winY: window.screenY,
    innerW: window.innerWidth, innerH: window.innerHeight,
    screenW: window.screen.width, screenH: window.screen.height,
  };
})()
""")
print(json.dumps(info, ensure_ascii=False))
ws.close()
