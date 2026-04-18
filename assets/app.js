/* ═══════════════════════════════════════════════════════════
   DUNKIE SHOP — GEMINI WEB  |  app.js
   SPA Logic: Theme, Catalog, Category Filter, Detail View,
   Cascading Variant Picker, Tally Prefill
   ═══════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────
   1. DATA — populated from CSV at runtime
───────────────────────────────────── */
let CATEGORIES = [];
let PRODUCTS = [];

const CATEGORY_EMOJI_MAP = {
  studying: '📚', ai: '🤖', relax: '🎬', work: '💼',
  storage: '☁️', design: '🎨', vpn: '🛡️', other: '✦', all: '✦'
};

const BRAND_COLORS = [
  '#10a37f', '#7c3aed', '#1a73e8', '#0078d4', '#7d2ae8',
  '#e50914', '#1db954', '#ff0000', '#58cc02', '#d83b01'
];

function getRandomColor(id) {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return BRAND_COLORS[sum % BRAND_COLORS.length];
}

const hex2rgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

/* ─────────────────────────────────────
   2. CSV LOADING
───────────────────────────────────── */
const TALLY_BASE = 'https://tally.so/r/BzQLr7';

function tallyUrl(product, goi, gia) {
  const params = new URLSearchParams({
    san_pham: product,
    goi_thoi_han: goi,
    gia: String(gia),
  });
  return `${TALLY_BASE}?${params.toString()}`;
}

const CSV_URL_CATEGORIES = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRi75c5Mj2SwT4cfgMFhl8IPnz1s9aD7ahOQVPeOxNuj09iZCmwvFAAWnfr46Wqaoh_qA2HmhZyUtGR/pub?gid=322315093&single=true&output=csv';
const CSV_URL_PRODUCTS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRi75c5Mj2SwT4cfgMFhl8IPnz1s9aD7ahOQVPeOxNuj09iZCmwvFAAWnfr46Wqaoh_qA2HmhZyUtGR/pub?gid=1828921144&single=true&output=csv';
const CSV_URL_VARIANTS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRi75c5Mj2SwT4cfgMFhl8IPnz1s9aD7ahOQVPeOxNuj09iZCmwvFAAWnfr46Wqaoh_qA2HmhZyUtGR/pub?gid=229132067&single=true&output=csv';

function parseCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: results => resolve(results.data),
      error: err => reject(err)
    });
  });
}

async function loadData() {
  const grid = document.getElementById('product-grid');
  if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;opacity:.6;">Đang tải sản phẩm...</div>';

  try {
    const [cats, prods, vars] = await Promise.all([
      parseCSV(CSV_URL_CATEGORIES),
      parseCSV(CSV_URL_PRODUCTS),
      parseCSV(CSV_URL_VARIANTS)
    ]);

    /* Build CATEGORIES */
    CATEGORIES = [{ id: 'all', name: 'Tất cả', icon: '✦' }];
    cats.forEach(c => {
      const id = (c.CategoryID || '').toLowerCase();
      if (!id) return;
      CATEGORIES.push({ id, name: c.CategoryName || 'Khác', icon: CATEGORY_EMOJI_MAP[id] || '✦' });
    });

    /* Build PRODUCTS */
    PRODUCTS = [];
    prods
      .filter(p => String(p.Active).toUpperCase().trim() === 'TRUE')
      .forEach(p => {
        const id = p.ProductID || '';
        if (!id) return;
        const catId = (p.CategoryID || 'other').toLowerCase();
        const color = getRandomColor(id);
        const gradient = `linear-gradient(135deg, ${hex2rgba(color, 0.1)}, ${hex2rgba(color, 0.2)})`;
        const sentences = (p.Description || '').split(/[.!?](?:\s+|$)/).map(s => s.trim()).filter(s => s.length > 0);
        const tagline = sentences[0] ? sentences[0] + '.' : (p.ProductName || 'Unknown');
        const features = sentences.length > 1 ? sentences.slice(0, 4) : [tagline, 'Bảo hành đầy đủ', 'Giao ngay nhanh chóng'];
        PRODUCTS.push({
          id, category: catId, name: p.ProductName || 'Unknown',
          letter: (p.ProductName || '').substring(0, 3).toUpperCase(),
          color, gradient, letterColor: color,
          badge: 'Hot', badgeType: 'promo',
          tagline, desc: p.Description || '', features,
          logo: p.Image_URL || ' ',
          variants: []
        });
      });

    /* Add VARIANTS */
    vars
      .filter(v => String(v.Active).toUpperCase().trim() === 'TRUE')
      .forEach(v => {
        const prod = PRODUCTS.find(p => p.id === v.Product_ID);
        if (!prod) return;
        const price = parseInt(String(v.Price).replace(/\D/g, ''), 10);
        if (isNaN(price)) return;
        prod.variants.push({
          type: v.ProductType || 'Gói mặc định',
          account: v.AccountType || 'Chính chủ',
          duration: v.Duration || '1 tháng',
          price,
          tally: v.Tally_URL || '',
          note: v.Specific_Notes || '',
        });
      });

    /* Keep only products that have at least 1 variant */
    PRODUCTS = PRODUCTS.filter(p => p.variants.length > 0);

    Theme.init();
    renderChips();
    renderProducts();
    handleRouteChange(); // Kích hoạt đọc hash trên link khi mới load file
  } catch (err) {
    console.error('Lỗi tải dữ liệu:', err);
    if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:#e84f1b;">Lỗi tải dữ liệu! Vui lòng F5 lại trang.</div>';
  }
}

/* ─────────────────────────────────────
   3. APP STATE
───────────────────────────────────── */
const State = {
  view: 'catalog',
  filter: 'all',
  searchQuery: '',
  productId: null,
  variant: {
    type: null,
    account: null,
    duration: null,
  },
};

/* ─────────────────────────────────────
   4. UTILITIES
───────────────────────────────────── */
function fmt(n) {
  return n.toLocaleString('vi-VN') + '₫';
}

function getProduct(id) {
  return PRODUCTS.find(p => p.id === id);
}

function getCatName(catId) {
  const c = CATEGORIES.find(c => c.id === catId);
  return c ? c.name : '';
}

function uniqueValues(variants, key) {
  return [...new Set(variants.map(v => v[key]))];
}

/* ─────────────────────────────────────
   5. THEME MANAGEMENT
───────────────────────────────────── */
const Theme = {
  init() {
    const saved = localStorage.getItem('dk-theme') || 'light';
    this.apply(saved);
    document.getElementById('theme-toggle').addEventListener('click', () => this.toggle());
  },
  apply(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('dk-theme', t);
  },
  toggle() {
    const curr = document.documentElement.getAttribute('data-theme');
    this.apply(curr === 'dark' ? 'light' : 'dark');
  },
};

/* ─────────────────────────────────────
   6. VIEW SWITCHING
───────────────────────────────────── */
function showView(name) {
  const catalog = document.getElementById('view-catalog');
  const detail = document.getElementById('view-detail');
  if (name === 'catalog') {
    catalog.classList.add('active');
    detail.classList.remove('active');
    detail.setAttribute('aria-hidden', 'true');
    catalog.removeAttribute('aria-hidden');
    State.view = 'catalog';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    detail.classList.add('active');
    catalog.classList.remove('active');
    catalog.setAttribute('aria-hidden', 'true');
    detail.removeAttribute('aria-hidden');
    State.view = 'detail';
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

/* ─────────────────────────────────────
   6.5 ROUTING (HASH BASED)
───────────────────────────────────── */
function handleRouteChange() {
  const hash = window.location.hash.substring(1);
  if (!hash || hash === '') {
    showView('catalog');
  } else if (hash.startsWith('product=')) {
    const id = hash.split('=')[1];
    if (getProduct(id)) {
      renderDetail(id);
      showView('detail');
    } else {
      window.location.hash = ''; // Fallback
    }
  }
}
window.addEventListener('hashchange', handleRouteChange);

/* ─────────────────────────────────────
   7. CATALOG — RENDER CATEGORY CHIPS
───────────────────────────────────── */
function renderChips() {
  const wrap = document.getElementById('cat-chips');
  wrap.innerHTML = CATEGORIES.map(cat => `
    <button
      class="cat-chip${State.filter === cat.id ? ' active' : ''}"
      role="tab"
      aria-selected="${State.filter === cat.id}"
      data-action="filter"
      data-cat="${cat.id}"
    >
      <span class="cat-chip-icon" aria-hidden="true">${cat.icon}</span>
      ${cat.name}
    </button>
  `).join('');
}

/* ─────────────────────────────────────
   8. CATALOG — RENDER PRODUCTS
───────────────────────────────────── */
function productCardHTML(p) {
  const minPrice = Math.min(...p.variants.map(v => v.price));
  const catName = getCatName(p.category);
  return `
    <article class="product-card" role="listitem" data-product-id="${p.id}">
      <div class="product-logo" style="background: ${p.gradient}">
        ${p.logo && p.logo.trim() !== '' ? `<img src="${p.logo}" alt="${p.name}" class="product-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
        <span class="product-letter" style="color: ${p.letterColor}; display: none;">${p.letter}</span>` : `<span class="product-letter" style="color: ${p.letterColor}">${p.letter}</span>`}
        <span class="product-badge-pill">
          <span class="badge badge-${p.badgeType}">${p.badge}</span>
        </span>
      </div>
      <div class="product-body">
        <div class="product-cat-tag">${catName}</div>
        <h3 class="product-name">${p.name}</h3>
        <p class="product-tagline">${p.tagline}</p>
        <div class="product-price">Từ <strong>${fmt(minPrice)}</strong></div>
        <button class="btn-detail" data-action="detail" data-id="${p.id}">
          Xem chi tiết →
        </button>
      </div>
    </article>
  `;
}

function renderProducts() {
  const grid = document.getElementById('product-grid');
  const empty = document.getElementById('empty-state');
  const q = State.searchQuery.trim().toLowerCase();

  let filtered = PRODUCTS;
  if (State.filter !== 'all') {
    filtered = filtered.filter(p => p.category === State.filter);
  }
  if (q) {
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.tagline.toLowerCase().includes(q) ||
      p.desc.toLowerCase().includes(q)
    );
  }

  if (!filtered.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    grid.innerHTML = filtered.map(productCardHTML).join('');
  }
}

/* ─────────────────────────────────────
   9. DETAIL VIEW — RENDER
───────────────────────────────────── */
function renderDetail(productId) {
  const p = getProduct(productId);
  if (!p) return;

  State.productId = productId;
  State.variant = { type: null, account: null, duration: null };

  /* Breadcrumb */
  document.getElementById('bc-cat').textContent = getCatName(p.category);
  document.getElementById('bc-prod').textContent = p.name;

  /* Unique types for step 1 */
  const types = uniqueValues(p.variants, 'type');

  const html = `
    <div class="detail-layout">

      <!-- LEFT -->
      <div class="detail-left">
        <div class="detail-logo-wrap" style="background: ${p.gradient.replace(/18/g, '40').replace(/2e/g, '55')}">
          ${p.logo && p.logo.trim() !== '' ? `<img src="${p.logo}" alt="${p.name}" class="detail-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <span class="detail-logo-letter" style="color: ${p.letterColor}; display: none;">${p.letter}</span>` : `<span class="detail-logo-letter" style="color: ${p.letterColor}">${p.letter}</span>`}
        </div>

       <!--  <div class="detail-features-card">
          <h4>Bao gồm</h4>
          <ul>
            ${p.features.map(f => `<li>${f}</li>`).join('')}
          </ul>
        </div> -->

        <div class="detail-trust-pills">
          <div class="trust-pill">🛡️ Bảo hành 1 đổi 1</div>
          <div class="trust-pill">⚡ Xử lý 5 - 15 phút</div>
          <div class="trust-pill">💬 Hỗ trợ Zalo 24/7</div>
        </div>
      </div>
      <!-- RIGHT -->
      <div class="detail-right">

        <!-- Product header -->
        <div class="detail-header-card">
          <span class="badge badge-${p.badgeType}">${p.badge}</span>
          <h1 class="detail-title">${p.name}</h1>
          <p class="detail-tagline">${p.tagline}</p>
          <div class="detail-rating">
            <span class="stars">★★★★★</span>
            <span class="rating-text">4.9 / 5 &nbsp;·&nbsp; 120+ đánh giá</span>
          </div>
        </div>

        <!-- Variant picker -->
        <div class="variant-picker" id="variant-picker">
          <div class="variant-picker-title">🛒 Chọn gói mua</div>

          <!-- Step 1 -->
          <div class="variant-step" id="step-1">
            <div class="step-label">
              <span class="step-num">1</span>
              Chọn loại sản phẩm
            </div>
            <div class="variant-options" id="opts-type">
              ${types.map(t => `
                <button class="v-opt" data-step="type" data-val="${esc(t)}">${t}</button>
              `).join('')}
            </div>
          </div>

          <!-- Step 2 (locked until step 1 selected) -->
          <div class="variant-step step-locked" id="step-2">
            <div class="step-label">
              <span class="step-num">2</span>
              Chọn loại tài khoản
            </div>
            <div class="variant-options" id="opts-account"></div>
          </div>

          <!-- Step 3 (locked until step 2 selected) -->
          <div class="variant-step step-locked" id="step-3">
            <div class="step-label">
              <span class="step-num">3</span>
              Chọn thời hạn
            </div>
            <div class="variant-options" id="opts-duration"></div>
          </div>

          <div class="purchase-action-row">
            <!-- Price display -->
            <div class="price-display" id="price-display">
              <span class="price-hint">← Chọn gói để xem giá</span>
            </div>

            <!-- Buy button -->
            <button class="btn btn-cta btn-buy" id="buy-btn" disabled>
              🛒 Mua ngay
            </button> 
          </div>       
          <p class="buy-note">
            Nhấn "Mua ngay" → điền form đặt hàng → thanh toán chuyển khoản.
            Tài khoản giao trong 5–15 phút.
          </p>
        </div>

      </div>
    </div>

    <!-- Notes — full width, hiện khi chọn xong variant -->
    <div class="detail-desc-card" id="detail-note-container" style="display: none; margin-top: .75rem;">
      <h3>Lưu ý đính kèm</h3>
      <ul id="variant-note-text"></ul>
    </div>

    <!-- Description -->
    <div class="detail-desc-card" style="margin-top: .75rem;">
      <h3>Mô tả sản phẩm</h3>
      <p>${p.desc}</p>
    </div>

    <!-- Related products -->
    <div class="related-section">
      <h3>Sản phẩm liên quan</h3>
      <div class="related-grid">
        ${getRelated(p).map(productCardHTML).join('')}
      </div>
    </div>

    <!-- Sticky buy button (mobile only, activated via CSS @media) 
    <div class="sticky-buy-wrap" id="sticky-buy-wrap">
      <button class="btn btn-cta btn-buy" id="sticky-buy-btn" disabled>
        🛒 Chọn đủ 3 bước để mua
      </button>
    </div>-->
  `;

  document.getElementById('detail-content').innerHTML = html;
  bindVariantListeners(p);
}

function esc(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getRelated(p) {
  return PRODUCTS
    .filter(x => x.id !== p.id && x.category === p.category)
    .slice(0, 4);
}

/* ─────────────────────────────────────
   10. VARIANT PICKER LOGIC
───────────────────────────────────── */
function bindVariantListeners(p) {
  document.getElementById('variant-picker').addEventListener('click', e => {
    const btn = e.target.closest('.v-opt');
    if (!btn) return;
    const step = btn.dataset.step;
    const val = btn.dataset.val;
    handleVariantSelect(p, step, val);
  });
}

function handleVariantSelect(p, step, val) {
  if (step === 'type') {
    State.variant = { type: val, account: null, duration: null };
    updateStep1(val);
    renderStep2(p, val);
    unlockStep(2);
    lockStep(3);
    resetPriceDisplay();
    disableBuy();
  } else if (step === 'account') {
    State.variant.account = val;
    State.variant.duration = null;
    updateStep2(val);
    renderStep3(p, State.variant.type, val);
    unlockStep(3);
    resetPriceDisplay();
    disableBuy();
  } else if (step === 'duration') {
    State.variant.duration = val;
    updateStep3(val);
    showPrice(p);
  }
}

function updateStep1(selected) {
  document.querySelectorAll('#opts-type .v-opt').forEach(b => {
    b.classList.toggle('selected', b.dataset.val === selected);
  });
}

function renderStep2(p, selectedType) {
  const accounts = uniqueValues(
    p.variants.filter(v => v.type === selectedType),
    'account'
  );
  document.getElementById('opts-account').innerHTML = accounts.map(a => `
    <button class="v-opt" data-step="account" data-val="${esc(a)}">${a}</button>
  `).join('');
}

function updateStep2(selected) {
  document.querySelectorAll('#opts-account .v-opt').forEach(b => {
    b.classList.toggle('selected', b.dataset.val === selected);
  });
}

function renderStep3(p, type, account) {
  const durations = uniqueValues(
    p.variants.filter(v => v.type === type && v.account === account),
    'duration'
  );
  document.getElementById('opts-duration').innerHTML = durations.map(d => `
    <button class="v-opt" data-step="duration" data-val="${esc(d)}">${d}</button>
  `).join('');
}

function updateStep3(selected) {
  document.querySelectorAll('#opts-duration .v-opt').forEach(b => {
    b.classList.toggle('selected', b.dataset.val === selected);
  });
}

function lockStep(n) {
  const el = document.getElementById(`step-${n}`);
  if (el) el.classList.add('step-locked');
}

function unlockStep(n) {
  const el = document.getElementById(`step-${n}`);
  if (el) el.classList.remove('step-locked');
}

function resetPriceDisplay() {
  const pd = document.getElementById('price-display');
  if (!pd) return;
  pd.classList.remove('ready');
  pd.innerHTML = '<span class="price-hint">← Chọn đủ 3 bước để xem giá</span>';
  const stickyBtn = document.getElementById('sticky-buy-btn');
  if (stickyBtn) {
    stickyBtn.disabled = true;
    stickyBtn.textContent = '🛒 Chọn đủ 3 bước để mua';
  }
  const noteEl = document.getElementById('variant-note-text');
  if (noteEl) {
    noteEl.innerHTML = '';
    document.getElementById('detail-note-container').style.display = 'none';
  }
}

function disableBuy() {
  const b = document.getElementById('buy-btn');
  if (b) { b.disabled = true; b.textContent = '🛒 Mua ngay'; }
  const stickyBtn = document.getElementById('sticky-buy-btn');
  if (stickyBtn) {
    stickyBtn.disabled = true;
    stickyBtn.textContent = '🛒 Chọn đủ 3 bước để mua';
    delete stickyBtn.dataset.tallyUrl;
  }
}

function showPrice(p) {
  const { type, account, duration } = State.variant;
  const variant = p.variants.find(
    v => v.type === type && v.account === account && v.duration === duration
  );
  if (!variant) { resetPriceDisplay(); return; }

  const pd = document.getElementById('price-display');
  pd.classList.add('ready');
  pd.innerHTML = `
    <div class="price-amount">
      <span class="price-label">Giá</span>
      <span class="price-value">${fmt(variant.price)}</span>
    </div>
    <div class="price-selected-info">
      ${type}<br>
      ${account} · ${duration}
    </div>
  `;

  const buyBtn = document.getElementById('buy-btn');
  buyBtn.disabled = false;
  buyBtn.textContent = `🛒 Mua ngay — ${fmt(variant.price)}`;

  const url = (variant.tally && variant.tally.startsWith('http'))
    ? variant.tally
    : tallyUrl(`${p.name} | ${type}`, duration, variant.price);
  buyBtn.dataset.tallyUrl = url;

  const stickyBtn = document.getElementById('sticky-buy-btn');
  if (stickyBtn) {
    stickyBtn.disabled = false;
    stickyBtn.textContent = `🛒 Mua ngay — ${fmt(variant.price)}`;
    stickyBtn.dataset.tallyUrl = url;
  }

  const noteEl = document.getElementById('variant-note-text');
  if (noteEl) {
    if (!variant.note || variant.note.trim() === '') {
      document.getElementById('detail-note-container').style.display = 'none';
    } else {
      document.getElementById('detail-note-container').style.display = 'block';
      let lines = variant.note.split(/\r?\n/).filter(l => l.trim().length > 0);
      noteEl.innerHTML = lines.map(l => `<li>${l}</li>`).join('');
    }
  }
}

/* ─────────────────────────────────────
   11. EVENT DELEGATION (global)
───────────────────────────────────── */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  if (action === 'home') {
    e.preventDefault();
    window.location.hash = ''; // URL trả về gốc
  }

  if (action === 'back') {
    // Nếu có lịch sử trình duyệt, lùi lại. Nếu k có, quay về trang chủ.
    if (window.history.length > 2) {
      window.history.back();
    } else {
      window.location.hash = '';
    }
  }

  if (action === 'filter') {
    e.preventDefault();
    const cat = el.dataset.cat;
    State.filter = cat;
    renderChips();
    renderProducts();
    if (State.view !== 'catalog') showView('catalog');
    setTimeout(() => {
      const sec = document.getElementById('section-cats');
      if (sec) sec.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  if (action === 'detail') {
    const id = el.dataset.id;
    window.location.hash = 'product=' + id;
  }

  if (action === 'reset-filter') {
    State.filter = 'all';
    State.searchQuery = '';
    const inp = document.getElementById('search-input');
    if (inp) inp.value = '';
    renderChips();
    renderProducts();
  }
});

/* Buy button */
document.addEventListener('click', e => {
  const btn = e.target.closest('#buy-btn');
  if (!btn || btn.disabled) return;
  const url = btn.dataset.tallyUrl;
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
});

/* Sticky buy button (mobile) 
document.addEventListener('click', e => {
  const btn = e.target.closest('#sticky-buy-btn');
  if (!btn || btn.disabled) return;
  const url = btn.dataset.tallyUrl;
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
});*/

/* Product card click (anywhere on card except button) */
document.addEventListener('click', e => {
  const card = e.target.closest('.product-card');
  if (!card) return;
  if (e.target.closest('.btn-detail')) return;
  const id = card.dataset.productId;
  if (id) {
    window.location.hash = 'product=' + id;
  }
});

/* ─────────────────────────────────────
   12. SEARCH
───────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('search-input');
  if (!inp) return;
  inp.addEventListener('input', () => {
    State.searchQuery = inp.value;
    renderProducts();
  });
});

/* ─────────────────────────────────────
   13. INIT
───────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => { loadData(); });
