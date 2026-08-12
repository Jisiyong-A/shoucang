"""Close the stray file:// tab in XHS Chrome (9222)."""
import json
import urllib.request
import websocket

with urllib.request.urlopen('http://127.0.0.1:9222/json/list', timeout=5) as r:
    pages = json.load(r)
for p in pages:
    if p.get('type') == 'page' and p.get('url', '').startswith('file://'):
        ws = websocket.create_connection(p['webSocketDebuggerUrl'], timeout=30)
        ws.send(json.dumps({'id': 1, 'method': 'Page.close'}))
        ws.close()
        print('closed stray tab:', p['url'][:60])
print('done')
