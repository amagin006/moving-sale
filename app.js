const SHEET_URL = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json`;

function driveImageUrl(url) {
  if (!url) return null;
  const match = url.match(/\/d\/([^/?]+)/);
  return match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w500` : url;
}

function priceLabel(val) {
  if (!val && val !== 0) return '要相談';
  return `$${Number(val).toLocaleString()} CAD`;
}

function cardHtml(item) {
  const imgUrl = driveImageUrl(item['写真URL']);
  const sold = item['売れた'] === true || item['売れた'] === 'TRUE';
  return `
    <div class="card${sold ? ' sold' : ''}">
      ${imgUrl
        ? `<img src="${imgUrl}" alt="${item['品名'] || ''}" loading="lazy">`
        : '<div class="no-image">📷</div>'}
      ${sold ? '<span class="sold-badge">SOLD</span>' : ''}
      <div class="card-body">
        <h3>${item['品名'] || '(名前なし)'}</h3>
        <div class="price">${priceLabel(item['値段'])}</div>
        ${item['状態'] ? `<div class="condition">${item['状態']}</div>` : ''}
        ${item['説明'] ? `<p class="description">${item['説明']}</p>` : ''}
        ${item['カテゴリ'] ? `<span class="tag">${item['カテゴリ']}</span>` : ''}
      </div>
    </div>`;
}

async function loadItems() {
  const res = await fetch(SHEET_URL);
  const text = await res.text();
  const json = JSON.parse(text.substring(text.indexOf('(') + 1, text.lastIndexOf(')')));
  const labels = json.table.cols.map(c => c.label);
  return json.table.rows
    .filter(row => row.c.some(c => c && c.v !== null && c.v !== ''))
    .map(row => {
      const item = {};
      row.c.forEach((cell, i) => { item[labels[i]] = cell ? cell.v : null; });
      return item;
    });
}

async function main() {
  document.querySelector('h1').textContent = CONFIG.TITLE;
  document.querySelector('header p').textContent = CONFIG.SUBTITLE;

  const grid = document.getElementById('grid');
  try {
    const items = await loadItems();
    const available = items.filter(i => !(i['売れた'] === true || i['売れた'] === 'TRUE'));
    const sold = items.filter(i => i['売れた'] === true || i['売れた'] === 'TRUE');
    grid.innerHTML = [...available, ...sold].map(cardHtml).join('');
  } catch (e) {
    grid.innerHTML = '<p class="error">データを読み込めませんでした。<br>SHEET_ID と シートの公開設定を確認してください。</p>';
    console.error(e);
  }
}

main();
