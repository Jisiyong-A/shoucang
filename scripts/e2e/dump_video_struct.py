"""Find a video note in the user's logged-in Chrome and dump its video
object structure from __INITIAL_STATE__."""
import json
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9222'
with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
page = [p for p in pages if p.get('type') == 'page' and 'xiaohongshu' in p.get('url', '')]
if not page:
    print('no XHS page')
    raise SystemExit(1)
ws = websocket.create_connection(page[0]['webSocketDebuggerUrl'], timeout=120)
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


# go to explore, grab a VIDEO note link (cards with video icon/type)
send('Page.navigate', {'url': 'https://www.xiaohongshu.com/explore'})
time.sleep(6)
links = ev("""
(() => {
  const anchors = Array.from(document.querySelectorAll('a[href*="/explore/"][href*="xsec_token"]'));
  const withVideo = anchors.filter((a) => {
    const card = a.closest('section') || a.parentElement;
    return card && (card.querySelector('video, [class*="video"], [class*="play"], [class*="player"]') || /视频/.test(card.className));
  });
  const pool = withVideo.length ? withVideo : anchors;
  return pool.slice(0, 5).map((a) => a.href);
})()
""")
print('candidate links:', len(links or []))
if not links:
    ws.close()
    raise SystemExit(1)

# open first candidate
send('Page.navigate', {'url': links[0]})
time.sleep(7)
print('page:', ev('document.title')[:50])

# dump the note's video object structure
dump = ev("""
(() => {
  const marker = 'window.__INITIAL_STATE__=';
  const script = Array.from(document.querySelectorAll('script')).find((el) => el.textContent.includes(marker));
  if (!script) return { error: 'no state' };
  try {
    const start = script.textContent.indexOf(marker) + marker.length;
    const end = script.textContent.indexOf('</script>', start);
    const serialized = script.textContent.slice(start, end === -1 ? undefined : end).trim().replace(/;$/, '').replace(/\\bundefined\\b/g, 'null');
    const state = JSON.parse(serialized);
    const id = location.pathname.match(/\\/(?:explore|search_result|discovery\\/item)\\/([0-9a-f]{24})/i)?.[1];
    const note = state?.note?.noteDetailMap?.[id]?.note || {};
    const v = note?.video || {};
    const keys = Object.keys(v);
    const mediaKeys = v?.media ? Object.keys(v.media) : [];
    const videoKeys = v?.media?.video ? Object.keys(v.media.video) : [];
    const h264 = v?.media?.video?.h264;
    const h264First = Array.isArray(h264) && h264[0] ? { masterUrl: (h264[0].masterUrl || '').slice(0, 80), backupUrls: (h264[0].backupUrls || []).length } : null;
    const streamKeys = v?.media?.stream ? Object.keys(v.media.stream) : [];
    return {
      id,
      noteType: note?.type,
      videoKeys: keys,
      vUrl: (v?.url || '').slice(0, 80),
      mediaKeys,
      videoKeys2: videoKeys,
      h264First,
      streamKeys,
      cover: (v?.cover || '').slice(0, 60),
      firstFrame: (v?.firstFrame || '').slice(0, 60),
    };
  } catch (e) {
    return { error: String(e).slice(0, 120) };
  }
})()
""")
print('video structure:', json.dumps(dump, ensure_ascii=False)[:600])
ws.close()
