"""Debug: what does the CDP page show for a missing-video note?"""
import json
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9222'

with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)

print('=== All pages ===')
for p in pages:
    if p.get('type') == 'page':
        print(f"  {p['id'][:8]} | {p.get('url', '')[:80]} | title={p.get('title', '')[:30]}")

# Pick the xiaohongshu page
xh = [p for p in pages if p.get('type') == 'page' and 'xiaohongshu' in p.get('url', '')]
if not xh:
    print('\nNo xiaohongshu page found!')
    raise SystemExit(1)

page = xh[0]
ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=60)
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

# Navigate to the missing video note
nid = '6a7c87820000000008012a03'
url = f'https://www.xiaohongshu.com/explore/{nid}'
print(f'\nNavigating to: {url}')
send('Page.navigate', {'url': url})
time.sleep(10)

print('\n=== Current state ===')
print('URL:', ev('location.href')[:80])
print('Title:', ev('document.title')[:50])
print('Has import button:', ev("Boolean(document.getElementById('shoucang-note-import-button'))"))
print('Has video element:', ev("Boolean(document.querySelector('video'))"))
print('Has video source:', ev("(document.querySelector('video') || {}).src || ''")[:80])
print('Button count any:', ev("document.querySelectorAll('[class*=\"shoucang\"], [id*=\"shoucang\"]').length"))
print('Body length:', ev('document.body ? document.body.innerText.slice(0, 300) : "no body"'))

# Try to find what the button should be
scripts = ev("Array.from(document.querySelectorAll('script')).map(s => s.src).filter(Boolean)")
print('\nScripts:', scripts[:5] if scripts else 'none')

# Check if extension is active via chrome.tabs
ext_active = ev("typeof chrome !== 'undefined' && !!chrome.runtime?.id")
print('Extension runtime active:', ext_active)

ws.close()