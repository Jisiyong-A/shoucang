"""DPI 1.5x + 1366x768 window screenshot."""
import base64
import json
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9234'
OUT = r'D:\hermes\kankan-shoucang\docs\windows-port\screenshots'

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


time.sleep(8)
print('title:', ev('document.title'))
print('dpr:', ev('window.devicePixelRatio'))
print('inner:', ev('innerWidth + "x" + innerHeight'))
text = ev('document.body.innerText') or ''
print('ready:', 'LOCAL ENGINE READY' in text, '| notes:', '1000' in text)

res = send('Page.captureScreenshot', {'format': 'png'})
data = base64.b64decode(res['data'])
with open(f'{OUT}\\10-dpi150-1366x768.png', 'wb') as f:
    f.write(data)
print('saved', len(data))
ws.close()
