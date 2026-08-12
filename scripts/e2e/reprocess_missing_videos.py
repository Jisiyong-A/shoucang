"""Batch re-process video notes missing video downloads.
For each video note without videoLocalPath, navigate to its page and
use the extension's extraction logic to get the video URL, then re-import.
"""
import json
import os
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9222'
API = 'http://127.0.0.1:4318'
MEDIA = os.path.join(os.environ.get('LOCALAPPDATA', r'C:\Users\12155\AppData\Local'), 'com.patrick.shoucang', 'media')

# Get missing notes
with urllib.request.urlopen(f'{API}/notes', timeout=10) as r:
    notes = json.load(r)['notes']

missing = []
for n in notes:
    nid = n['id']
    if n.get('type') == 'video' and not n.get('videoLocalPath'):
        if not os.path.exists(os.path.join(MEDIA, nid, 'video.mp4')):
            missing.append(n)

print(f'Missing videos: {len(missing)}')
if not missing:
    raise SystemExit(0)

# Setup CDP
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

results = []
for n in missing:
    nid = n['id']
    url = f'https://www.xiaohongshu.com/explore/{nid}'
    print(f'\n--- Processing: {nid} ({n.get("title", "")[:20]}) ---')
    
    # Navigate to note
    send('Page.navigate', {'url': url})
    time.sleep(8)
    
    # Check if button exists
    has_btn = ev("Boolean(document.getElementById('shoucang-note-import-button'))")
    print(f'Import button: {has_btn}')
    
    if has_btn:
        # Click to import
        result = ev("""
        (() => {
            const btn = document.getElementById('shoucang-note-import-button');
            btn.click();
            return {clicked: true, text: btn.textContent.trim().slice(0, 30)};
        })()
        """)
        print(f'Click result: {result}')
        
        # Wait for import
        time.sleep(25)
    
    # Check if video downloaded
    video_path = os.path.join(MEDIA, nid, 'video.mp4')
    if os.path.exists(video_path):
        size = os.path.getsize(video_path)
        print(f'SUCCESS: video.mp4 downloaded ({size/1024/1024:.1f} MB)')
        results.append({'id': nid, 'status': 'ok', 'size': size})
    else:
        print('FAILED: video still missing')
        results.append({'id': nid, 'status': 'fail'})

ws.close()
print(f'\n=== Summary ===')
print(f'Total processed: {len(results)}')
print(f'Success: {sum(1 for r in results if r["status"] == "ok")}')
print(f'Failed: {sum(1 for r in results if r["status"] == "fail")}')