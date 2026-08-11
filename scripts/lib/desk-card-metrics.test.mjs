import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CARD_H,
  CARD_IMAGE_H,
  CARD_TITLE_LINES,
  CARD_W,
  EXPANDED_GRID_GAP_X,
  EXPANDED_GRID_GAP_Y,
  FOLDED_STACK_SPREAD_X,
  FOLDED_STACK_SPREAD_Y,
} from '../../app/lib/desk-card-metrics.mjs';

test('desk cards are large enough for readable titles', () => {
  assert.equal(CARD_W, 156);
  assert.equal(CARD_H, 196);
  assert.equal(CARD_IMAGE_H, 118);
  assert.equal(CARD_TITLE_LINES, 2);
});

test('expanded grid spacing grows with the larger cards', () => {
  assert.equal(EXPANDED_GRID_GAP_X, 170);
  assert.equal(EXPANDED_GRID_GAP_Y, 210);
});

test('folded stacks expose enough of the lower card area to read titles', () => {
  assert.equal(FOLDED_STACK_SPREAD_X, 0);
  assert.equal(FOLDED_STACK_SPREAD_Y, 0);
});
