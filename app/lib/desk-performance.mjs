const LIGHTWEIGHT_CANVAS_THRESHOLD = 60;

export function shouldUseLightweightCanvas(noteCount) {
  return Number(noteCount) >= LIGHTWEIGHT_CANVAS_THRESHOLD;
}
