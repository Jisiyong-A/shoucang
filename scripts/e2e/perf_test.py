"""Task 08 §5/§6: synthetic archive perf — startup, search latency,
grid render at 100/500/1000 notes. Uses local-api + preview CDP."""
import json
import random
import time
import urllib.request
import websocket

API = 'http://127.0.0.1:4318'
CDP = 'http://127.0.0.1:9231'
DATA = r'C:\Users\12155\AppData\Local\com.patrick.shoucang'

WORDS = ['极简', '咖啡', '收纳', '苔藓', '书桌', '灯光', '水温', '粉水比', '庭院', '早餐',
         '摄影', '旅行', '穿搭', '护肤', '健身', '阅读', '编程', '音乐', '电影', '园艺']
CATS = ['空间美学', '咖啡科学', 'AI工具', '植物', '美食餐饮', '旅行户外', '生活方式']


def seed(count):
    notes = []
    for i in range(count):
        notes.append({
            'id': f'64cb1234000000000{i:010d}',
            'title': f'合成笔记 {i} · {random.choice(WORDS)}',
            'rawContent': f'第 {i} 篇正文内容，包含关键词 {random.choice(WORDS)} 和 {random.choice(WORDS)}。',
            'ocrText': f'图内文字 {random.choice(WORDS)} 特有关键词{i}',
            'author': {'name': f'作者{i % 50}'},
            'likes': i * 7, 'collects': i, 'comments': i % 90,
            'category': random.choice(CATS),
            'savedAt': f'2026-08-{(i % 12) + 1:02d}T10:00:00.000Z',
            'tags': [random.choice(WORDS)],
            'mediaStatus': 'ready',
            'coverUrl': f'https://picsum.photos/seed/n{i}/600/450',
        })
    with open(DATA + r'\notes.json', 'w', encoding='utf-8') as f:
        json.dump(notes, f, ensure_ascii=False)
    return len(notes)


def measure(count):
    n = seed(count)
    # restart sidecar so /notes reads fresh
    import subprocess
    out = subprocess.run(['netstat', '-ano'], capture_output=True, text=True)
    pids = set()
    for line in out.stdout.splitlines():
        if ':4318' in line and 'LISTENING' in line:
            pids.add(line.split()[-1])
    for pid in pids:
        subprocess.run(['taskkill', '/F', '/PID', pid], capture_output=True)
    time.sleep(1.5)
    subprocess.Popen(['node', r'D:\hermes\kankan-shoucang\scripts\local-api.mjs'],
                     cwd=r'D:\hermes\kankan-shoucang', creationflags=0x08000000)
    time.sleep(4)

    with urllib.request.urlopen(f'{CDP}/json/list', timeout=5) as r:
        pages = json.load(r)
    ws = websocket.create_connection([p['webSocketDebuggerUrl'] for p in pages if p.get('type') == 'page'][0], timeout=120)
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

    send('Page.navigate', {'url': 'http://localhost:8080'})
    t0 = time.time()
    time.sleep(3)
    first_notes = ev("document.body.innerText.includes('LOCAL ENGINE READY')")
    t_ready = time.time() - t0
    # wait until cards rendered
    cards = 0
    for _ in range(20):
        cards = ev("document.querySelectorAll('[role=\"button\"][aria-label*=\"笔记\"]').length || document.querySelectorAll('main img').length")
        if cards >= min(count, 24):
            break
        time.sleep(0.5)
    t_render = time.time() - t0

    # search latency: unique OCR word
    q = f'特有关键词{n - 1}'
    ts = time.time()
    ev(f"""
    (() => {{
      const input = document.querySelector('input[aria-label="搜索收藏"]');
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '{q}');
      input.dispatchEvent(new Event('input', {{ bubbles: true }}));
      return true;
    }})()
    """)
    time.sleep(1.2)
    hits = ev("document.body.innerText.match(/SEARCHING[^\\n]*/) || ['']")[0]
    t_search = time.time() - ts
    ws.close()
    return {'notes': n, 'ready_s': round(t_ready, 2), 'render_s': round(t_render, 2),
            'search_ms': round(t_search * 1000), 'cards_rendered': cards, 'search_state': hits}


for count in (100, 500, 1000):
    r = measure(count)
    print(json.dumps(r, ensure_ascii=False))
