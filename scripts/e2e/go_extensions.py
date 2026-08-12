"""Navigate XHS Chrome (9222) to chrome://extensions."""
import json
import time
import urllib.request
import websocket

with urllib.request.urlopen('http://127.0.0.1:9222/json/list', timeout=5) as r:
    pages = json.load(r)
page = [p for p in pages if p.get('type') == 'page' and 'xiaohongshu' in p.get('url', '')][0]
ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=60)
mid = [0]


def send(method, params=None):
    mid[0] += 1
    ws.send(json.dumps({'id': mid[0], 'method': method, 'params': params or {}}))
    while True:
        d = json.loads(ws.recv())
        if d.get('id') == mid[0]:
            return d.get('result', {})


send('Page.navigate', {'url': 'chrome://extensions/'})
time.sleep(3)
print('navigated to chrome://extensions')
ws.close()
