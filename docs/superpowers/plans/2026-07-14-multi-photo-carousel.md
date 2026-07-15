# 複数写真カルーセル機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 商品1点につき複数枚の写真を`images/`フォルダから自動検出し、一覧カードのバッジ表示とモーダル内カルーセル（矢印・スワイプ・ドット）で閲覧できるようにする。

**Architecture:** 商品ID起点で`item-{id}-{n}.jpg`という命名規則の画像を`Image()`オブジェクトで逐次プローブし、成功したURLの配列を各商品データに付与する。カード描画・モーダル描画はその配列を消費する形に書き換える。ロジックの純粋関数部分（URL生成、インデックスのクランプ、スワイプ方向判定、バッジ文言）は`image-utils.js`に切り出し、ブラウザとNode両方から呼べる形にしてユニットテスト対象にする。

**Tech Stack:** Vanilla HTML/CSS/JS（既存踏襲、ビルドツールなし）。テストはNode.js組み込みの`node:test` / `node:assert`を使用（追加依存なし、Node v18+で動作、確認済み動作環境はv22.20.0）。

## Global Constraints

- 既存コードにビルドステップ・パッケージマネージャは存在しない。新規に`package.json`や外部依存を追加しない。
- DOM/ブラウザ専用の処理（`Image()`による画像プローブ、モーダルの開閉、実際のスワイプ操作）はNode側のユニットテストでは検証できないため、該当タスクは「ブラウザで手動確認」のステップを踏む。既存コードにもDOMテストは存在しないため、この方針は既存パターンに合わせている。
- 写真の探索は`item-{商品ID}-1.jpg`から`item-{商品ID}-8.jpg`まで、最大8枚。拡張子は`.jpg`固定。
- スプレッドシートの列は`商品ID | 品名 | 値段 | 状態 | カテゴリ | 説明 | 売れた`（`写真URL`列は廃止）。この変更はユーザー側で実施済み、または並行して実施される前提。

---

### Task 1: 純粋関数モジュール `image-utils.js` の作成

**Files:**
- Create: `image-utils.js`
- Test: `tests/image-utils.test.js`

**Interfaces:**
- Produces: `ImageUtils.imageCandidateUrl(id, n) -> string`、`ImageUtils.clampedStep(current, delta, length) -> number`、`ImageUtils.swipeDirection(deltaX, threshold?) -> 'left' | 'right' | null`、`ImageUtils.photoBadgeLabel(count) -> string | null`。ブラウザでは`window.ImageUtils`、Nodeでは`module.exports`からアクセス可能。

- [ ] **Step 1: テストディレクトリを作成し、失敗するテストを書く**

`tests/image-utils.test.js`:

```js
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
```

- [ ] **Step 2: テストを実行し、失敗することを確認**

Run: `node --test tests/`
Expected: FAIL（`Cannot find module '../image-utils.js'`)

- [ ] **Step 3: `image-utils.js` を実装**

```js
(function (root) {
  function imageCandidateUrl(id, n) {
    return `images/item-${id}-${n}.jpg`;
  }

  function clampedStep(current, delta, length) {
    if (length <= 0) return 0;
    const next = current + delta;
    if (next < 0) return 0;
    if (next > length - 1) return length - 1;
    return next;
  }

  function swipeDirection(deltaX, threshold) {
    threshold = threshold === undefined ? 50 : threshold;
    if (deltaX <= -threshold) return 'left';
    if (deltaX >= threshold) return 'right';
    return null;
  }

  function photoBadgeLabel(count) {
    return count > 1 ? `📷 ${count}` : null;
  }

  const ImageUtils = { imageCandidateUrl, clampedStep, swipeDirection, photoBadgeLabel };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageUtils;
  } else {
    root.ImageUtils = ImageUtils;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: テストを実行し、成功することを確認**

Run: `node --test tests/`
Expected: PASS（5 tests passing）

- [ ] **Step 5: コミット**

```bash
git add image-utils.js tests/image-utils.test.js
git commit -m "feat: add pure image-utils helpers with tests"
```

---

### Task 2: `image-utils.js` の読み込みと写真の自動探索ロジック

**Files:**
- Modify: `index.html`（`<script src="image-utils.js"></script>`を`app.js`より前に追加）
- Modify: `app.js`（`driveImageUrl`を削除し、`loadItemImages`を追加、`main()`で商品ごとに写真配列を付与）

**Interfaces:**
- Consumes: `ImageUtils.imageCandidateUrl(id, n)`（Task 1で定義）
- Produces: `loadItemImages(id) -> Promise<string[]>`。以後のタスクは各`item`オブジェクトに`item.photos`（成功したURLの配列）が付与されている前提で実装する。

- [ ] **Step 1: `index.html` にスクリプトタグを追加**

`index.html`の`<script src="config.js"></script>`の直前に追加:

```html
  <script src="image-utils.js"></script>
```

- [ ] **Step 2: `app.js` から `driveImageUrl` を削除し、画像プローブ関数を追加**

`app.js`冒頭、`const SHEET_URL = ...`の直後にあった`driveImageUrl`関数を削除し、代わりに以下を追加:

```js
function probeImage(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function loadItemImages(id) {
  const photos = [];
  for (let n = 1; n <= 8; n++) {
    const url = ImageUtils.imageCandidateUrl(id, n);
    const ok = await probeImage(url);
    if (!ok) break;
    photos.push(url);
  }
  return photos;
}
```

- [ ] **Step 3: `main()` で各商品に `photos` を付与する**

`main()`内の以下の部分:

```js
    const items = await loadItems();
    const available = items.filter(i => !isSold(i));
    const sold = items.filter(i => isSold(i));
    const ordered = [...available, ...sold];
```

を次のように変更:

```js
    const items = await loadItems();
    const withPhotos = await Promise.all(items.map(async item => {
      item.photos = await loadItemImages(item['商品ID']);
      return item;
    }));
    const available = withPhotos.filter(i => !isSold(i));
    const sold = withPhotos.filter(i => isSold(i));
    const ordered = [...available, ...sold];
```

- [ ] **Step 4: ブラウザで手動確認**

1. `images/`フォルダを作成し、テスト用に`item-1-1.jpg`と`item-1-2.jpg`を配置（適当な画像でよい）
2. `python3 -m http.server 8000`など静的サーバーをリポジトリルートで起動
3. ブラウザで`http://localhost:8000`を開き、開発者ツールのNetworkタブで`item-1-1.jpg`, `item-1-2.jpg`が200、`item-1-3.jpg`が404（探索打ち切り）になっていることを確認
4. コンソールでエラーが出ていないことを確認

Expected: `item-1-3.jpg`のリクエストが1回だけ発生し、それ以降(`item-1-4.jpg`等)はリクエストされない

- [ ] **Step 5: コミット**

```bash
git add index.html app.js
git commit -m "feat: probe images/ for multiple photos per item"
```

---

### Task 3: 一覧カードの複数写真バッジ対応

**Files:**
- Modify: `app.js`（`cardHtml`関数）
- Modify: `style.css`（`.photo-count-badge`スタイル追加）

**Interfaces:**
- Consumes: `item.photos`（Task 2で付与）、`ImageUtils.photoBadgeLabel(count)`（Task 1）

- [ ] **Step 1: `cardHtml` を書き換え**

`app.js`の`cardHtml`関数全体を次のように置き換える:

```js
function cardHtml(item, index) {
  const photos = item.photos || [];
  const sold = isSold(item);
  const badgeLabel = ImageUtils.photoBadgeLabel(photos.length);
  return `
    <div class="card${sold ? ' sold' : ''}" ${!sold ? `data-index="${index}" role="button" tabindex="0"` : ''}>
      ${photos[0]
        ? `<img src="${photos[0]}" alt="${item['品名'] || ''}" loading="lazy">`
        : '<div class="no-image">📷</div>'}
      ${sold ? '<span class="sold-badge">SOLD</span>' : ''}
      ${badgeLabel ? `<span class="photo-count-badge">${badgeLabel}</span>` : ''}
      <div class="card-body">
        <h3>${item['品名'] || '(名前なし)'}</h3>
        ${!sold ? `<div class="price">${priceLabel(item['値段'])}</div>` : ''}
        ${item['状態'] ? `<div class="condition">${item['状態']}</div>` : ''}
        ${item['説明'] ? `<p class="description">${item['説明']}</p>` : ''}
        ${item['カテゴリ'] ? `<span class="tag">${item['カテゴリ']}</span>` : ''}
      </div>
    </div>`;
}
```

- [ ] **Step 2: バッジのCSSを追加**

`style.css`の`.sold-badge`ブロックの直後に追加:

```css
.photo-count-badge {
  position: absolute;
  top: 10px; left: 10px;
  background: rgba(0,0,0,.55);
  color: white;
  font-size: .75rem;
  padding: 3px 8px;
  border-radius: 20px;
}
```

- [ ] **Step 3: ブラウザで手動確認**

Task 2で用意した`item-1-1.jpg`, `item-1-2.jpg`を持つ商品のカードで、左上に「📷 2」バッジが表示されることを確認。写真1枚だけの商品ではバッジが表示されないことも確認。

- [ ] **Step 4: コミット**

```bash
git add app.js style.css
git commit -m "feat: show photo count badge on cards with multiple photos"
```

---

### Task 4: モーダルにカルーセルのDOM構造とスタイルを追加

**Files:**
- Modify: `index.html`（モーダル内に矢印ボタン・ドットのマークアップを追加）
- Modify: `style.css`（`.modal-media`, `.carousel-btn`, `.carousel-dots`のスタイル追加）

- [ ] **Step 1: `index.html` のモーダル構造を変更**

`index.html`の以下の部分:

```html
    <div class="modal-box">
      <div id="modal-img"></div>
      <div class="modal-body">
```

を次のように変更:

```html
    <div class="modal-box">
      <div class="modal-media">
        <div id="modal-img"></div>
        <button id="prev-photo-btn" class="carousel-btn carousel-btn-prev" aria-label="前の写真">‹</button>
        <button id="next-photo-btn" class="carousel-btn carousel-btn-next" aria-label="次の写真">›</button>
        <div id="carousel-dots" class="carousel-dots"></div>
      </div>
      <div class="modal-body">
```

- [ ] **Step 2: `style.css` にカルーセルのスタイルを追加**

`style.css`の`#modal-img img, .modal-no-image { ... }`ブロックの直前に追加:

```css
.modal-media { position: relative; }

.carousel-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,.45);
  color: white;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.carousel-btn-prev { left: 10px; }
.carousel-btn-next { right: 10px; }

.carousel-dots {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
}
.carousel-dots .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255,255,255,.6);
  cursor: pointer;
}
.carousel-dots .dot.active { background: white; }
```

- [ ] **Step 3: ブラウザで手動確認**

ページを開き、開発者ツールの要素インスペクタで`.carousel-btn`, `.carousel-dots`がモーダルDOM内に存在することを確認（この時点ではまだJSで表示制御していないため、常に見えている状態でよい）。

- [ ] **Step 4: コミット**

```bash
git add index.html style.css
git commit -m "feat: add carousel markup and styles to modal"
```

---

### Task 5: モーダルカルーセルの操作ロジック（矢印・ドット・スワイプ・キーボード）

**Files:**
- Modify: `app.js`（`openModal`の書き換え、カルーセル状態管理・描画・イベントハンドラの追加）

**Interfaces:**
- Consumes: `ImageUtils.clampedStep(current, delta, length)`, `ImageUtils.swipeDirection(deltaX, threshold?)`（Task 1）、`item.photos`（Task 2）

- [ ] **Step 1: カルーセル状態とレンダリング関数を追加**

`app.js`の`function openModal(item) {`の直前に追加:

```js
let modalPhotos = [];
let modalPhotoIndex = 0;

function renderCarouselPhoto() {
  const imgWrap = document.getElementById('modal-img');
  const url = modalPhotos[modalPhotoIndex];
  imgWrap.innerHTML = url
    ? `<img src="${url}" alt="">`
    : '<div class="modal-no-image">📷</div>';

  const hasMultiple = modalPhotos.length > 1;
  document.getElementById('prev-photo-btn').style.display = hasMultiple ? 'flex' : 'none';
  document.getElementById('next-photo-btn').style.display = hasMultiple ? 'flex' : 'none';

  const dotsWrap = document.getElementById('carousel-dots');
  dotsWrap.innerHTML = hasMultiple
    ? modalPhotos.map((_, i) => `<span class="dot${i === modalPhotoIndex ? ' active' : ''}" data-index="${i}"></span>`).join('')
    : '';
}

function showPhoto(delta) {
  modalPhotoIndex = ImageUtils.clampedStep(modalPhotoIndex, delta, modalPhotos.length);
  renderCarouselPhoto();
}

function goToPhoto(index) {
  modalPhotoIndex = ImageUtils.clampedStep(index, 0, modalPhotos.length);
  renderCarouselPhoto();
}
```

- [ ] **Step 2: `openModal` を写真配列対応に書き換え**

`app.js`の`openModal`関数内、以下の部分:

```js
  const sold = isSold(item);
  const imgUrl = driveImageUrl(item['写真URL']);
  const price = priceLabel(item['値段']);
  const message = `「${item['品名']}」(${price}) に興味があります！`;

  document.getElementById('modal-img').innerHTML = imgUrl
    ? `<img src="${imgUrl}" alt="${item['品名'] || ''}">`
    : '<div class="modal-no-image">📷</div>';
  document.getElementById('modal-title').textContent = item['品名'] || '(名前なし)';
```

を次のように変更:

```js
  const sold = isSold(item);
  const price = priceLabel(item['値段']);
  const message = `「${item['品名']}」(${price}) に興味があります！`;

  modalPhotos = item.photos || [];
  modalPhotoIndex = 0;
  renderCarouselPhoto();

  document.getElementById('modal-title').textContent = item['品名'] || '(名前なし)';
```

- [ ] **Step 3: スワイプ・矢印・ドット・キーボードのイベントハンドラを追加**

`app.js`の`main()`関数内、以下の部分:

```js
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) closeModal();
  });
  document.getElementById('close-btn').addEventListener('click', closeModal);
  document.getElementById('copy-btn').addEventListener('click', copyMessage);
}
```

を次のように変更:

```js
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) closeModal();
  });
  document.getElementById('close-btn').addEventListener('click', closeModal);
  document.getElementById('copy-btn').addEventListener('click', copyMessage);

  document.getElementById('prev-photo-btn').addEventListener('click', () => showPhoto(-1));
  document.getElementById('next-photo-btn').addEventListener('click', () => showPhoto(1));
  document.getElementById('carousel-dots').addEventListener('click', e => {
    const dot = e.target.closest('.dot');
    if (dot) goToPhoto(Number(dot.dataset.index));
  });

  let touchStartX = null;
  const modalImg = document.getElementById('modal-img');
  modalImg.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  });
  modalImg.addEventListener('touchend', e => {
    if (touchStartX === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const direction = ImageUtils.swipeDirection(deltaX);
    if (direction === 'left') showPhoto(1);
    if (direction === 'right') showPhoto(-1);
    touchStartX = null;
  });

  document.addEventListener('keydown', e => {
    if (!document.getElementById('modal').classList.contains('open')) return;
    if (e.key === 'ArrowLeft') showPhoto(-1);
    if (e.key === 'ArrowRight') showPhoto(1);
  });
}
```

- [ ] **Step 4: ブラウザで手動確認**

1. 写真2枚以上の商品カードをクリックしてモーダルを開く
2. 矢印ボタンで前後の写真に切り替わること、最初/最後で止まること（ループしないこと）を確認
3. 下部のドットをクリックして直接ジャンプできること、現在位置のドットがハイライトされることを確認
4. キーボードの左右矢印キーで切り替わることを確認
5. Chrome DevToolsのデバイスモード（モバイルエミュレーション）でモーダル画像を左右にドラッグし、スワイプで切り替わることを確認
6. 写真1枚だけの商品では矢印・ドットが表示されないことを確認

- [ ] **Step 5: コミット**

```bash
git add app.js
git commit -m "feat: implement modal carousel navigation (arrows, dots, swipe, keyboard)"
```

---

### Task 6: 一連の動作を通した最終確認

**Files:**
- なし（コード変更なし、動作確認のみ）

- [ ] **Step 1: テスト用データで一覧〜モーダルの流れを確認**

`images/`に以下のテストファイルを用意する（既存のTask 2用ファイルに追加）:
- `item-1-1.jpg`, `item-1-2.jpg`（2枚: 商品ID=1）
- `item-2-1.jpg`（1枚: 商品ID=2）
- 商品ID=3は画像なし（ファイルを置かない）

スプレッドシート（またはテスト用に`loadItems`を一時的にモックしたローカルJSON）で上記3商品分のデータを用意し、以下を確認する:
- 商品ID=1のカードに「📷 2」バッジが表示され、モーダルでカルーセル操作ができる
- 商品ID=2のカードにバッジが表示されず、モーダルは矢印・ドットなしの単一画像表示になる
- 商品ID=3のカードは「📷 no-image」プレースホルダーが表示され、モーダルも同様のプレースホルダー表示になる

- [ ] **Step 2: `node --test tests/` を再実行して全体のリグレッションがないことを確認**

Run: `node --test tests/`
Expected: PASS（全テスト）

- [ ] **Step 3: テスト用に置いた `images/` のダミーファイルを削除**

```bash
rm -f images/item-1-1.jpg images/item-1-2.jpg images/item-2-1.jpg
```

（実データは別途ユーザーがアップロードするため、動作確認用のダミーはコミットしない）
