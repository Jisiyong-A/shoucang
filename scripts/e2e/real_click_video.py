"""Full real-user path: open a video note from feed, click the extension
button, verify the import downloads the video."""
import json
import time
import urllib.request
import urllib.error
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
            if 'error' in d:
                raise RuntimeError(d['error'])
            return d.get('result', {})


def ev(expr):
    return send('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True}).get('result', {}).get('value')


# 1) feed -> grab a video note link with token
send('Page.navigate', {'url': 'https://www.xiaohongshu.com/explore'})
time.sleep(7)
links = ev("""
(() => {
  const anchors = Array.from(document.querySelectorAll('a[href*="/explore/"][href*="xsec_token"]'));
  const withVideo = anchors.filter((a) => {
    const card = a.closest('section') || a.parentElement?.parentElement;
    return card && (card.querySelector('video, [class*="video"], [class*="play"]') || /video/i.test(card.className));
  });
  const pool = withVideo.length ? withVideo : anchors;
  return pool.slice(0, 6).map((a) => a.href);
})()
""")
print('candidate links:', len(links or []))
if not links:
    print('no links')
    ws.close()
    raise SystemExit(1)

# 2) open first candidate and look for the extension button
for link in links:
    send('Page.navigate', {'url': link})
    time.sleep(8)
    title = ev('document.title')[:50]
    hasBtn = ev("Boolean(document.getElementById('shoucang-note-import-button'))")
    is404 = ev("/你访问的页面不见了/.test(document.body.innerText)")
    print(f'  {link[:60]}... title="{title}" btn={hasBtn} 404={is404}')
    if hasBtn and not is404:
        break

if not ev("Boolean(document.getElementById('shoucang-note-import-button'))"):
    print('NO BUTTON on any candidate — extension not loaded in this Chrome')
    ws.close()
    raise SystemExit(1)

# 3) REAL click the button (extension captures + imports)
clicked = ev("""
(() => {
  const btn = document.getElementById('shoucang-note-import-button');
  btn.click();
  return { clicked: true, text: btn.textContent.trim().slice(0, 20) };
})()
""")
print('clicked:', clicked)
time.sleep(20)  # import pipeline: resolve/media/ocr

# 4) verify: notes.json has the new note with videoLocalPath
with urllib.request.urlopen(f'{API}/notes', timeout=10) as r:
    notes = json.load(r)['notes']
newest = notes[0]
print('newest note:', (newest.get('title') or '')[:40])
print('  videoLocalPath:', (newest.get('videoLocalPath') or '(empty)')[:70])
print('  videoError:', newest.get('videoError') or '(none)')
print('  mediaStatus:', newest.get('mediaStatus'))
print('  type:', newest.get('type'))

# 5) media dir check
import os
media_root = r'C:\Users\12155\AppData\Local\com.patrick.shoucang\media'
ndir = os.path.join(media_root, newest['id'])
if os.path.isdir(ndir):
    files = os.listdir(ndir)
    print('  media files:', files)
    vp = os.path.join(ndir, 'video.mp4')
    if os.path.exists(vp):
        print(f'  VIDEO DOWNLOADED: {os.path.getsize(vp)/1024/1024:.1f} MB')
    else:
        print('  VIDEO MISSING — only:', files)
ws.close()
