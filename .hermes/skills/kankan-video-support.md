# Video Note Support for Kankan-shoucang

## Context
XHS video notes sometimes only show cover image (01.webp) without video playback. This is a known issue with specific root causes.

## Root Causes Found

### 1. Note ID Length Mismatch
XHS note IDs are 20-26 hex chars (not fixed 24). Regex `{24}` fails for shorter IDs.

**Files to fix:**
- `browser-extension/content.js`: `getNoteId()` regex `{24}` → `{20,26}`
- `scripts/lib/note-import.mjs`: `NOTE_PATH_PATTERNS` regex `{24}` → `{20,26}` (all 3 patterns)
- `scripts/lib/note-import.mjs`: validation `/^[0-9a-f]{24}$/` → `/^[0-9a-f]{20,26}$/`
- `scripts/local-api.mjs`: `sendMediaFile()` regex `{24}` → `{20,26}`

### 2. Early Return Skips Video Download
When payload has no images (video-only notes), `media-import.mjs` previously returned early without downloading video. Fix: remove early-return, ensure video download runs for all video-type payloads.

### 3. Media Route Missing video/mp4
Add `video.mp4` to path regex and content type map in `scripts/local-api.mjs`:
```js
const mediaContentTypes = new Map([
  // ... existing image types ...
  ['.mp4', 'video/mp4'],
]);
```

### 4. Range Requests for HTML5 Video
Video playback requires `Accept-Ranges: bytes` and 206 Partial Content support for seek/scrub.
Implement streaming with `createReadStream(filePath, { start, end }).pipe(response)` in `sendMediaFile()`.

## Verification Steps
```bash
npm test  # expect 74 pass
npm run build
# Test video download:
curl -v -o /dev/null http://127.0.0.1:4318/media/<note-id>/video.mp4
# Should return 200 + Content-Type: video/mp4
# Verify with ffprobe:
ffprobe -v error -show_entries format=duration,size video.mp4
```

## Known Blockers

### Rust Linker Stack Overflow
`STATUS_STACK_BUFFER_OVERRUN` during `tauri build` release link phase:
- opt-level=2: rustc crashes with stack overflow
- opt-level=0: times out (600s)

**Workaround**: Use opt-level=1 if available, or update rust toolchain. Current build requires environment fix.

### Stale Extensions
Chrome unpacked extensions don't hot-reload. Must re-load at `chrome://extensions`:
1. Navigate to `chrome://extensions`
2. Find 收藏 extension
3. Click "重新加载" button
4. Re-navigate to XHS page

## Debugging Checklist
- [ ] Check note ID length in feed URL (may differ from stored ID)
- [ ] Verify video URL appears in page scripts (`sns-video-v2.xhscdn.com/_NNN.mp4?sign=`)
- [ ] Check `videoLocalPath` in notes.json is non-empty
- [ ] Confirm file exists at `%LOCALAPPDATA%\com.patrick.shoucang\media\<id>\video.mp4`
- [ ] Test media route: `curl -I http://127.0.0.1:4318/media/<id>/video.mp4`
- [ ] Check extension is reloaded (button appears on note pages)
