"""Re-download missing video files for existing notes.

Strategy: for each video note missing video.mp4, navigate to its explore page
URL and re-trigger the import (satellite re-saves video). Also useful to
understand why download failed originally.
"""
import json
import os
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9222'
API = 'http://127.0.0.1:4318'
MEDIA = os.path.join(os.environ.get('LOCALAPPDATA', r'C:\Users\12155\AppData\Local'), 'com.patrick.shoucang', 'media')


def get_notes():
    with urllib.request.urlopen(f'{API}/notes', timeout=10) as r:
        return json.load(r)['notes']


notes = get_notes()
missing = [n for n in notes if (n.get('type') == 'video' or n.get('videoLocalPath')) and not os.path.exists(os.path.join(MEDIA, n['id'], 'video.mp4'))]
print(f'Missing video files: {len(missing)}')

if not missing:
    raise SystemExit(0)

# Find CDP page
with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
page = next((p for p in pages if p.get('type') == 'page' and 'xiaohongshu' in p.get('url', '')), None)
if not page:
    page = next((p for p in pages if p.get('type') == 'page'), None)

ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=300)
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


for n in missing:
    nid = n['id']
    url = f'https://www.xiaohongshu.com/explore/{nid}'
    print(f'\n--- {nid} {(n.get("title") or "")[:20]} ---')
    send('Page.navigate', {'url': url})
    time.sleep(8)
    # Check if there's a save/import button
    has_btn = ev("Boolean(document.getElementById('shoucang-note-import-button'))")
    print(f'import button: {has_btn}')
    if has_btn:
        ev("document.getElementById('shoucang-note-import-button').click()")
        time.sleep(20)
    # Verify after
    after = os.path.exists(os.path.join(MEDIA, nid, 'video.mp4'))
    if after:
        sz = os.path.getsize(os.path.join(MEDIA, nid, 'video.mp4'))
        print(f'video.mp4 now exists ({sz/1024/1024:.1f} MB)')
    else:
        print('still missing')

ws.close()
print('\nDone.')