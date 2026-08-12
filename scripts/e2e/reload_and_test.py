"""Navigate back to the XHS video note and verify the extension's NEW
content.js is active (sns-video regex present in injected behavior)."""
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


# grab a token link from feed (fresh)
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
print('target link:', (link or '')[:70])
if not link:
    ws.close()
    raise SystemExit(1)

send('Page.navigate', {'url': link})
time.sleep(8)
print('page:', ev('document.title')[:50])
hasBtn = ev("Boolean(document.getElementById('shoucang-note-import-button'))")
print('button:', hasBtn)
if not hasBtn:
    ws.close()
    raise SystemExit(1)

# click the button (real click) — new content.js should include videoUrl
ev("document.getElementById('shoucang-note-import-button').click()")
print('clicked')
time.sleep(25)

# verify the newest note has videoLocalPath
with urllib.request.urlopen('http://127.0.0.1:4318/notes', timeout=10) as r:
    notes = json.load(r)['notes']
newest = notes[0]
print('newest:', (newest.get('title') or '')[:40])
print('  videoLocalPath:', (newest.get('videoLocalPath') or '(EMPTY)')[:70])
print('  type:', newest.get('type'), '| mediaStatus:', newest.get('mediaStatus'))

import os
ndir = r'C:\Users\12155\AppData\Local\com.patrick.shoucang\media' + os.sep + newest['id']
if os.path.isdir(ndir):
    files = os.listdir(ndir)
    vp = os.path.join(ndir, 'video.mp4')
    print('  media files:', files)
    if os.path.exists(vp):
        print(f'  ✅ VIDEO DOWNLOADED: {os.path.getsize(vp)/1024/1024:.1f} MB')
    else:
        print('  ❌ VIDEO MISSING')
else:
    print('  note media dir missing')
ws.close()
