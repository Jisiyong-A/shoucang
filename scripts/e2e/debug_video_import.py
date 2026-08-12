"""Find which note we imported last and check if the videoLocalPath 
matches the file on disk."""
import json
import os

notes_path = r'C:\Users\12155\AppData\Local\com.patrick.shoucang\notes.json'
media_root = r'C:\Users\12155\AppData\Local\com.patrick.shoucang\media'

with open(notes_path, encoding='utf-8') as f:
    data = json.load(f)

print(f"Total notes: {len(data['notes'])}")
print()

# Find notes with videoLocalPath
video_notes = [n for n in data['notes'] if n.get('videoLocalPath')]
print(f"Notes with videoLocalPath: {len(video_notes)}")

for n in video_notes:
    nid = n['id']
    vlp = n.get('videoLocalPath', '')
    expected_dir = os.path.join(media_root, nid)
    expected_video = os.path.join(expected_dir, 'video.mp4')
    
    dir_exists = os.path.exists(expected_dir)
    video_exists = os.path.exists(expected_video)
    actual_dir_name = os.path.basename(expected_dir)
    
    print(f"Note: {nid}")
    print(f"  Title: {n.get('title', '(no title)')[:40]}")
    print(f"  videoLocalPath: {vlp[:70]}")
    print(f"  File dir exists: {dir_exists}")
    print(f"  video.mp4 exists: {video_exists}")
    
    # Check what dirs actually exist
    if os.path.isdir(media_root):
        actual_dirs = sorted([d for d in os.listdir(media_root) if d.startswith(nid[:6])])
        print(f"  Actual dirs matching prefix: {actual_dirs[:5]}")
    print()
