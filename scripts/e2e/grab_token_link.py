"""Grab a tokenized note link from the logged-in XHS Chrome (9222)."""
import json
import urllib.request
import websocket

with urllib.request.urlopen('http://127.0.0.1:9222/json/list', timeout=5) as r:
    pages = json.load(r)
ws_url = [p['webSocketDebuggerUrl'] for p in pages if p.get('type') == 'page'][0]
ws = websocket.create_connection(ws_url, timeout=60)
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


links = ev("Array.from(document.querySelectorAll('a[href*=\"/explore/\"][href*=\"xsec_token\"]')).map(a=>a.href).slice(0,3)")
print(json.dumps(links, ensure_ascii=False))
ws.close()
