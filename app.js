const SHEET_URL = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json`;

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

function priceLabel(val) {
  if (!val && val !== 0) return '要相談';
  return `$${Number(val).toLocaleString()}`;
}

function isSold(item) {
  return item['売れた'] === true || item['売れた'] === 'TRUE';
}

function cardHtml(item, index) {
  const imgUrl = driveImageUrl(item['写真URL']);
  const sold = isSold(item);
  return `
    <div class="card${sold ? ' sold' : ''}" ${!sold ? `data-index="${index}" role="button" tabindex="0"` : ''}>
      ${imgUrl
        ? `<img src="${imgUrl}" alt="${item['品名'] || ''}" loading="lazy">`
        : '<div class="no-image">📷</div>'}
      ${sold ? '<span class="sold-badge">SOLD</span>' : ''}
      <div class="card-body">
        <h3>${item['品名'] || '(名前なし)'}</h3>
        ${!sold ? `<div class="price">${priceLabel(item['値段'])}</div>` : ''}
        ${item['状態'] ? `<div class="condition">${item['状態']}</div>` : ''}
        ${item['説明'] ? `<p class="description">${item['説明']}</p>` : ''}
        ${item['カテゴリ'] ? `<span class="tag">${item['カテゴリ']}</span>` : ''}
      </div>
    </div>`;
}

function openModal(item) {
  const sold = isSold(item);
  const imgUrl = driveImageUrl(item['写真URL']);
  const price = priceLabel(item['値段']);
  const message = `「${item['品名']}」(${price}) に興味があります！`;

  document.getElementById('modal-img').innerHTML = imgUrl
    ? `<img src="${imgUrl}" alt="${item['品名'] || ''}">`
    : '<div class="modal-no-image">📷</div>';
  document.getElementById('modal-title').textContent = item['品名'] || '(名前なし)';
  document.getElementById('modal-price').textContent = price;
  document.getElementById('modal-condition').textContent = item['状態'] || '';
  document.getElementById('modal-description').textContent = item['説明'] || '';
  document.getElementById('modal-message').value = message;

  const contact = document.getElementById('modal-contact');
  contact.style.display = sold ? 'none' : 'block';

  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
}

async function copyMessage() {
  const text = document.getElementById('modal-message').value;
  await navigator.clipboard.writeText(text);
  const btn = document.getElementById('copy-btn');
  btn.textContent = 'コピーしました！';
  setTimeout(() => { btn.textContent = 'メッセージをコピー'; }, 2000);
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

  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) closeModal();
  });
  document.getElementById('close-btn').addEventListener('click', closeModal);
  document.getElementById('copy-btn').addEventListener('click', copyMessage);
}

main();
