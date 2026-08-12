"""Semantic search UI test: type a phrase-mismatched query and check hits."""
import json
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9236'
with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
page = [p for p in pages if p.get('type') == 'page' and 'localhost' in p.get('url', '')]
if not page:
    page = [p for p in pages if p.get('type') == 'page']
ws = websocket.create_connection(page[0]['webSocketDebuggerUrl'], timeout=120)
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


# type a query with NO keyword overlap with stored titles: coding
# (notes: 英国导师手绘笔记 / 当答应不咬宠物理)
ev("""
(() => {
  const input = document.querySelector('input[type="text"], input');
  if (!input) return 'no-input';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'coding');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed';
})()
""")
print('query typed: coding')
time.sleep(4)  # allow query embedding + search

result = ev("""
(() => {
  const cards = Array.from(document.querySelectorAll('main article, main [class*="card"], main img'));
  const titles = Array.from(document.querySelectorAll('[class*="title"], [class*="Title"]'))
    .map((el) => el.textContent.trim()).filter((t) => t && t.length > 4).slice(0, 10);
  return { cardCount: cards.length, titles };
})()
""")
print('search results:', json.dumps(result, ensure_ascii=False)[:300])

# clear search
ev("""
(() => {
  const input = document.querySelector('input[type="text"], input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return 'cleared';
})()
""")
ws.close()
print('DONE')
