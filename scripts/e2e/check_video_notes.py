"""Check all video notes and their local paths vs on-disk files."""
import json
import os
import urllib.request

with urllib.request.urlopen('http://127.0.0.1:4318/notes', timeout=10) as r:
    data = json.load(r)

# Discover actual data dir from notes' media
notes = data['notes']
media_root = os.path.join(os.environ.get('LOCALAPPDATA', r'C:\Users\12155\AppData\Local'), 'com.patrick.shoucang', 'media')

print(f'Total notes: {len(notes)}')
for n in notes:
    nid = n['id']
    vlp = n.get('videoLocalPath') or ''
    f = os.path.join(media_root, nid, 'video.mp4')
    has = os.path.exists(f)
    kind = n.get('type', 'note')
    has_imgs = sum(1 for x in os.listdir(os.path.join(media_root, nid)) if x.endswith(('.webp', '.png', '.jpg', '.avif'))) if os.path.isdir(os.path.join(media_root, nid)) else 0
    if kind == 'video' or vlp or has:
        print(f'VIDEO note: {nid} | title={(n.get("title") or "")[:25]} | vlp={"Y" if vlp else "N"} | file={has} | imgs={has_imgs}')
    else:
        print(f'      note: {nid} | title={(n.get("title") or "")[:25]} | imgs={has_imgs}')