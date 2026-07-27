const test = require('node:test');
const assert = require('node:assert/strict');
const { collectTags, filterItems } = require('../filter-utils.js');

test('collectTags returns tags in first-appearance order without duplicates', () => {
  const items = [
    { 'カテゴリ': '家具' },
    { 'カテゴリ': '家電' },
    { 'カテゴリ': '家具' },
  ];
  assert.deepEqual(collectTags(items), ['家具', '家電']);
});

test('collectTags appends その他 when some items have no category', () => {
  const items = [
    { 'カテゴリ': '家具' },
    { 'カテゴリ': '' },
    { 'カテゴリ': null },
  ];
  assert.deepEqual(collectTags(items), ['家具', 'その他']);
});

test('collectTags omits その他 when every item has a category', () => {
  const items = [{ 'カテゴリ': '家具' }, { 'カテゴリ': '家電' }];
  assert.deepEqual(collectTags(items), ['家具', '家電']);
});

test('collectTags returns empty array for empty input', () => {
  assert.deepEqual(collectTags([]), []);
});

test('filterItems returns all items unchanged when tag is all', () => {
  const items = [{ 'カテゴリ': '家具' }, { 'カテゴリ': '家電' }];
  assert.deepEqual(filterItems(items, 'all'), items);
});

test('filterItems matches items by exact category', () => {
  const items = [
    { id: 1, 'カテゴリ': '家具' },
    { id: 2, 'カテゴリ': '家電' },
  ];
  assert.deepEqual(filterItems(items, '家電'), [{ id: 2, 'カテゴリ': '家電' }]);
});

test('filterItems returns items with empty category when tag is その他', () => {
  const items = [
    { id: 1, 'カテゴリ': '家具' },
    { id: 2, 'カテゴリ': '' },
    { id: 3, 'カテゴリ': null },
  ];
  assert.deepEqual(filterItems(items, 'その他'), [
    { id: 2, 'カテゴリ': '' },
    { id: 3, 'カテゴリ': null },
  ]);
});
