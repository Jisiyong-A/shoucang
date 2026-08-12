"""E2E: import a video note via the extension payload shape, verify the
video file is downloaded and served."""
import json
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9222'
API = 'http://127.0.0.1:4318'

# 1) grab the real signed video URL + note data from the open page
with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
page = [p for p in pages if p.get('type') == 'page' and 'xiaohongshu' in p.get('url', '')][0]
ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=120)
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


# run the exact extraction logic now in content.js
info = ev("""
(() => {
  const pattern = /https?:\\/\\/sns-video[a-z0-9-]*\\.xhscdn\\.com[^"'\\\\\\s)]*\\.mp4[^"'\\\\\\s)]*/g;
  const found = [];
  for (const el of document.querySelectorAll('script')) {
    if (el.textContent.includes('sns-video')) {
      const m = el.textContent.match(pattern) || [];
      found.push(...m);
    }
  }
  const tier = (url) => Number.parseInt(url.match(/_(\\d{2,4})\\.mp4/)?.[1] || '0', 10);
  const videoUrl = found.length ? found.sort((a, b) => tier(b) - tier(a))[0] : '';
  const id = location.pathname.match(/\\/(?:explore|search_result|discovery\\/item)\\/([0-9a-f]{24})/i)?.[1] || '';
  return { id, videoUrl: videoUrl.slice(0, 160), title: document.title.replace(/\\s*[-|_].*小红书.*$/i, '').slice(0, 60) };
})()
""")
print('extracted:', json.dumps(info, ensure_ascii=False)[:300])
ws.close()

if not info.get('videoUrl'):
    print('NO VIDEO URL EXTRACTED — regex still failing')
    raise SystemExit(1)

# 2) POST the extension-style payload with videoUrl
payload = json.dumps({
    'note': {
        'id': info['id'],
        'sourceUrl': f"https://www.xiaohongshu.com/explore/{info['id']}",
        'title': info['title'],
        'content': '视频测试',
        'imageUrls': [],
        'coverUrl': '',
        'videoUrl': info['videoUrl'],
        'type': 'video',
        'author': {'name': '测试', 'avatar': '', 'userId': ''},
        'tags': [],
    },
}).encode('utf-8')
req = urllib.request.Request(f'{API}/notes/import', data=payload,
                             headers={'Content-Type': 'application/json'}, method='POST')
try:
    with urllib.request.urlopen(req, timeout=180) as r:
        resp = json.load(r)
    note = resp.get('note') or {}
    print('IMPORT OK')
    print('  title:', (note.get('title') or '')[:40])
    print('  videoLocalPath:', (note.get('videoLocalPath') or '')[:80])
    print('  videoError:', note.get('videoError') or '(none)')
    print('  mediaStatus:', note.get('mediaStatus'))
except urllib.error.HTTPError as e:
    print('IMPORT FAILED:', e.code, e.read().decode('utf-8', 'replace')[:300])
except Exception as e:
    print('IMPORT ERROR:', str(e)[:200])

# 3) verify the file on disk
import os
media_dir = r'C:\Users\12155\AppData\Local\com.patrick.shoucang\media'
if info.get('id'):
    note_dir = os.path.join(media_dir, info['id'])
    if os.path.isdir(note_dir):
        files = os.listdir(note_dir)
        print('media files:', files)
        vp = os.path.join(note_dir, 'video.mp4')
        if os.path.exists(vp):
            print('VIDEO FILE:', round(os.path.getsize(vp) / 1024 / 1024, 1), 'MB')
        else:
            print('VIDEO FILE MISSING')
    else:
        print('note dir missing:', note_dir)
