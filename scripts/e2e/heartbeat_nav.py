"""Navigate XHS Chrome to xiaohongshu so the extension heartbeats."""
import json
import time
import urllib.request
import websocket

with urllib.request.urlopen('http://127.0.0.1:9222/json/list', timeout=5) as r:
    pages = json.load(r)
target = [p for p in pages if p.get('type') == 'page' and 'xiaohongshu' in p.get('url', '')]
if not target:
    target = [p for p in pages if p.get('type') == 'page' and p.get('url', '').startswith('http')]
if not target:
    print('no page target')
    raise SystemExit(1)
ws = websocket.create_connection(target[0]['webSocketDebuggerUrl'], timeout=60)
ws.send(json.dumps({'id': 1, 'method': 'Page.navigate', 'params': {'url': 'https://www.xiaohongshu.com/explore'}}))
time.sleep(6)
ws.close()
print('navigated to xiaohongshu — heartbeat should fire')
