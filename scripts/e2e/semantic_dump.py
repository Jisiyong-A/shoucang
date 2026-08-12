"""Type a query and dump visible card titles from the grid."""
import json
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9236'
query = '代码'
with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
page = [p for p in pages if p.get('type') == 'page' and 'localhost' in p.get('url', '')][0]
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


ev("""
(() => {
  const input = document.querySelector('input[type="text"], input');
  if (!input) return 'no-input';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '%s');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed';
})()
""" % query)
time.sleep(5)
result = ev("""
(() => {
  // collect card title candidates: img alt + visible text blocks
  const alts = Array.from(document.querySelectorAll('main img, [class*="grid"] img, [class*="card"] img'))
    .map((img) => img.alt || img.title || '')
    .filter((t) => t.length > 4);
  const texts = Array.from(document.querySelectorAll('[class*="title"], [class*="Title"], [class*="name"]'))
    .map((el) => el.textContent.trim())
    .filter((t) => t.length > 6 && t.length < 80);
  return { alts: alts.slice(0, 8), texts: texts.slice(0, 8) };
})()
""")
print('query:', query)
print(json.dumps(result, ensure_ascii=False)[:400])
ws.close()
