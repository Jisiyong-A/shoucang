"""Find which note has videoLocalPath and check disk state."""
import json
import os

notes_path = r'C:\Users\12155\AppData\Local\com.patrick.shoucang\notes.json'
media_root = r'C:\Users\12155\AppData\Local\com.patrick.shoucang\media'

with open(notes_path, encoding='utf-8') as f:
    notes = json.load(f)

print(f"Total notes: {len(notes)}")
print()

for n in notes[:5]:
    nid = n.get('id', '')
    vlp = n.get('videoLocalPath', '')
    title = n.get('title', '(no title)')[:40]
    
    # Check if file exists
    expected_video = os.path.join(media_root, nid, 'video.mp4')
    dir_exists = os.path.exists(os.path.dirname(expected_video))
    video_exists = os.path.exists(expected_video)
    
    status = "OK" if video_exists else "MISSING"
    print(f"{nid} | {title} | videoPath={status}")
    if vlp and not video_exists:
        print(f"  ! NOTE has videoPath but file missing")
        print(f"  Expected: {expected_video}")
        print(f"  Video URL: {vlp[:70]}")
