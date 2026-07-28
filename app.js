const SHEET_URL = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json`;
const FETCH_TIMEOUT_MS = 10000;
const IMAGE_PROBE_TIMEOUT_MS = 4000;

function probeImage(url, timeoutMs = IMAGE_PROBE_TIMEOUT_MS) {
  return new Promise(resolve => {
    const img = new Image();
    let settled = false;
    const settle = ok => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const timer = setTimeout(() => settle(false), timeoutMs);
    img.onload = () => { clearTimeout(timer); settle(true); };
    img.onerror = () => { clearTimeout(timer); settle(false); };
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
  const photos = item.photos || [];
  const sold = isSold(item);
  const badgeLabel = ImageUtils.photoBadgeLabel(photos.length);
  return `
    <div class="card${sold ? ' sold' : ''}" data-photo-index="${index}" ${!sold ? `data-index="${index}" role="button" tabindex="0"` : ''}>
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
  observeCardPhotos();
}

let modalPhotos = [];
let modalPhotoIndex = 0;
let currentModalItem = null;

let allOrdered = [];
let currentFilter = 'all';
let tags = [];
let visibleItems = [];

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

function openModal(item) {
  const sold = isSold(item);
  const price = priceLabel(item['値段']);
  const message = `「${item['品名']}」(${price}) に興味があります！`;

  currentModalItem = item;
  modalPhotos = item.photos || [];
  modalPhotoIndex = 0;
  renderCarouselPhoto();

  if (modalPhotos.length === 0) {
    loadItemPhotos(item).then(() => {
      if (currentModalItem !== item || item.photos.length === 0) return;
      modalPhotos = item.photos;
      renderCarouselPhoto();
    });
  }

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(SHEET_URL, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
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

const loadingPhotoIds = new Set();
let photoObserver = null;

function getPhotoObserver() {
  if (photoObserver) return photoObserver;
  photoObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      photoObserver.unobserve(entry.target);
      const item = visibleItems[entry.target.dataset.photoIndex];
      loadItemPhotos(item);
    });
  }, { rootMargin: '200px' });
  return photoObserver;
}

async function loadItemPhotos(item) {
  if (!item || item.photos.length > 0) return;
  const id = item['商品ID'];
  if (loadingPhotoIds.has(id)) return;
  loadingPhotoIds.add(id);
  const photos = await loadItemImages(id);
  if (photos.length > 0) {
    item.photos = photos;
    renderGrid();
  }
}

function observeCardPhotos() {
  const observer = getPhotoObserver();
  document.querySelectorAll('#grid .card[data-photo-index]').forEach(card => {
    const item = visibleItems[card.dataset.photoIndex];
    if (item && item.photos.length === 0 && !loadingPhotoIds.has(item['商品ID'])) {
      observer.observe(card);
    }
  });
}

async function main() {
  document.querySelector('h1').textContent = CONFIG.TITLE;
  document.querySelector('header p').textContent = CONFIG.SUBTITLE;

  const grid = document.getElementById('grid');
  const filterBar = document.getElementById('filter-bar');
  try {
    const items = await loadItems();
    items.forEach(item => { item.photos = []; });
    const available = items.filter(i => !isSold(i));
    const sold = items.filter(i => isSold(i));
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

main();
