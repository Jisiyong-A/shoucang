"""Inspect current page state."""
import json
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9235'
with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
for p in pages:
    if p.get('type') == 'page':
        print('page url:', repr(p.get('url', '')))
        ws = websocket.create_connection(p['webSocketDebuggerUrl'], timeout=60)
        ws.send(json.dumps({'id': 1, 'method': 'Runtime.evaluate',
                            'params': {'expression': 'document.title + " | " + document.body.innerText.slice(0, 200)',
                                       'returnByValue': True}}))
        while True:
            d = json.loads(ws.recv())
            if d.get('id') == 1:
                print('content:', d.get('result', {}).get('result', {}).get('value', '')[:220])
                break
        ws.close()
        break
