import json
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9236'
with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
page = [p for p in pages if p.get('type') == 'page'][0]
ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=300)
ws.send(json.dumps({'id': 1, 'method': 'Page.navigate', 'params': {'url': 'http://localhost:8080'}}))
time.sleep(12)
ws.close()
print('navigated, waiting for app + indexing')
