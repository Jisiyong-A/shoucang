"""Task 08 §10: capture AGENT CONNECTED / IMPORTING / ERROR states."""
import base64
import json
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9231'
OUT = r'D:\hermes\kankan-shoucang\docs\windows-port\screenshots'

with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
ws = websocket.create_connection([p['webSocketDebuggerUrl'] for p in pages if p.get('type') == 'page'][0], timeout=180)
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
    time.sleep(1.5)
    res = send('Page.captureScreenshot', {'format': 'png'})
    data = base64.b64decode(res['data'])
    with open(f'{OUT}\\{name}', 'wb') as f:
        f.write(data)
    print('saved', name, len(data))


# 1) AGENT CONNECTED: open SETTINGS (hermes is registered -> CONNECTED)
ev("Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('SETTINGS'))?.click()")
time.sleep(2.5)
shot('07-agent-connected.png')
ev("document.querySelector('[aria-label=\"关闭\"]')?.click()")
time.sleep(1)

# 2) IMPORTING: paste-link import with a real resolvable URL
ev("Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('IMPORT'))?.click()")
time.sleep(0.8)
ev("""
(() => {
  const input = document.querySelector('input[aria-label="笔记链接"]');
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'https://www.xiaohongshu.com/explore/6a7acd410000000022013d61?xsec_token=ABrYcxjla_hOzPc5V-0IA-oVbWe45oNQdQKXiSh2UM89A=&xsec_source=');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()
""")
time.sleep(0.6)
ev("Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('导入'))?.click()")
time.sleep(2.2)
shot('08-importing.png')

# wait for import to finish, then 3) ERROR: bad URL
time.sleep(20)
ev("Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('IMPORT'))?.click()")
time.sleep(0.8)
ev("""
(() => {
  const input = document.querySelector('input[aria-label="笔记链接"]');
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'https://www.xiaohongshu.com/explore/000000000000000000000000');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()
""")
time.sleep(0.6)
ev("Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('导入'))?.click()")
time.sleep(4)
shot('09-error.png')

ws.close()
print('DONE')
