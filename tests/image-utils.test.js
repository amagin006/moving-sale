const test = require('node:test');
const assert = require('node:assert/strict');
const { imageCandidateUrl, clampedStep, swipeDirection, photoBadgeLabel } = require('../image-utils.js');

test('imageCandidateUrl builds path from id and sequence number', () => {
  assert.equal(imageCandidateUrl(1, 1), 'images/item-1-1.jpg');
  assert.equal(imageCandidateUrl(12, 3), 'images/item-12-3.jpg');
});

test('clampedStep stays within bounds', () => {
  assert.equal(clampedStep(0, -1, 3), 0);
  assert.equal(clampedStep(2, 1, 3), 2);
  assert.equal(clampedStep(1, 1, 3), 2);
  assert.equal(clampedStep(1, -1, 3), 0);
});

test('clampedStep returns 0 when there are no photos', () => {
  assert.equal(clampedStep(0, 1, 0), 0);
});

test('swipeDirection detects left/right swipes past threshold', () => {
  assert.equal(swipeDirection(-60), 'left');
  assert.equal(swipeDirection(60), 'right');
  assert.equal(swipeDirection(10), null);
  assert.equal(swipeDirection(-100, 150), null);
});

test('photoBadgeLabel only shows for multiple photos', () => {
  assert.equal(photoBadgeLabel(1), null);
  assert.equal(photoBadgeLabel(0), null);
  assert.equal(photoBadgeLabel(3), '📷 3');
});
