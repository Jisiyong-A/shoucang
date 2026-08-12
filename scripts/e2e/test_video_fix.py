"""Test: import a video note and verify videoLocalPath matches file on disk."""
import json
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9222'
API = 'http://127.0.0.1:4318'

with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
page = [p for p in pages if p.get('type') == 'page' and 'xiaohongshu' in p.get('url', '')]
if not page:
    page = [p for p in pages if p.get('type') == 'page']
ws = websocket.create_connection(page[0]['webSocketDebuggerUrl'], timeout=180)
mid = [0]


def send(method, params=None):
    mid[0] += 1
    ws.send(json.dumps({'id': mid[0], 'method': method, 'params': params or {}}))
    while True:
        d = json.loads(ws.recv())
        if d.get('id') == mid[0]:
            return d.get('result', {})


def ev(expr):
    return send('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True}).get('result', {}).get('value')


# Navigate to feed and find a video note
send('Page.navigate', {'url': 'https://www.xiaohongshu.com/explore'})
time.sleep(7)
link = ev("""
(() => {
  const anchors = Array.from(document.querySelectorAll('a[href*="/explore/"][href*="xsec_token"]'));
  const withVideo = anchors.filter((a) => {
    const card = a.closest('section') || a.parentElement?.parentElement;
    return card && (card.querySelector('video, [class*="video"], [class*="play"]') || /video/i.test(card.className));
  });
  const pool = withVideo.length ? withVideo : anchors;
  return (pool[0] || {}).href || '';
})()
""")
print('Target:', (link or '(none)')[:70])

if not link:
    ws.close()
    raise SystemExit(1)

# Open note page
send('Page.navigate', {'url': link})
time.sleep(8)
title = ev('document.title')[:50]
print('Title:', title)

# Check if button exists
hasBtn = ev("Boolean(document.getElementById('shoucang-note-import-button'))")
print('Button:', hasBtn)

if hasBtn:
    # Click button
    clicked = ev("(() => { const btn = document.getElementById('shoucang-note-import-button'); btn.click(); return {ok: true, text: btn.textContent.trim().slice(0, 20)}; })()")
    print('Clicked:', clicked)
    time.sleep(25)

# Verify import
with urllib.request.urlopen(f'{API}/notes', timeout=10) as r:
    notes = json.load(r)['notes']

newest = notes[0]
nid = newest['id']
vlp = newest.get('videoLocalPath', '')
import os
media_dir = r'C:\Users\12155\AppData\Local\com.patrick.shoucang\media'
video_path = os.path.join(media_dir, nid, 'video.mp4')
file_exists = os.path.exists(video_path)

print()
print(f'=== Import Result ===')
print(f'Note ID: {nid} (len={len(nid)})')
print(f'Title: {(newest.get("title",""))[:40]}')
print(f'videoLocalPath: {vlp[:70] if vlp else "(none)"}')
print(f'video.mp4 exists: {file_exists}')
print(f'Expected path: {video_path}')
if file_exists:
    print(f'Size: {os.path.getsize(video_path)/1024/1024:.1f} MB')

# Test media API
print()
print('=== Media API Test ===')
try:
    req = urllib.request.Request(f'{API}/media/{nid}/video.mp4')
    with urllib.request.urlopen(req, timeout=10) as resp:
        print(f'HTTP: {resp.status}, Content-Type: {resp.headers.get("Content-Type")}')
        print(f'Size (first 100 bytes): {len(resp.read(100))} bytes')
except Exception as e:
    print(f'Error: {e}')

ws.close()
