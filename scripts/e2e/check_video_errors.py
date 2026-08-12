"""Inspect videoError for missing-video notes."""
import json
import os
import urllib.request

with urllib.request.urlopen('http://127.0.0.1:4318/notes', timeout=10) as r:
    data = json.load(r)

media = os.path.join(os.environ.get('LOCALAPPDATA', r'C:\Users\12155\AppData\Local'), 'com.patrick.shoucang', 'media')
for n in data['notes']:
    nid = n['id']
    has_file = os.path.exists(os.path.join(media, nid, 'video.mp4'))
    print(f'--- {nid} | title={(n.get("title") or "")[:22]} | videoOnDisk={has_file}')
    print(f'   videoLocalPath={n.get("videoLocalPath") or ""}')
    print(f'   videoError={n.get("videoError") or ""}')
    print(f'   mediaStatus={n.get("mediaStatus") or ""}')
    print(f'   sourceUrl={n.get("sourceUrl") or ""}')