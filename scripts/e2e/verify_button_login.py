"""Verify the extension button on a real XHS note page (logged-in Chrome 9222)."""
import json
import time
import urllib.request
import websocket

with urllib.request.urlopen('http://127.0.0.1:9222/json/list', timeout=5) as r:
    pages = json.load(r)
page = [p for p in pages if p.get('type') == 'page' and p.get('url', '').startswith('http') and 'chrome://' not in p.get('url', '')][0]
ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=120)
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


# go to explore and grab a feed note link
send('Page.navigate', {'url': 'https://www.xiaohongshu.com/explore'})
time.sleep(5)
links = ev("""
(() => {
  const anchors = Array.from(document.querySelectorAll('a[href*="/explore/"][href*="xsec_token"]'));
  return anchors.slice(0, 3).map(a => a.href);
})()
""")
print('feed links:', len(links or []))

if links:
    send('Page.navigate', {'url': links[0]})
    time.sleep(7)
    btn = ev("(() => { const b = document.getElementById('shoucang-note-import-button'); return b ? {text: b.textContent, title: b.title} : null; })()")
    print('note title:', ev('document.title')[:40])
    print('button:', json.dumps(btn, ensure_ascii=False))
    ws.close()
    print('RESULT:', 'BUTTON_READY' if btn else 'BUTTON_MISSING')
else:
    ws.close()
    print('RESULT: NO_FEED_LINKS')
