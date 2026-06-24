# Moving Sale Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google Sheetsをデータソースとして、引っ越しセール商品をカード表示するGitHub Pages静的サイトを作る

**Architecture:** HTML/CSS/JS の3ファイル構成。Google Sheets の gviz/tq エンドポイント（認証不要）からデータ取得。Google Drive の共有リンクをサムネイルURLに自動変換。GitHub Pages で無料ホスト。

**Tech Stack:** Vanilla HTML/CSS/JS, Google Sheets gviz API, GitHub Pages

---

## ユーザーが行う作業

### Step A: GitHub リポジトリ作成
- [ ] https://github.com/new にアクセス
- [ ] Repository name: `moving-sale`
- [ ] Public を選択
- [ ] 「Add a README file」にチェック
- [ ] 「Create repository」

### Step B: GitHub Pages を有効化
- [ ] リポジトリの Settings → Pages
- [ ] Source: `Deploy from a branch`
- [ ] Branch: `main` / `/(root)`
- [ ] Save

### Step C: Google スプレッドシート作成
- [ ] https://sheets.new で新規作成
- [ ] 1行目にヘッダーを入力（以下の順番で）:

```
品名 | 値段 | 状態 | カテゴリ | 写真URL | 説明 | 売れた
```

- [ ] ファイル → 共有 → 「リンクを知っている全員」→ 閲覧者
- [ ] URLの `/d/` と `/edit` の間の文字列をコピー（Sheet IDとして使う）

例: `https://docs.google.com/spreadsheets/d/`**`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`**`/edit`

### Step D: 写真のアップロード手順（商品1点あたり）
1. Google ドライブを開く
2. 写真をアップロード
3. 写真を右クリック → 「共有」→ 「リンクを知っている全員」→ 閲覧者
4. リンクをコピーしてスプレッドシートの「写真URL」列に貼り付け

---

## Claude が作成するファイル

### File Structure
```
moving-sale/
├── index.html      # メインページ
├── style.css       # スタイル
└── app.js          # データ取得・レンダリング
```

---

### Task 1: index.html 作成

**Files:**
- Create: `moving-sale/index.html`

- [ ] index.html を作成（ヘッダー、グリッド、スクリプト読み込み）

### Task 2: style.css 作成

**Files:**
- Create: `moving-sale/style.css`

- [ ] レスポンシブカードグリッド、SOLD バッジ、モバイル対応

### Task 3: app.js 作成

**Files:**
- Create: `moving-sale/app.js`

- [ ] Google Sheets gviz API からデータ取得
- [ ] Drive共有URLをサムネイルURLに変換
- [ ] カード形式でレンダリング
- [ ] 売れた商品はグレーアウト＋SOLD表示

### Task 4: config.js 作成

**Files:**
- Create: `moving-sale/config.js`

- [ ] SHEET_ID のみ編集するファイルを分離（ユーザーがここだけ触る）

---

## 完成後のURLイメージ

- サイト: `https://amagin006.github.io/moving-sale/`
- 更新方法: スプレッドシートを編集するだけ（約1分で反映）
