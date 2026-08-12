"""Inject content.js parsing logic into the live XHS page (9222), capture
the current note from real DOM, then POST it to local-api import endpoint.
Verifies: site-drift resistance of content.js + full import pipeline."""
import json
import sys
import time
import urllib.request
import websocket

CDP = 'http://127.0.0.1:9222'
API = 'http://127.0.0.1:4318'


def get_ws_url():
    with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
        pages = json.load(r)
    for p in pages:
        if p.get('type') == 'page':
            return p['webSocketDebuggerUrl']
    raise RuntimeError('no page')


def main():
    note_url = sys.argv[1]
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

    # navigate to the note
    send('Page.navigate', {'url': note_url})
    time.sleep(12)
    print('title:', ev('document.title'))

    # load content.js source into the page (functions only; skip installButton
    # which uses chrome.runtime — we only need the capture functions)
    with open(r'D:\hermes\kankan-shoucang\browser-extension\content.js', 'r', encoding='utf-8') as f:
        source = f.read()
    # strip the chrome.runtime-dependent click handler & button install tail
    cutoff = source.index('function setButtonState')
    core = source[:cutoff]
    js = core + '\nwindow.__shoucangCapture = captureCurrentNote;'
    ev(js)

    note = ev('JSON.stringify(window.__shoucangCapture())')
    print('captured:', note[:300])
    if not note or note == 'undefined':
        print('RESULT: CAPTURE_FAILED')
        ws.close()
        return 2

    # POST to local-api
    req = urllib.request.Request(
        f'{API}/notes/import',
        data=json.dumps({'note': json.loads(note)}).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        result = json.load(r)
    print('import ok:', result.get('created'), '| title:', result.get('note', {}).get('title', '')[:40])
    print('mediaStatus:', result.get('note', {}).get('mediaStatus'), '| ocrText len:', len(result.get('note', {}).get('ocrText', '') or ''))
    print('category:', result.get('note', {}).get('category'))
    print('images:', len(result.get('note', {}).get('imageUrls', []) or []))
    ws.close()
    print('RESULT: IMPORT_DONE')
    return 0


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('usage: python inject_capture.py <note_url>')
        sys.exit(2)
    sys.exit(main())
