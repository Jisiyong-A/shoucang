"""Edge E2E: extension button click-import + offline behavior.
Usage: python edge_e2e.py <note_url_with_token>"""
import json
import sys
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9230'
API = 'http://127.0.0.1:4318'


def get_ws_url():
    with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
        pages = json.load(r)
    for p in pages:
        if p.get('type') == 'page' and p.get('url', '').startswith(('http', 'about:')):
            return p['webSocketDebuggerUrl']
    raise RuntimeError('no page')


def main(note_url):
    ws = websocket.create_connection(get_ws_url(), timeout=180)
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

    print('navigating...')
    send('Page.enable')
    send('Page.navigate', {'url': note_url})
    time.sleep(12)
    print('title:', ev('document.title'))
    btn = ev("document.getElementById('shoucang-note-import-button')?.textContent || null")
    print('button:', btn)
    if not btn:
        print('RESULT: BUTTON_NOT_FOUND')
        ws.close()
        return 2

    # click import
    print('clicking import...')
    ev("(document.getElementById('shoucang-note-import-button')||{}).click()")
    time.sleep(18)
    after = ev("document.getElementById('shoucang-note-import-button')?.textContent || null")
    print('button-after:', after)
    with urllib.request.urlopen(f'{API}/notes', timeout=10) as r:
        notes = json.load(r).get('notes', [])
    print('notes in archive:', len(notes))
    if len(notes) > 0:
        print('latest:', notes[-1].get('title', '')[:40], '| mediaStatus:', notes[-1].get('mediaStatus'))
    ws.close()
    print('RESULT: CLICK_IMPORT_DONE' if len(notes) > 0 else 'RESULT: NO_NOTE_IMPORTED')
    return 0 if len(notes) > 0 else 3


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('usage: python edge_e2e.py <note_url>')
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
