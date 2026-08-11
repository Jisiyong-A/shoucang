import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldUseLightweightCanvas } from '../../app/lib/desk-performance.mjs';

test('keeps full motion for small note sets', () => {
  assert.equal(shouldUseLightweightCanvas(24), false);
});

test('switches to lightweight canvas for large note sets', () => {
  assert.equal(shouldUseLightweightCanvas(80), true);
});
