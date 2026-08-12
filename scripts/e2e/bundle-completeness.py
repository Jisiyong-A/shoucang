#!/usr/bin/env python3
"""Verify every relative import among bundled scripts is present in the
tauri.conf.json resources map (bundle completeness guard)."""
import json
import os
import posixpath
import re

REPO = r'D:\hermes\kankan-shoucang'
ROOT = os.path.join(REPO, 'scripts')

with open(os.path.join(REPO, 'src-tauri', 'tauri.conf.json'), encoding='utf-8') as f:
    conf = json.load(f)

resources = conf['bundle']['resources']
# key: "../scripts/<rel>" -> bundled name
entries = {}
for key, value in resources.items():
    if key.startswith('../scripts/'):
        entries[key[len('../scripts/'):]] = value

missing = []
for rel in entries:
    full = os.path.join(ROOT, rel)
    if not os.path.exists(full):
        missing.append(f'RESOURCE MISSING ON DISK: {rel}')
        continue
    with open(full, encoding='utf-8', errors='replace') as f:
        src = f.read()
    # strip comments so doc examples don't produce false gaps
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.DOTALL)
    src = re.sub(r'//[^\n]*', '', src)
    for m in re.finditer(r"from\s+['\"](\.[^'\"]+)['\"]", src):
        imp = m.group(1)
        resolved = posixpath.normpath(posixpath.join(posixpath.dirname(rel.replace(os.sep, '/')), imp))
        if resolved == rel.replace(os.sep, '/') or resolved.startswith('..'):
            # self-import (doc examples) or genuinely out-of-tree
            if resolved != rel.replace(os.sep, '/'):
                missing.append(f'{rel} -> OUT-OF-TREE import {imp}')
            continue
        if resolved not in entries:
            missing.append(f'{rel} -> {imp} NOT IN RESOURCES')

if missing:
    print('BUNDLE GAPS:')
    for line in missing:
        print(' -', line)
    raise SystemExit(1)
print(f'bundle completeness OK ({len(entries)} script resources, all imports covered)')
