"""Verify the regex video extraction on the real video note page."""
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


print('page:', ev('document.title')[:50])
result = ev("""
(() => {
  const marker = 'window.__INITIAL_STATE__=';
  const script = Array.from(document.querySelectorAll('script')).find((el) => el.textContent.includes(marker));
  if (!script) return { error: 'no state script' };
  const text = script.textContent;
  const candidates = text.match(/https?:\\/\\/sns-video-qc\\.xhscdn\\.com[^"'\\\\\\s)]+/g) || [];
  const best = candidates.sort((a, b) => b.length - a.length)[0] || '';
  const master = text.match(/"(?:masterUrl|url)":\\s*"(https?:[^"]+)"/);
  return {
    videoCdnMatches: candidates.length,
    bestUrl: best.slice(0, 120),
    hasUrlParam: /[?&]/.test(best),
  };
})()
""")
print(json.dumps(result, ensure_ascii=False)[:400])
ws.close()
