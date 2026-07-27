# カテゴリタグ フィルター機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** カード下部に表示している「カテゴリ」タグを使って、一覧の商品をトップのボタンで絞り込めるようにする。

**Architecture:** カテゴリの抽出・絞り込みロジックは`image-utils.js`と同じUMDパターンで新規`filter-utils.js`に切り出し、`node:test`でユニットテストする。DOM描画・イベント配線は既存パターンに合わせて`app.js`に直接書く（`cardHtml`同様、ここは自動テスト対象外）。

**Tech Stack:** Vanilla JS（ビルドツールなし）、`node:test` + `node:assert/strict`（`tests/`配下）。

## Global Constraints

- 単一タグ選択のみ（複数選択・URL状態保存は行わない）— 仕様書「スコープ外」節より。
- タグの表示順は初出順固定（並び替えUIなし）— 仕様書「スコープ外」節より。
- 新規モジュールは`image-utils.js`と同じUMDパターン（`module.exports` / `window`両対応）にする — 既存コードとの一貫性のため。

---

### Task 1: `filter-utils.js` — タグ抽出・絞り込みロジック

**Files:**
- Create: `filter-utils.js`
- Create: `tests/filter-utils.test.js`

**Interfaces:**
- Consumes: なし（純粋関数、DOM非依存）
- Produces:
  - `FilterUtils.collectTags(items)` — `items`は`{'カテゴリ': string|null}`形状のオブジェクト配列。初出順・重複なしのタグ配列を返す。空カテゴリの商品が1件でもあれば末尾に`'その他'`を追加。
  - `FilterUtils.filterItems(items, tag)` — `tag`が`'all'`なら`items`をそのまま返す。`'その他'`ならカテゴリが空（`null`/`undefined`/`''`）の商品のみ。それ以外は`item['カテゴリ'] === tag`の商品のみ。

- [ ] **Step 1: Write the failing tests**

Create `tests/filter-utils.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/filter-utils.test.js`
Expected: FAIL with `Cannot find module '../filter-utils.js'`

- [ ] **Step 3: Write the implementation**

Create `filter-utils.js`:

```javascript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/filter-utils.test.js`
Expected: PASS, 7 tests passing, 0 failing

- [ ] **Step 5: Commit**

```bash
git add filter-utils.js tests/filter-utils.test.js
git commit -m "$(cat <<'EOF'
Add filter-utils with tag extraction and item filtering

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: フィルターバーの構造とスタイルを追加

**Files:**
- Modify: `index.html:14-15` (`<main>`の直前に`filter-bar`を追加)
- Modify: `style.css` (末尾にフィルターバー用スタイルを追加)

**Interfaces:**
- Consumes: なし
- Produces: `#filter-bar`要素（空のコンテナ、中身はTask 3で`app.js`から描画される）。`.filter-btn` / `.filter-btn.active`クラス。

- [ ] **Step 1: `index.html`に`filter-bar`コンテナを追加**

`index.html`の現在の該当箇所:

```html
  <main>
    <div id="grid"></div>
  </main>
```

これを以下に変更:

```html
  <div id="filter-bar"></div>
  <main>
    <div id="grid"></div>
  </main>
```

- [ ] **Step 2: `style.css`にフィルターバーのスタイルを追加**

`style.css`の`#grid`ルール（6-11行目付近、`.tag`ルールの前でも後でも可）の後に追記:

```css
#filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 1.5rem 0;
}

.filter-btn {
  display: inline-block;
  background: #ecf0f1;
  color: #666;
  font-size: 0.85rem;
  padding: 5px 14px;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.filter-btn:hover {
  background: #dfe4e6;
}
.filter-btn.active {
  background: #2c3e50;
  color: white;
}
```

`@media (max-width: 480px)`ブロック（ファイル末尾）に追記してモバイル時の左右余白を`#grid`と揃える:

```css
  #filter-bar {
    padding: 0.75rem 1rem 0;
  }
```

- [ ] **Step 3: ブラウザで見た目を確認**

`index.html`をブラウザで開く（または簡易サーバーで配信）。この時点では`#filter-bar`は空のままなので、レイアウト崩れ（余計な余白やスクロールバー）が出ていないことだけを目視確認する。ボタンの表示確認はTask 3完了後に行う。

- [ ] **Step 4: Commit**

```bash
git add index.html style.css
git commit -m "$(cat <<'EOF'
Add filter bar container and styles

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `app.js` — フィルターバーの描画と絞り込み配線

**Files:**
- Modify: `index.html:44-46`（`filter-utils.js`の`<script>`タグ追加）
- Modify: `app.js`（状態変数・描画関数・イベント配線を追加、既存の一覧描画ロジックを置き換え）

**Interfaces:**
- Consumes:
  - `FilterUtils.collectTags(items)` / `FilterUtils.filterItems(items, tag)`（Task 1で定義）
  - `#filter-bar`要素（Task 2で追加）
- Produces:
  - モジュールスコープの`allOrdered`（全商品配列、在庫→SOLD順）、`currentFilter`（`string`、初期値`'all'`）、`tags`（`string[]`）、`visibleItems`（現在表示中の配列）
  - `renderGrid()` — `visibleItems`を再計算し、`#grid`と`#filter-bar`を再描画する
  - `filterBarHtml(tags, currentFilter)` — フィルターボタンのHTML文字列を返す

- [ ] **Step 1: `index.html`に`filter-utils.js`の`<script>`タグを追加**

`index.html`の現在の該当箇所:

```html
  <script src="image-utils.js"></script>
  <script src="config.js"></script>
  <script src="app.js"></script>
```

これを以下に変更（`app.js`より前、`image-utils.js`と同様の位置）:

```html
  <script src="image-utils.js"></script>
  <script src="filter-utils.js"></script>
  <script src="config.js"></script>
  <script src="app.js"></script>
```

- [ ] **Step 2: `app.js`にモジュールスコープの状態変数を追加**

`app.js`の既存の`let modalPhotos = [];` / `let modalPhotoIndex = 0;`（53-54行目付近）の直後に追加:

```javascript
let allOrdered = [];
let currentFilter = 'all';
let tags = [];
let visibleItems = [];
```

- [ ] **Step 3: `filterBarHtml`と`renderGrid`関数を追加**

`cardHtml`関数（32-51行目付近）の直後、`let modalPhotos = [];`の前に追加:

```javascript
function filterBarHtml(tagList, selected) {
  const allBtn = `<button class="filter-btn${selected === 'all' ? ' active' : ''}" data-tag="all">すべて</button>`;
  const tagBtns = tagList.map(tag =>
    `<button class="filter-btn${selected === tag ? ' active' : ''}" data-tag="${tag}">${tag}</button>`
  ).join('');
  return allBtn + tagBtns;
}

function renderGrid() {
  visibleItems = FilterUtils.filterItems(allOrdered, currentFilter);
  document.getElementById('grid').innerHTML = visibleItems.map((item, i) => cardHtml(item, i)).join('');
  document.getElementById('filter-bar').innerHTML = filterBarHtml(tags, currentFilter);
}
```

- [ ] **Step 4: `main()`内の一覧描画ロジックを`renderGrid()`呼び出しに置き換え**

`app.js`の`main()`内、現在の該当箇所:

```javascript
  const grid = document.getElementById('grid');
  try {
    const items = await loadItems();
    const withPhotos = await Promise.all(items.map(async item => {
      item.photos = await loadItemImages(item['商品ID']);
      return item;
    }));
    const available = withPhotos.filter(i => !isSold(i));
    const sold = withPhotos.filter(i => isSold(i));
    const ordered = [...available, ...sold];
    grid.innerHTML = ordered.map((item, i) => cardHtml(item, i)).join('');

    grid.addEventListener('click', e => {
      const card = e.target.closest('.card');
      if (card) openModal(ordered[card.dataset.index]);
    });
    grid.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const card = e.target.closest('.card');
        if (card) openModal(ordered[card.dataset.index]);
      }
    });
  } catch (e) {
    grid.innerHTML = '<p class="error">データを読み込めませんでした。<br>SHEET_ID と シートの公開設定を確認してください。</p>';
    console.error(e);
  }
```

これを以下に変更:

```javascript
  const grid = document.getElementById('grid');
  const filterBar = document.getElementById('filter-bar');
  try {
    const items = await loadItems();
    const withPhotos = await Promise.all(items.map(async item => {
      item.photos = await loadItemImages(item['商品ID']);
      return item;
    }));
    const available = withPhotos.filter(i => !isSold(i));
    const sold = withPhotos.filter(i => isSold(i));
    allOrdered = [...available, ...sold];
    tags = FilterUtils.collectTags(allOrdered);
    renderGrid();

    grid.addEventListener('click', e => {
      const card = e.target.closest('.card');
      if (card) openModal(visibleItems[card.dataset.index]);
    });
    grid.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const card = e.target.closest('.card');
        if (card) openModal(visibleItems[card.dataset.index]);
      }
    });
    filterBar.addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      currentFilter = btn.dataset.tag;
      renderGrid();
    });
  } catch (e) {
    grid.innerHTML = '<p class="error">データを読み込めませんでした。<br>SHEET_ID と シートの公開設定を確認してください。</p>';
    console.error(e);
  }
```

- [ ] **Step 5: 既存テストが壊れていないことを確認**

Run: `node --test`
Expected: PASS, 全テストがパス（`filter-utils.test.js`と`image-utils.test.js`両方）

（`node --test tests/`のようにディレクトリを直接指定する形は、この環境のNode（v22.20.0）では`Cannot find module`エラーになる。引数なしの`node --test`か、`node --test tests/*.test.js`を使うこと。）

- [ ] **Step 6: ブラウザで動作確認**

`index.html`をブラウザで開く（`file://`で開くとGoogleスプレッドシートへの`fetch`がブロックされる場合は、`python3 -m http.server`等の簡易サーバー経由で `http://localhost:8000` から開く）。

確認項目:
- ヘッダー下に「すべて」＋各カテゴリのボタンが横並びで表示される
- 「すべて」が選択状態（濃い青背景）になっている
- 任意のカテゴリボタンをクリックすると、そのカテゴリの商品だけが表示され、ボタンの選択状態が切り替わる
- カテゴリが空の商品がある場合、「その他」ボタンで絞り込むとそれらの商品だけが表示される
- 絞り込んだ状態で商品カードをクリックすると、正しい商品のモーダルが開く（フィルタ前後でズレていないこと）
- 「すべて」に戻すと全商品が元の順序（在庫→SOLD）で表示される

- [ ] **Step 7: Commit**

```bash
git add index.html app.js
git commit -m "$(cat <<'EOF'
Wire category tag filter bar into item grid

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
