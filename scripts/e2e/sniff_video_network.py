"""Capture media requests (m3u8/mp4) on the autoplaying video page."""
import json
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9222'
with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
page = [p for p in pages if p.get('type') == 'page' and 'xiaohongshu' in p.get('url', '')][0]
ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=120)
mid = [0]
media = []


def send(method, params=None):
    mid[0] += 1
    ws.send(json.dumps({'id': mid[0], 'method': method, 'params': params or {}}))
    while True:
        d = json.loads(ws.recv())
        if d.get('id') == mid[0]:
            return d.get('result', {})


send('Network.enable')
# reload to capture the autoplay stream requests
ws.send(json.dumps({'id': 99, 'method': 'Page.reload'}))
deadline = time.time() + 25
while time.time() < deadline:
    ws.settimeout(max(1, deadline - time.time()))
    try:
        d = json.loads(ws.recv())
    except Exception:
        break
    if d.get('method') == 'Network.requestWillBeSent':
        url = d['params']['request']['url']
        if any(k in url.lower() for k in ('.m3u8', '.mp4', 'video', 'media', 'stream', 'play')):
            media.append(url[:150])
ws.close()
seen = set()
for u in media:
    if u not in seen:
        print(u)
        seen.add(u)
print('--- media requests:', len(media))
