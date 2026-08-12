"""Edge offline test: sidecar down -> button click must show explicit error
without hanging the page. Requires sidecar RUNNING before, then we kill it."""
import json
import subprocess
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9230'

with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
ws = websocket.create_connection([p['webSocketDebuggerUrl'] for p in pages if p.get('type') == 'page' and p.get('url', '').startswith('http')][0], timeout=120)
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


# 1) kill sidecar on 4318
out = subprocess.run(['netstat', '-ano'], capture_output=True, text=True)
pids = set()
for line in out.stdout.splitlines():
    if ':4318' in line and 'LISTENING' in line:
        pids.add(line.split()[-1])
for pid in pids:
    subprocess.run(['taskkill', '/F', '/PID', pid], capture_output=True)
time.sleep(2)

# 2) click import with engine offline
print('clicking with engine OFFLINE...')
ev("(document.getElementById('shoucang-note-import-button')||{}).click()")
time.sleep(2.2)
after = ev("document.getElementById('shoucang-note-import-button')?.textContent || null")
ready = ev('document.readyState')
print('button-after:', after)
print('page readyState:', ready)

ok = 'OFFLINE' in (after or '') or '无法' in (after or '')
print('RESULT:', 'OFFLINE_ERROR_SHOWN' if ok else 'UNEXPECTED')
ws.close()
