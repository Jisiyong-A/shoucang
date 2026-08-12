"""Precise timing at 1000 notes: ready-to-interactive + search latency."""
import json
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9231'
with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
ws = websocket.create_connection([p['webSocketDebuggerUrl'] for p in pages if p.get('type') == 'page'][0], timeout=120)
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


send('Page.navigate', {'url': 'http://localhost:8080'})
t0 = time.time()

# wait for LOCAL ENGINE READY + NOTES 1000
ready = None
while time.time() - t0 < 30:
    text = ev('document.body.innerText') or ''
    if 'LOCAL ENGINE READY' in text and 'NOTES' in text and '1000' in text:
        ready = time.time() - t0
        break
    time.sleep(0.1)
print('ready+notes visible:', round(ready, 2) if ready else 'TIMEOUT')

# scroll test on full grid (1000 cards)
t2 = time.time()
ev("document.querySelector('main')?.scrollTo(0, 100000)")
time.sleep(0.4)
scrolled = ev("document.querySelector('main')?.scrollTop || 0")
print('scroll ok:', scrolled > 1000, 'in', round((time.time() - t2) * 1000), 'ms')

# search: wait until the grid shows exactly 1 card
ev("""
(() => {
  const input = document.querySelector('input[aria-label="搜索收藏"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '特有关键词999');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()
""")
t1 = time.time()
hit = None
while time.time() - t1 < 10:
    n = ev("document.querySelectorAll('main img').length")
    if n == 1:
        hit = time.time() - t1
        break
    time.sleep(0.05)
print('search-to-result ms:', round(hit * 1000) if hit else 'TIMEOUT')
ws.close()
