"""CDP screenshot driver: capture SHOUCANG UI states to
docs/windows-port/screenshots/. Usage: python cdp_shot.py"""
import base64
import json
import os
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9229'
OUT = r'D:\hermes\kankan-shoucang\docs\windows-port\screenshots'
os.makedirs(OUT, exist_ok=True)


def get_ws_url():
    with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
        pages = json.load(r)
    for p in pages:
        if p.get('type') == 'page' and 'localhost:8080' in p.get('url', ''):
            return p['webSocketDebuggerUrl']
    for p in pages:
        if p.get('type') == 'page':
            return p['webSocketDebuggerUrl']
    raise RuntimeError('no page')


ws = websocket.create_connection(get_ws_url(), timeout=60)
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
    return send('Runtime.evaluate', {'expression': expr, 'returnByValue': True}).get('result', {}).get('value')


def shot(name):
    time.sleep(1.2)
    res = send('Page.captureScreenshot', {'format': 'png'})
    data = base64.b64decode(res['data'])
    path = os.path.join(OUT, name)
    with open(path, 'wb') as f:
        f.write(data)
    print('saved', name, len(data), 'bytes')


def set_search(text):
    # React controlled input: native setter + input event
    ev("""
    (() => {
      const input = document.querySelector('input[aria-label="搜索收藏"]');
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, %s);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()
    """ % json.dumps(text))


send('Page.enable')
send('Runtime.enable')

# 01 home (with 5 notes)
ev('location.reload()')
time.sleep(5)
shot('01-home.png')

# 02 search mode
set_search('咖啡')
time.sleep(2)
shot('02-search.png')
set_search('')
time.sleep(1.5)

# 03 detail
ev("document.querySelector('[role=\"button\"][aria-label*=\"手冲\"]')?.click?.() || document.querySelectorAll('[role=\"button\"]')[5]?.click?.()")
time.sleep(2)
shot('03-detail.png')
ev("document.querySelector('[aria-label=\"关闭\"]')?.click?.()")
time.sleep(1)

# 04 setup
ev("Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('SETTINGS'))?.click?.()")
time.sleep(2)
shot('04-setup.png')
ev("document.querySelector('[aria-label=\"关闭\"]')?.click?.()")
time.sleep(1)

ws.close()
print('DONE')
