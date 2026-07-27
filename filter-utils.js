(function (root) {
  function collectTags(items) {
    const tags = [];
    let hasEmpty = false;
    items.forEach(item => {
      const category = item['カテゴリ'];
      if (!category) {
        hasEmpty = true;
        return;
      }
      if (!tags.includes(category)) tags.push(category);
    });
    if (hasEmpty) tags.push('その他');
    return tags;
  }

  function filterItems(items, tag) {
    if (tag === 'all') return items;
    if (tag === 'その他') return items.filter(item => !item['カテゴリ']);
    return items.filter(item => item['カテゴリ'] === tag);
  }

  const FilterUtils = { collectTags, filterItems };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FilterUtils;
  } else {
    root.FilterUtils = FilterUtils;
  }
})(typeof window !== 'undefined' ? window : globalThis);
