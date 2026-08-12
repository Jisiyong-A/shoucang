"""Verify: opening a note from the feed shows the extension button,
then return to explore for the user."""
import json
import time
import urllib.request
import websocket

with urllib.request.urlopen('http://127.0.0.1:9230/json/list', timeout=5) as r:
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
            if 'error' in d:
                raise RuntimeError(d['error'])
            return d.get('result', {})


def ev(expr):
    return send('Runtime.evaluate', {'expression': expr, 'returnByValue': True}).get('result', {}).get('value')


# grab a feed note link
links = ev("""
(() => {
  const anchors = Array.from(document.querySelectorAll('a[href*="/explore/"][href*="xsec_token"]'));
  return anchors.slice(0, 3).map(a => a.href);
})()
""")
print('feed links:', len(links or []))

if links:
    send('Page.navigate', {'url': links[0]})
    time.sleep(6)
    btn = ev("(() => { const b = document.getElementById('shoucang-note-import-button'); return b ? b.textContent : null; })()")
    title = ev('document.title')[:40]
    print('note page:', title)
    print('button:', btn)
    # back to explore for the user
    send('Page.navigate', {'url': 'https://www.xiaohongshu.com/explore'})
    time.sleep(3)
    print('back to explore')
else:
    print('no feed links (may need page interaction)')
ws.close()
