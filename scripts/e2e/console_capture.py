"""Capture console errors from the preview page to diagnose model loading."""
import json
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9235'
with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
page = [p for p in pages if p.get('type') == 'page'][0]
ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=300)
mid = [0]
errors = []


def send(method, params=None):
    mid[0] += 1
    ws.send(json.dumps({'id': mid[0], 'method': method, 'params': params or {}}))
    while True:
        d = json.loads(ws.recv())
        if d.get('id') == mid[0]:
            if 'error' in d:
                raise RuntimeError(d['error'])
            return d.get('result', {})


send('Runtime.enable')
# reload and capture errors for 25s
ws.send(json.dumps({'id': 99, 'method': 'Page.reload'}))
deadline = time.time() + 25
while time.time() < deadline:
    ws.settimeout(max(1, deadline - time.time()))
    try:
        d = json.loads(ws.recv())
    except Exception:
        break
    if d.get('method') in ('Runtime.exceptionThrown', 'Runtime.consoleAPICalled'):
        if d['method'] == 'Runtime.exceptionThrown':
            desc = d['params']['exceptionDetails'].get('text', '')
            errors.append('EXC: ' + desc[:200])
        else:
            args = d['params']['args']
            text = ' '.join(str(a.get('value', a.get('description', '')))[:150] for a in args)
            errors.append('CONSOLE: ' + text)
ws.close()
seen = set()
for e in errors:
    if e not in seen:
        print(e)
        seen.add(e)
print('--- total events:', len(errors))
