"""Capture empty + offline states. Requires: sidecar running for empty shot.
Usage: python cdp_shot2.py"""
import base64
import json
import os
import subprocess
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9229'
OUT = r'D:\hermes\kankan-shoucang\docs\windows-port\screenshots'
NOTES = r'C:\Users\12155\AppData\Local\com.patrick.shoucang\notes.json'
NOTES_BAK = NOTES + '.bak'

with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
    pages = json.load(r)
ws = websocket.create_connection([p['webSocketDebuggerUrl'] for p in pages if p.get('type') == 'page'][0], timeout=60)
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
    time.sleep(2)
    res = send('Page.captureScreenshot', {'format': 'png'})
    data = base64.b64decode(res['data'])
    with open(os.path.join(OUT, name), 'wb') as f:
        f.write(data)
    print('saved', name, len(data), 'bytes')


send('Page.enable')

# 05 empty: hide notes.json, reload
if os.path.exists(NOTES):
    os.rename(NOTES, NOTES_BAK)
ev('location.reload()')
time.sleep(4)
shot('05-empty.png')
if os.path.exists(NOTES_BAK):
    os.rename(NOTES_BAK, NOTES)

# 06 offline: kill sidecar on 4318, reload
out = subprocess.run(['netstat', '-ano'], capture_output=True, text=True)
pids = set()
for line in out.stdout.splitlines():
    if ':4318' in line and 'LISTENING' in line:
        pids.add(line.split()[-1])
for pid in pids:
    subprocess.run(['taskkill', '/F', '/PID', pid], capture_output=True)
time.sleep(1)
ev('location.reload()')
time.sleep(4)
shot('06-offline.png')

ws.close()
print('DONE')
