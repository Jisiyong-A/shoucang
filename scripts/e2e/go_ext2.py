"""Navigate the user's logged-in Chrome (9222) to chrome://extensions."""
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
ws = websocket.create_connection(page[0]['webSocketDebuggerUrl'], timeout=60)
ws.send(json.dumps({'id': 1, 'method': 'Page.navigate', 'params': {'url': 'chrome://extensions/'}}))
time.sleep(4)
ws.close()
print('navigated to chrome://extensions')
