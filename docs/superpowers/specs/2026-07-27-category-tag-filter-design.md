# カテゴリタグ フィルター機能 設計

**Goal:** 現在カード下部に表示している「カテゴリ」タグを使って、一覧の商品を絞り込めるフィルターUIをトップに追加する。

**Context:** 各商品には「カテゴリ」列があり、`cardHtml`でタグとして表示されているだけで絞り込みには使われていない。カテゴリが空欄の商品も存在する。

---

## 1. タグの抽出 (`app.js`)

- `main()`で全商品を読み込み、`ordered`（在庫→SOLDの順）を確定した直後に、タグ一覧を作る関数（例: `collectTags(items)`)を追加する。
- `ordered`を先頭から走査し、`item['カテゴリ']`の値を初出順・重複なしで配列に集める。
- カテゴリが空（null/undefined/空文字）の商品が1件でも存在する場合、配列の末尾に固定タグ`'その他'`を追加する。

---

## 2. フィルターバーUI (`index.html` / `app.js`)

- `index.html`の`<main>`直前に`<div id="filter-bar"></div>`を追加する（空の状態で配置し、データ読み込み後にJSから中身を描画する）。
- `main()`内でタグ一覧が確定した後、フィルターバーのHTMLを生成する関数（例: `filterBarHtml(tags, currentFilter)`）を追加する。
  - 先頭に「すべて」ボタン（`data-tag="all"`）、続けて各タグのボタン（`data-tag="<タグ名>"`）を並べる。
  - 現在選択中のタグに対応するボタンには`.active`クラスを付与する。
- ボタンは`<button class="filter-btn">`要素とし、`grid`と同様にイベントデリゲーションで`#filter-bar`に1つのclickリスナーを付ける。

---

## 3. フィルタリング動作 (`app.js`)

- モジュールスコープの状態として`allOrdered`（全商品、在庫→SOLD順）と`currentFilter`（初期値`'all'`）を保持する。
- 現在表示中の配列を返す関数（例: `getVisibleItems()`）を追加する。
  - `currentFilter === 'all'` の場合は`allOrdered`をそのまま返す。
  - `currentFilter === 'その他'` の場合はカテゴリが空の商品のみを返す。
  - それ以外の場合は`item['カテゴリ'] === currentFilter`の商品のみを返す。
  - いずれの場合も在庫→SOLDの順序は維持される（`allOrdered`のフィルタなので自動的に維持される）。
- 描画をまとめる関数（例: `renderGrid()`）を追加し、以下を行う:
  - `getVisibleItems()`の結果を`grid.innerHTML`に反映する。
  - フィルターバーを再描画して`.active`状態を更新する。
- フィルターボタンのクリックハンドラは`currentFilter`を更新して`renderGrid()`を呼ぶ。
- グリッドのクリック/キーボードイベントハンドラ（`data-index`を使ってモーダルを開く処理）は、固定の`ordered`ではなく`getVisibleItems()`の結果を参照するように修正する（フィルタで表示配列が変わってもモーダルが正しい商品を開くようにするため）。

---

## 4. スタイル (`style.css`)

- `.filter-bar`: `flex; flex-wrap: wrap; gap: 0.5rem;` でヘッダー直下に配置。左右余白は`#grid`と揃える。
- `.filter-btn`: 既存の`.tag`と近い見た目（角丸、パディング）だが、クリック可能なボタンとして`cursor: pointer`、非選択時背景`#ecf0f1`・文字色`#666`。
- `.filter-btn.active`: 背景`#2c3e50`（ヘッダーと同色）、文字色白。

---

## スコープ外

- 複数タグの同時選択（今回は単一選択のみ）
- フィルタ状態のURL保存・リロード後の復元
- タグの並び替えUI（表示順は初出順固定）
