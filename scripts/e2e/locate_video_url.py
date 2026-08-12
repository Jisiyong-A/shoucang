"""Check where the video mp4 URL lives in the page (state script vs runtime)."""
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


def send(method, params=None):
    mid[0] += 1
    ws.send(json.dumps({'id': mid[0], 'method': method, 'params': params or {}}))
    while True:
        d = json.loads(ws.recv())
        if d.get('id') == mid[0]:
            return d.get('result', {})


def ev(expr):
    return send('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True}).get('result', {}).get('value')


# 1) state script scan
state = ev("""
(() => {
  const marker = 'window.__INITIAL_STATE__=';
  const script = Array.from(document.querySelectorAll('script')).find((el) => el.textContent.includes(marker));
  if (!script) return { error: 'no state' };
  const text = script.textContent;
  const mp4 = text.match(/https?:\\/\\/sns-video[^"'\\\\\\s)]*\\.mp4[^"'\\\\\\s)]*/g) || [];
  const v2 = text.match(/https?:\\/\\/sns-video-v2[^"'\\\\\\s)]+/g) || [];
  return { mp4InState: mp4.slice(0, 2), v2Urls: v2.slice(0, 3) };
})()
""")
print('STATE scan:', json.dumps(state, ensure_ascii=False)[:400])

# 2) other scripts on the page
other = ev("""
(() => {
  const found = [];
  for (const el of document.querySelectorAll('script')) {
    const t = el.textContent;
    const m = t.match(/https?:\\/\\/sns-video[^"'\\\\\\s)]*\\.mp4[^"'\\\\\\s)]*/g);
    if (m) found.push(...m.slice(0, 2));
  }
  return found;
})()
""")
print('OTHER scripts mp4:', json.dumps(other, ensure_ascii=False)[:300])
ws.close()
