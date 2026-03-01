/* ==========================================================================
   OSRS Flip Tracker — app.js
   Full application logic: State, Router, API, Pages, Auth
   ========================================================================== */

// ===========================
// SECTION 1: APP STATE
// ===========================

const appState = {
  users: {},
  currentUser: null,
  sessionStart: Date.now(),
  flips: [],
  flipIdCounter: 1,
  watchlist: [],
  watchlistNames: { default: 'My Watchlist' },
  settings: { displayName: '', apiKey: '' },
  // API cache
  mapping: [],
  mappingById: {},
  latestPrices: {},
  hourlyPrices: {},
  fiveMinPrices: {},
  lastFetch: 0,
  // Scanner state
  scannerFilter: 'all',
  scannerSort: { key: 'marginTax', dir: 'desc' },
  scannerSearch: '',
  scannerDisplayed: 200,
  scannerItems: [],
  // Item modal
  currentItemId: null,
  itemChart: null,
  // Stats chart
  statsChart: null,
  // Flip modal state
  flipEditId: null,
  advanceFlipId: null,
  deleteFlipId: null,
  // Timers
  refreshTimer: null,
  sessionTimer: null,
  updateTimerInterval: null,
};

// ===========================
// SECTION 2: UTILITY FUNCTIONS
// ===========================

function formatGP(n) {
  if (n == null || isNaN(n)) return '0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return sign + (abs / 1_000_000_000).toFixed(1) + 'B';
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000) return sign + (abs / 1_000).toFixed(1) + 'K';
  return sign + abs.toLocaleString('en-US');
}

function formatGPFull(n) {
  if (n == null || isNaN(n)) return '0';
  return n.toLocaleString('en-US');
}

function parseGPInput(str) {
  if (!str) return 0;
  const cleaned = str.replace(/,/g, '').replace(/\s/g, '');
  const multipliers = { k: 1000, m: 1000000, b: 1000000000 };
  const match = cleaned.match(/^(-?\d+\.?\d*)\s*([kmb])?$/i);
  if (!match) return parseInt(cleaned) || 0;
  const num = parseFloat(match[1]);
  const mul = match[2] ? multipliers[match[2].toLowerCase()] : 1;
  return Math.floor(num * mul);
}

function calcTax(sellPrice) {
  return Math.min(Math.floor(sellPrice * 0.01), 5000000);
}

function calcMarginAfterTax(high, low) {
  return (high - low) - calcTax(high);
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function getItemIcon(item) {
  if (!item || !item.icon) return '';
  return 'https://oldschool.runescape.wiki/images/' + item.icon.replace(/ /g, '_');
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  // Add icon based on type
  const iconMap = { success: 'check-circle', error: 'x-circle', info: 'info' };
  const iconName = iconMap[type] || 'info';
  t.innerHTML = `<i data-lucide="${iconName}" class="toast-icon"></i><span>${msg}</span>`;
  container.appendChild(t);
  lucide.createIcons({ nameAttr: 'data-lucide', node: t });
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; }, 2500);
  setTimeout(() => t.remove(), 3000);
}

function debounce(fn, ms) {
  let tid;
  return function (...args) {
    clearTimeout(tid);
    tid = setTimeout(() => fn.apply(this, args), ms);
  };
}

function profitClass(n) {
  if (n > 0) return 'profit';
  if (n < 0) return 'loss';
  return '';
}

// ===========================
// SECTION 3: ROUTER
// ===========================

const PAGES = ['scanner', 'flips', 'calculator', 'watchlist', 'stats', 'guides', 'settings'];

function route() {
  let hash = (location.hash || '#scanner').slice(1);
  if (!PAGES.includes(hash)) hash = 'scanner';

  PAGES.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.style.display = p === hash ? 'block' : 'none';
  });

  // Update sidebar
  document.querySelectorAll('.nav-item, .bottom-item').forEach(a => {
    a.classList.toggle('active', a.dataset.page === hash);
  });

  // Page-specific init
  if (hash === 'scanner') renderScanner();
  if (hash === 'flips') renderKanban();
  if (hash === 'watchlist') renderWatchlist();
  if (hash === 'stats') renderStats();
  if (hash === 'guides') showGuide('101', document.querySelector('.guides-tabs .pill'));
  if (hash === 'calculator') updateCalc();
  if (hash === 'settings') initSettings();

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');

  lucide.createIcons();
}

window.addEventListener('hashchange', route);

// ===========================
// SECTION 4: API CLIENT
// ===========================

const API_BASE = 'https://prices.runescape.wiki/api/v1/osrs';
const API_HEADERS = { 'User-Agent': 'osrs-flip-tracker - @VibeGoette on GitHub' };

async function apiFetch(url) {
  const res = await fetch(url, { headers: API_HEADERS });
  if (!res.ok) throw new Error('API error: ' + res.status);
  return res.json();
}

async function loadMapping() {
  try {
    const data = await apiFetch(API_BASE + '/mapping');
    appState.mapping = data;
    appState.mappingById = {};
    data.forEach(item => { appState.mappingById[item.id] = item; });
  } catch (e) {
    console.error('Failed to load mapping:', e);
    showToast('Failed to load item data', 'error');
  }
}

async function loadPrices() {
  try {
    const [latest, hourly, fiveMin] = await Promise.all([
      apiFetch(API_BASE + '/latest'),
      apiFetch(API_BASE + '/1h'),
      apiFetch(API_BASE + '/5m'),
    ]);
    appState.latestPrices = latest.data || {};
    appState.hourlyPrices = hourly.data || {};
    appState.fiveMinPrices = fiveMin.data || {};
    appState.lastFetch = Date.now();
    updateTimerDisplay();
  } catch (e) {
    console.error('Failed to load prices:', e);
    showToast('Failed to load prices', 'error');
  }
}

async function loadTimeseries(itemId, timestep = '1h') {
  try {
    return await apiFetch(`${API_BASE}/timeseries?id=${itemId}&timestep=${timestep}`);
  } catch (e) {
    console.error('Timeseries error:', e);
    return null;
  }
}

function updateTimerDisplay() {
  const badge = document.getElementById('update-timer');
  if (!badge) return;
  const s = Math.floor((Date.now() - appState.lastFetch) / 1000);
  badge.textContent = s + 's ago';
}

// ===========================
// SECTION 5: SCANNER PAGE
// ===========================

function buildScannerItems() {
  const items = [];
  for (const item of appState.mapping) {
    const price = appState.latestPrices[item.id];
    if (!price || !price.high || !price.low) continue;
    if (price.high <= 0 || price.low <= 0) continue;

    const hourly = appState.hourlyPrices[item.id];
    const volume = hourly ? (hourly.highPriceVolume || 0) + (hourly.lowPriceVolume || 0) : 0;
    const margin = price.high - price.low;
    const marginTax = calcMarginAfterTax(price.high, price.low);
    const roi = price.low > 0 ? (marginTax / price.low) * 100 : 0;

    items.push({
      id: item.id,
      name: item.name,
      icon: item.icon,
      members: item.members,
      high: price.high,
      low: price.low,
      margin,
      marginTax,
      roi,
      volume,
      alch: item.highalch || 0,
      limit: item.limit || 0,
    });
  }
  return items;
}

function filterScannerItems(items) {
  let filtered = items;
  const search = appState.scannerSearch.toLowerCase();

  if (search) {
    filtered = filtered.filter(i => i.name.toLowerCase().includes(search));
  }

  switch (appState.scannerFilter) {
    case 'best':
      filtered = filtered.filter(i => i.marginTax > 500 && i.volume > 100);
      break;
    case 'volume':
      break;
    case 'f2p':
      filtered = filtered.filter(i => !i.members);
      break;
    case 'members':
      filtered = filtered.filter(i => i.members);
      break;
  }

  return filtered;
}

function sortScannerItems(items) {
  const { key, dir } = appState.scannerSort;
  const mult = dir === 'asc' ? 1 : -1;

  if (appState.scannerFilter === 'volume' && key === 'marginTax') {
    items.sort((a, b) => (b.volume - a.volume));
    return items;
  }

  items.sort((a, b) => {
    let va = a[key], vb = b[key];
    if (key === 'name') {
      return mult * va.localeCompare(vb);
    }
    return mult * (va - vb);
  });
  return items;
}

function renderScanner() {
  if (appState.mapping.length === 0) return;

  const loading = document.getElementById('scanner-loading');
  loading.style.display = 'none';

  const items = buildScannerItems();
  const filtered = filterScannerItems(items);
  const sorted = sortScannerItems(filtered);
  appState.scannerItems = sorted;

  document.getElementById('scanner-count').textContent = sorted.length + ' items';
  document.getElementById('scanner-updated').textContent = appState.lastFetch ? 'Updated ' + timeAgo(appState.lastFetch) : 'Loading...';

  const tbody = document.getElementById('scanner-tbody');
  const displayCount = Math.min(appState.scannerDisplayed, sorted.length);

  const rows = [];
  for (let i = 0; i < displayCount; i++) {
    const item = sorted[i];
    rows.push(buildScannerRow(item));
  }
  tbody.innerHTML = rows.join('');

  const loadMore = document.getElementById('load-more-wrap');
  loadMore.style.display = displayCount < sorted.length ? 'block' : 'none';
  if (displayCount < sorted.length) {
    document.getElementById('load-more-btn').textContent = `Load More (${displayCount} of ${sorted.length})`;
  }

  updateSortIndicators();
  lucide.createIcons();
}

function buildScannerRow(item) {
  const iconUrl = getItemIcon(appState.mappingById[item.id]);
  const isWatched = appState.watchlist.includes(item.id);
  return `<tr>
    <td class="col-icon"><img src="${iconUrl}" alt="" width="30" height="30" loading="lazy" style="image-rendering:pixelated" onerror="this.style.display='none'"></td>
    <td class="col-name"><span class="item-name" onclick="openItemModal(${item.id})">${item.name}</span></td>
    <td class="col-num gp-value">${formatGP(item.high)}</td>
    <td class="col-num gp-value">${formatGP(item.low)}</td>
    <td class="col-num"><span class="${profitClass(item.margin)}">${formatGP(item.margin)}</span></td>
    <td class="col-num"><span class="${profitClass(item.marginTax)}">${formatGP(item.marginTax)}</span></td>
    <td class="col-num"><span class="${item.roi > 0 ? 'profit' : item.roi < 0 ? 'loss' : ''}">${item.roi.toFixed(1)}%</span></td>
    <td class="col-num tabnum">${item.volume.toLocaleString('en-US')}</td>
    <td class="col-num gp-value">${item.alch > 0 ? formatGP(item.alch) : '—'}</td>
    <td class="col-actions"><div class="action-btns">
      <button class="icon-btn" aria-label="Quick Flip" onclick="quickFlip(${item.id})" title="Quick Flip"><i data-lucide="clipboard-plus"></i></button>
      <button class="icon-btn" aria-label="${isWatched ? 'Remove from Watchlist' : 'Add to Watchlist'}" onclick="toggleWatchlist(${item.id})" title="Watchlist"><i data-lucide="${isWatched ? 'star' : 'star'}" ${isWatched ? 'style="color:var(--gold);fill:var(--gold)"' : ''}></i></button>
    </div></td>
  </tr>`;
}

function loadMoreScannerRows() {
  appState.scannerDisplayed += 200;
  renderScanner();
}

function toggleScannerSort(key) {
  if (appState.scannerSort.key === key) {
    appState.scannerSort.dir = appState.scannerSort.dir === 'desc' ? 'asc' : 'desc';
  } else {
    appState.scannerSort.key = key;
    appState.scannerSort.dir = 'desc';
  }
  appState.scannerDisplayed = 200;
  renderScanner();
}

function updateSortIndicators() {
  document.querySelectorAll('#scanner-table th.sortable').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    const icon = th.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', 'arrow-up-down');
      icon.style.opacity = '0.4';
    }
  });
  const activeTh = document.querySelector(`#scanner-table th[data-sort="${appState.scannerSort.key}"]`);
  if (activeTh) {
    const cls = 'sorted-' + appState.scannerSort.dir;
    activeTh.classList.add(cls);
    const icon = activeTh.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', appState.scannerSort.dir === 'asc' ? 'arrow-up' : 'arrow-down');
      icon.style.opacity = '1';
    }
  }
}

function setScannerFilter(filter, btn) {
  appState.scannerFilter = filter;
  appState.scannerDisplayed = 200;
  document.querySelectorAll('.filter-pills .pill').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderScanner();
}

// Search debounce
const scannerSearchInput = document.getElementById('scanner-search');
if (scannerSearchInput) {
  scannerSearchInput.addEventListener('input', debounce(function () {
    appState.scannerSearch = this.value;
    appState.scannerDisplayed = 200;
    renderScanner();
  }, 300));
}

// ===========================
// SECTION 6: ITEM DETAIL MODAL
// ===========================

function openItemModal(itemId) {
  appState.currentItemId = itemId;
  const item = appState.mappingById[itemId];
  const price = appState.latestPrices[itemId];
  if (!item || !price) return;

  document.getElementById('item-modal-icon').src = getItemIcon(item);
  document.getElementById('item-modal-name').textContent = item.name;

  const hourly = appState.hourlyPrices[itemId];
  const vol = hourly ? (hourly.highPriceVolume || 0) + (hourly.lowPriceVolume || 0) : 0;
  const margin = (price.high || 0) - (price.low || 0);
  const marginTax = calcMarginAfterTax(price.high || 0, price.low || 0);

  document.getElementById('item-modal-stats').innerHTML = `
    <div class="item-stat"><span class="item-stat-label">Buy Price</span><span class="item-stat-value gp-value">${formatGPFull(price.high)}</span></div>
    <div class="item-stat"><span class="item-stat-label">Sell Price</span><span class="item-stat-value gp-value">${formatGPFull(price.low)}</span></div>
    <div class="item-stat"><span class="item-stat-label">Margin (tax)</span><span class="item-stat-value ${profitClass(marginTax)}">${formatGPFull(marginTax)}</span></div>
    <div class="item-stat"><span class="item-stat-label">Volume (1h)</span><span class="item-stat-value tabnum">${vol.toLocaleString()}</span></div>
    <div class="item-stat"><span class="item-stat-label">High Alch</span><span class="item-stat-value gp-value">${item.highalch ? formatGPFull(item.highalch) : '—'}</span></div>
    <div class="item-stat"><span class="item-stat-label">Buy Limit</span><span class="item-stat-value tabnum">${item.limit ? item.limit.toLocaleString() : '—'}</span></div>
  `;

  document.getElementById('item-modal').style.display = 'flex';
  document.querySelectorAll('.chart-controls .btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.chart-controls .btn[data-ts="1h"]').classList.add('active');
  loadItemChartData(itemId, '1h');
  lucide.createIcons();
}

function closeItemModal() {
  document.getElementById('item-modal').style.display = 'none';
  if (appState.itemChart) { appState.itemChart.destroy(); appState.itemChart = null; }
}

function loadItemChart(btn) {
  document.querySelectorAll('.chart-controls .btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadItemChartData(appState.currentItemId, btn.dataset.ts);
}

async function loadItemChartData(itemId, timestep) {
  const canvas = document.getElementById('item-chart');
  if (appState.itemChart) { appState.itemChart.destroy(); appState.itemChart = null; }

  const data = await loadTimeseries(itemId, timestep);
  if (!data || !data.data || data.data.length === 0) return;

  const points = data.data.slice(-100);
  const labels = points.map(p => {
    const d = new Date(p.timestamp * 1000);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  });
  const highs = points.map(p => p.avgHighPrice);
  const lows = points.map(p => p.avgLowPrice);

  appState.itemChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Buy (Insta-buy)', data: highs, borderColor: '#ff981f', backgroundColor: 'rgba(255,152,31,0.1)', fill: false, tension: 0.3, pointRadius: 0, borderWidth: 2 },
        { label: 'Sell (Insta-sell)', data: lows, borderColor: '#5dadec', backgroundColor: 'rgba(93,173,236,0.1)', fill: false, tension: 0.3, pointRadius: 0, borderWidth: 2 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: true, labels: { color: '#999', font: { size: 11 }, boxWidth: 12 } },
        tooltip: {
          backgroundColor: '#1a1a1a', borderColor: '#3a3a3a', borderWidth: 1,
          titleColor: '#fff', bodyColor: '#c8c8c8',
          callbacks: { label: ctx => ctx.dataset.label + ': ' + (ctx.parsed.y ? ctx.parsed.y.toLocaleString() + ' GP' : 'N/A') }
        }
      },
      scales: {
        x: { ticks: { color: '#666', font: { size: 10 }, maxTicksLimit: 8 }, grid: { color: 'rgba(58,58,58,0.3)' } },
        y: { ticks: { color: '#666', font: { size: 10 }, callback: v => formatGP(v) }, grid: { color: 'rgba(58,58,58,0.3)' } }
      }
    }
  });
}

function quickFlipFromModal() {
  const id = appState.currentItemId;
  closeItemModal();
  quickFlip(id);
}

function addToWatchlistFromModal() {
  toggleWatchlist(appState.currentItemId);
  closeItemModal();
}

// ===========================
// SECTION 7: GE TAX CALCULATOR
// ===========================

let calcSelectedItem = null;

function onCalcItemSearch(val) {
  const results = document.getElementById('calc-item-results');
  if (!val || val.length < 2) { results.classList.remove('open'); return; }
  const matches = appState.mapping.filter(i => i.name.toLowerCase().includes(val.toLowerCase())).slice(0, 15);
  if (matches.length === 0) { results.classList.remove('open'); return; }
  results.innerHTML = matches.map(i => `<div class="ac-item" onclick="selectCalcItem(${i.id})"><img src="${getItemIcon(i)}" alt="" width="24" height="24" onerror="this.style.display='none'">${i.name}</div>`).join('');
  results.classList.add('open');
}

function selectCalcItem(id) {
  const item = appState.mappingById[id];
  const price = appState.latestPrices[id];
  calcSelectedItem = item;
  document.getElementById('calc-item-search').value = item.name;
  document.getElementById('calc-item-results').classList.remove('open');
  if (price) {
    document.getElementById('calc-buy').value = price.low || '';
    document.getElementById('calc-sell').value = price.high || '';
  }
  updateCalc();
}

function updateCalc() {
  const buy = parseGPInput(document.getElementById('calc-buy').value);
  const sell = parseGPInput(document.getElementById('calc-sell').value);
  const qty = parseInt(document.getElementById('calc-qty').value) || 1;

  const tax = calcTax(sell);
  const gross = sell - buy;
  const netUnit = sell - buy - tax;
  const totalNet = netUnit * qty;
  const totalTax = tax * qty;
  const roi = buy > 0 ? (netUnit / buy * 100) : 0;
  const breakeven = buy > 0 ? Math.ceil(buy / 0.99) : 0;

  const heroEl = document.getElementById('calc-total-profit');
  heroEl.textContent = formatGPFull(totalNet) + ' GP';
  heroEl.className = 'calc-hero-value ' + (totalNet > 0 ? 'profit' : totalNet < 0 ? 'loss' : 'gp-value');
  if (totalNet === 0) heroEl.style.color = 'var(--gold)';

  document.getElementById('calc-tax-unit').textContent = formatGPFull(tax);
  document.getElementById('calc-gross').textContent = formatGPFull(gross);
  const netEl = document.getElementById('calc-net-unit');
  netEl.textContent = formatGPFull(netUnit);
  netEl.className = 'calc-stat-value ' + profitClass(netUnit);
  document.getElementById('calc-total-tax').textContent = formatGPFull(totalTax);
  document.getElementById('calc-roi').textContent = roi.toFixed(2) + '%';
  document.getElementById('calc-roi').className = 'calc-stat-value ' + profitClass(roi);
  document.getElementById('calc-breakeven').textContent = formatGPFull(breakeven);

  if (calcSelectedItem && calcSelectedItem.limit) {
    document.getElementById('calc-limit').textContent = calcSelectedItem.limit.toLocaleString() + ' / 4h';
    const maxProfit = netUnit * calcSelectedItem.limit;
    const mpEl = document.getElementById('calc-max-profit');
    mpEl.textContent = formatGPFull(maxProfit);
    mpEl.className = 'calc-stat-value ' + profitClass(maxProfit);
  } else {
    document.getElementById('calc-limit').textContent = '—';
    document.getElementById('calc-max-profit').textContent = '—';
    document.getElementById('calc-max-profit').className = 'calc-stat-value';
  }
}

// Close autocomplete on outside click
document.addEventListener('click', function (e) {
  document.querySelectorAll('.autocomplete-results').forEach(r => {
    if (!r.parentElement.contains(e.target)) r.classList.remove('open');
  });
});

// ===========================
// SECTION 8: FLIP TASK CARDS (KANBAN)
// ===========================

const FLIP_STATES = ['planning', 'buying', 'bought', 'selling', 'sold', 'completed'];

function openFlipModal(itemId) {
  appState.flipEditId = null;
  document.getElementById('flip-item-search').value = '';
  document.getElementById('flip-item-id').value = '';
  document.getElementById('flip-buy-price').value = '';
  document.getElementById('flip-sell-price').value = '';
  document.getElementById('flip-qty').value = '1';
  document.getElementById('flip-note').value = '';

  if (itemId) {
    const item = appState.mappingById[itemId];
    const price = appState.latestPrices[itemId];
    if (item) {
      document.getElementById('flip-item-search').value = item.name;
      document.getElementById('flip-item-id').value = itemId;
    }
    if (price) {
      document.getElementById('flip-buy-price').value = price.low || '';
      document.getElementById('flip-sell-price').value = price.high || '';
    }
  }

  updateFlipCalc();
  document.getElementById('flip-modal').style.display = 'flex';
  lucide.createIcons();
}

function closeFlipModal() {
  document.getElementById('flip-modal').style.display = 'none';
  document.getElementById('flip-item-results').classList.remove('open');
}

function quickFlip(itemId) {
  openFlipModal(itemId);
}

function onFlipItemSearch(val) {
  const results = document.getElementById('flip-item-results');
  if (!val || val.length < 2) { results.classList.remove('open'); return; }
  const matches = appState.mapping.filter(i => i.name.toLowerCase().includes(val.toLowerCase())).slice(0, 15);
  if (matches.length === 0) { results.classList.remove('open'); return; }
  results.innerHTML = matches.map(i => `<div class="ac-item" onclick="selectFlipItem(${i.id})"><img src="${getItemIcon(i)}" alt="" width="24" height="24" onerror="this.style.display='none'">${i.name}</div>`).join('');
  results.classList.add('open');
}

function selectFlipItem(id) {
  const item = appState.mappingById[id];
  const price = appState.latestPrices[id];
  document.getElementById('flip-item-search').value = item.name;
  document.getElementById('flip-item-id').value = id;
  document.getElementById('flip-item-results').classList.remove('open');
  if (price) {
    document.getElementById('flip-buy-price').value = price.low || '';
    document.getElementById('flip-sell-price').value = price.high || '';
  }
  updateFlipCalc();
}

function updateFlipCalc() {
  const buy = parseGPInput(document.getElementById('flip-buy-price').value);
  const sell = parseGPInput(document.getElementById('flip-sell-price').value);
  const qty = parseInt(document.getElementById('flip-qty').value) || 1;

  const tax = calcTax(sell);
  const net = sell - buy - tax;
  const total = net * qty;
  const roi = buy > 0 ? (net / buy * 100) : 0;
  const breakeven = buy > 0 ? Math.ceil(buy / 0.99) : 0;

  document.getElementById('fc-tax').textContent = formatGPFull(tax);
  const profUnitEl = document.getElementById('fc-profit-unit');
  profUnitEl.textContent = formatGPFull(net);
  profUnitEl.className = profitClass(net);
  const totalEl = document.getElementById('fc-total-profit');
  totalEl.textContent = formatGPFull(total) + ' GP';
  totalEl.className = 'gp-value ' + profitClass(total);
  document.getElementById('fc-roi').textContent = roi.toFixed(1) + '%';
  document.getElementById('fc-breakeven').textContent = formatGPFull(breakeven);
}

function createFlip() {
  const itemId = parseInt(document.getElementById('flip-item-id').value);
  const item = appState.mappingById[itemId];
  if (!item) { showToast('Please select an item', 'error'); return; }

  const buy = parseGPInput(document.getElementById('flip-buy-price').value);
  const sell = parseGPInput(document.getElementById('flip-sell-price').value);
  const qty = parseInt(document.getElementById('flip-qty').value) || 1;
  const note = document.getElementById('flip-note').value.trim();

  const tax = calcTax(sell);
  const expectedProfit = (sell - buy - tax) * qty;

  const flip = {
    id: appState.flipIdCounter++,
    itemId,
    itemName: item.name,
    itemIcon: item.icon,
    targetBuy: buy,
    targetSell: sell,
    actualBuy: null,
    actualSell: null,
    quantity: qty,
    note,
    status: 'planning',
    expectedProfit,
    actualProfit: null,
    createdAt: Date.now(),
    completedAt: null,
  };

  appState.flips.push(flip);
  closeFlipModal();
  renderKanban();
  showToast('Flip created: ' + item.name, 'success');
}

function renderKanban() {
  FLIP_STATES.forEach(status => {
    const container = document.getElementById('cards-' + status);
    const count = document.getElementById('count-' + status);
    const flips = appState.flips.filter(f => f.status === status);
    count.textContent = flips.length;
    container.innerHTML = flips.map(f => buildFlipCard(f)).join('');
  });
  lucide.createIcons();
}

function buildFlipCard(flip) {
  const iconUrl = getItemIcon(appState.mappingById[flip.itemId]);
  const tax = calcTax(flip.targetSell);
  const expectedPerUnit = flip.targetSell - flip.targetBuy - tax;
  const displayProfit = flip.actualProfit != null ? flip.actualProfit : flip.expectedProfit;

  let comparisonHtml = '';
  if (flip.status === 'completed' && flip.actualProfit != null) {
    const diff = flip.actualProfit - flip.expectedProfit;
    comparisonHtml = `<div class="flip-card-comparison">
      <div class="comp-row"><span>Expected</span><span class="${profitClass(flip.expectedProfit)}">${formatGP(flip.expectedProfit)} GP</span></div>
      <div class="comp-row"><span>Actual</span><span class="${profitClass(flip.actualProfit)}">${formatGP(flip.actualProfit)} GP</span></div>
      <div class="comp-row"><span>Difference</span><span class="${profitClass(diff)}">${diff >= 0 ? '+' : ''}${formatGP(diff)} GP</span></div>
    </div>`;
  }

  const noteHtml = flip.note ? `<div class="flip-card-note">${flip.note}</div>` : '';
  const nextState = FLIP_STATES[FLIP_STATES.indexOf(flip.status) + 1];
  const advanceBtn = nextState ? `<button class="icon-btn" aria-label="Advance" title="Move to ${nextState}" onclick="advanceFlip(${flip.id})"><i data-lucide="arrow-right-circle"></i></button>` : '';

  return `<div class="flip-card" draggable="true" ondragstart="onDragStart(event, ${flip.id})" ondragend="onDragEnd(event)" data-flip-id="${flip.id}">
    <div class="flip-card-top">
      <img src="${iconUrl}" alt="" width="28" height="28" onerror="this.style.display='none'">
      <span class="flip-card-name">${flip.itemName}</span>
    </div>
    <div class="flip-card-prices">
      <span>Buy: <span class="val">${formatGP(flip.actualBuy || flip.targetBuy)}</span></span>
      <span>Sell: <span class="val">${formatGP(flip.actualSell || flip.targetSell)}</span></span>
      <span>Qty: <span class="val">${flip.quantity}</span></span>
      <span>ROI: <span class="val">${flip.targetBuy > 0 ? (expectedPerUnit / flip.targetBuy * 100).toFixed(1) : 0}%</span></span>
    </div>
    <div class="flip-card-profit ${profitClass(displayProfit)}">${displayProfit >= 0 ? '+' : ''}${formatGP(displayProfit)} GP</div>
    ${noteHtml}
    ${comparisonHtml}
    <div class="flip-card-meta">
      <span>${timeAgo(flip.createdAt)}</span>
      <div class="flip-card-actions">
        ${advanceBtn}
        <button class="icon-btn" aria-label="Delete" title="Delete flip" onclick="confirmDeleteFlip(${flip.id})"><i data-lucide="trash-2"></i></button>
      </div>
    </div>
  </div>`;
}

// Drag and Drop
function onDragStart(e, flipId) {
  e.dataTransfer.setData('text/plain', flipId);
  e.target.classList.add('dragging');
}
function onDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.kanban-cards').forEach(c => c.classList.remove('drag-over'));
}
function onDragOver(e) {
  e.preventDefault();
  const cards = e.target.closest('.kanban-cards') || e.target.querySelector('.kanban-cards');
  if (cards) cards.classList.add('drag-over');
}
function onDrop(e, status) {
  e.preventDefault();
  const flipId = parseInt(e.dataTransfer.getData('text/plain'));
  const flip = appState.flips.find(f => f.id === flipId);
  if (flip) {
    flip.status = status;
    if (status === 'completed') flip.completedAt = Date.now();
    renderKanban();
    showToast('Flip moved to ' + status, 'info');
  }
  document.querySelectorAll('.kanban-cards').forEach(c => c.classList.remove('drag-over'));
}

// Advance flip
function advanceFlip(flipId) {
  const flip = appState.flips.find(f => f.id === flipId);
  if (!flip) return;
  const nextIdx = FLIP_STATES.indexOf(flip.status) + 1;
  if (nextIdx >= FLIP_STATES.length) return;
  const nextStatus = FLIP_STATES[nextIdx];

  // Show advance modal
  appState.advanceFlipId = flipId;
  const modal = document.getElementById('advance-modal');
  const priceGroup = document.getElementById('advance-price-group');
  const priceLabel = document.getElementById('advance-price-label');
  const msg = document.getElementById('advance-msg');
  const title = document.getElementById('advance-modal-title');

  title.textContent = `Move to ${nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}`;

  if (nextStatus === 'bought') {
    priceGroup.style.display = 'block';
    priceLabel.textContent = 'Actual Buy Price (GP)';
    document.getElementById('advance-price-input').value = flip.targetBuy || '';
    msg.textContent = 'Enter the actual price you bought at.';
  } else if (nextStatus === 'sold') {
    priceGroup.style.display = 'block';
    priceLabel.textContent = 'Actual Sell Price (GP)';
    document.getElementById('advance-price-input').value = flip.targetSell || '';
    msg.textContent = 'Enter the actual price you sold at.';
  } else {
    priceGroup.style.display = 'none';
    msg.textContent = `Move this flip to "${nextStatus}"?`;
  }

  modal.style.display = 'flex';
  lucide.createIcons();
}

function confirmAdvance() {
  const flipId = appState.advanceFlipId;
  const flip = appState.flips.find(f => f.id === flipId);
  if (!flip) return;

  const nextIdx = FLIP_STATES.indexOf(flip.status) + 1;
  const nextStatus = FLIP_STATES[nextIdx];
  const priceInput = parseGPInput(document.getElementById('advance-price-input').value);

  flip.status = nextStatus;

  if (nextStatus === 'bought' && priceInput > 0) {
    flip.actualBuy = priceInput;
  }
  if (nextStatus === 'sold' && priceInput > 0) {
    flip.actualSell = priceInput;
  }
  if (nextStatus === 'completed') {
    flip.completedAt = Date.now();
    // Calculate actual profit
    const actualBuy = flip.actualBuy || flip.targetBuy;
    const actualSell = flip.actualSell || flip.targetSell;
    const tax = calcTax(actualSell);
    flip.actualProfit = (actualSell - actualBuy - tax) * flip.quantity;
  }

  closeAdvanceModal();
  renderKanban();
  renderStats();
  showToast('Flip advanced to ' + nextStatus, 'success');
}

function closeAdvanceModal() {
  document.getElementById('advance-modal').style.display = 'none';
  appState.advanceFlipId = null;
}

function confirmDeleteFlip(flipId) {
  appState.deleteFlipId = flipId;
  const modal = document.getElementById('delete-modal');
  modal.style.display = 'flex';
  document.getElementById('delete-confirm-btn').onclick = function () {
    appState.flips = appState.flips.filter(f => f.id !== flipId);
    closeDeleteModal();
    renderKanban();
    renderStats();
    showToast('Flip deleted', 'info');
  };
  lucide.createIcons();
}

function closeDeleteModal() {
  document.getElementById('delete-modal').style.display = 'none';
  appState.deleteFlipId = null;
}

// ===========================
// SECTION 9: WATCHLIST
// ===========================

function toggleWatchlist(itemId) {
  const idx = appState.watchlist.indexOf(itemId);
  if (idx === -1) {
    appState.watchlist.push(itemId);
    showToast('Added to watchlist', 'success');
  } else {
    appState.watchlist.splice(idx, 1);
    showToast('Removed from watchlist', 'info');
  }
  renderWatchlist();
}

function onWatchlistSearch(val) {
  const results = document.getElementById('watchlist-add-results');
  if (!val || val.length < 2) { results.classList.remove('open'); return; }
  const matches = appState.mapping.filter(i => i.name.toLowerCase().includes(val.toLowerCase())).slice(0, 15);
  if (matches.length === 0) { results.classList.remove('open'); return; }
  results.innerHTML = matches.map(i => `<div class="ac-item" onclick="addToWatchlistById(${i.id})"><img src="${getItemIcon(i)}" alt="" width="24" height="24" onerror="this.style.display='none'">${i.name}</div>`).join('');
  results.classList.add('open');
}

function addToWatchlistById(id) {
  if (!appState.watchlist.includes(id)) {
    appState.watchlist.push(id);
    showToast('Added to watchlist', 'success');
  }
  document.getElementById('watchlist-add-search').value = '';
  document.getElementById('watchlist-add-results').classList.remove('open');
  renderWatchlist();
}

function renderWatchlist() {
  const empty = document.getElementById('watchlist-empty');
  const table = document.getElementById('watchlist-table');
  const tbody = document.getElementById('watchlist-tbody');

  if (appState.watchlist.length === 0) {
    empty.style.display = 'flex';
    table.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  table.style.display = 'table';

  const rows = appState.watchlist.map(id => {
    const item = appState.mappingById[id];
    const price = appState.latestPrices[id];
    if (!item) return '';
    const high = price ? price.high : 0;
    const low = price ? price.low : 0;
    const margin = high - low;
    const hourly = appState.hourlyPrices[id];
    const vol = hourly ? (hourly.highPriceVolume || 0) + (hourly.lowPriceVolume || 0) : 0;
    const iconUrl = getItemIcon(item);
    return `<tr>
      <td class="col-icon"><img src="${iconUrl}" alt="" width="30" height="30" style="image-rendering:pixelated" onerror="this.style.display='none'"></td>
      <td class="col-name"><span class="item-name" onclick="openItemModal(${id})">${item.name}</span></td>
      <td class="col-num gp-value">${formatGP(high)}</td>
      <td class="col-num gp-value">${formatGP(low)}</td>
      <td class="col-num"><span class="${profitClass(margin)}">${formatGP(margin)}</span></td>
      <td class="col-num tabnum">${vol.toLocaleString('en-US')}</td>
      <td class="col-actions"><div class="action-btns">
        <button class="icon-btn" title="Quick Flip" onclick="quickFlip(${id})"><i data-lucide="clipboard-plus"></i></button>
        <button class="icon-btn" title="Remove" onclick="toggleWatchlist(${id})"><i data-lucide="x"></i></button>
      </div></td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rows;
  lucide.createIcons();
}

// ===========================
// SECTION 10: STATS
// ===========================

function renderStats() {
  const completed = appState.flips.filter(f => f.status === 'completed' && f.actualProfit != null);
  const totalProfit = completed.reduce((s, f) => s + f.actualProfit, 0);
  const totalTax = completed.reduce((s, f) => {
    const actualSell = f.actualSell || f.targetSell;
    return s + calcTax(actualSell) * f.quantity;
  }, 0);
  const avgRoi = completed.length > 0
    ? completed.reduce((s, f) => {
        const b = f.actualBuy || f.targetBuy;
        const sell = f.actualSell || f.targetSell;
        const tax = calcTax(sell);
        const roi = b > 0 ? (sell - b - tax) / b * 100 : 0;
        return s + roi;
      }, 0) / completed.length
    : 0;

  document.getElementById('kpi-profit').textContent = formatGP(totalProfit) + ' GP';
  document.getElementById('kpi-roi').textContent = avgRoi.toFixed(1) + '%';
  document.getElementById('kpi-flips').textContent = completed.length;
  document.getElementById('kpi-tax').textContent = formatGP(totalTax) + ' GP';

  const sessionMs = Date.now() - appState.sessionStart;
  const perHour = sessionMs > 0 ? (totalProfit / (sessionMs / 3600000)) : 0;
  document.getElementById('kpi-perhr').textContent = formatGP(Math.round(perHour)) + ' GP';

  // Item breakdown table
  const byItem = {};
  completed.forEach(f => {
    if (!byItem[f.itemId]) byItem[f.itemId] = { name: f.itemName, profit: 0, qty: 0, rois: [] };
    byItem[f.itemId].profit += f.actualProfit;
    byItem[f.itemId].qty += f.quantity;
    const b = f.actualBuy || f.targetBuy;
    const s = f.actualSell || f.targetSell;
    const t = calcTax(s);
    if (b > 0) byItem[f.itemId].rois.push((s - b - t) / b * 100);
  });

  const tbody = document.getElementById('stats-tbody');
  const empty = document.getElementById('stats-table-empty');
  const items = Object.entries(byItem).sort((a, b) => b[1].profit - a[1].profit);

  if (items.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    const item0 = appState.mappingById[items[0] ? parseInt(items[0][0]) : null];
    tbody.innerHTML = items.map(([id, data]) => {
      const item = appState.mappingById[parseInt(id)];
      const iconUrl = item ? getItemIcon(item) : '';
      const avgRoiItem = data.rois.length > 0 ? data.rois.reduce((a, b) => a + b, 0) / data.rois.length : 0;
      return `<tr>
        <td class="col-icon"><img src="${iconUrl}" alt="" width="30" height="30" style="image-rendering:pixelated" onerror="this.style.display='none'"></td>
        <td class="col-name">${data.name}</td>
        <td class="col-num"><span class="${profitClass(data.profit)}">${formatGP(data.profit)} GP</span></td>
        <td class="col-num tabnum">${data.qty}</td>
        <td class="col-num"><span class="${profitClass(avgRoiItem)}">${avgRoiItem.toFixed(1)}%</span></td>
      </tr>`;
    }).join('');
  }
  lucide.createIcons();

  // Stats chart
  const chartEmpty = document.getElementById('stats-chart-empty');
  const canvas = document.getElementById('stats-chart');

  if (completed.length < 2) {
    chartEmpty.style.display = 'block';
    canvas.style.display = 'none';
    if (appState.statsChart) { appState.statsChart.destroy(); appState.statsChart = null; }
    return;
  }

  chartEmpty.style.display = 'none';
  canvas.style.display = 'block';

  const sorted = [...completed].sort((a, b) => a.completedAt - b.completedAt);
  let cumProfit = 0;
  const chartLabels = sorted.map((f, i) => '#' + (i + 1));
  const chartData = sorted.map(f => { cumProfit += f.actualProfit; return cumProfit; });

  if (appState.statsChart) { appState.statsChart.destroy(); appState.statsChart = null; }

  appState.statsChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: chartLabels,
      datasets: [{
        label: 'Cumulative Profit',
        data: chartData,
        borderColor: '#00ff00',
        backgroundColor: 'rgba(0,255,0,0.06)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a1a', borderColor: '#3a3a3a', borderWidth: 1,
          titleColor: '#fff', bodyColor: '#c8c8c8',
          callbacks: { label: ctx => 'Profit: ' + formatGP(ctx.parsed.y) + ' GP' }
        }
      },
      scales: {
        x: { ticks: { color: '#666', font: { size: 10 } }, grid: { color: 'rgba(58,58,58,0.3)' } },
        y: { ticks: { color: '#666', font: { size: 10 }, callback: v => formatGP(v) }, grid: { color: 'rgba(58,58,58,0.3)' } }
      }
    }
  });
}

// ===========================
// SECTION 11: GUIDES
// ===========================

const GUIDES = {
  '101': `
    <h2>Flipping 101</h2>
    <p>Grand Exchange flipping is the art of buying items at a lower price and selling them for a profit. The GE is the central marketplace of Old School RuneScape — every item traded goes through it.</p>
    <h3>How it works</h3>
    <ul>
      <li>Place a <strong>buy offer</strong> slightly above the current sell price to buy quickly</li>
      <li>Wait for your item to be bought</li>
      <li>Place a <strong>sell offer</strong> slightly below the current buy price to sell quickly</li>
      <li>Collect your profit, minus the <strong>1% GE tax</strong> (capped at 5M GP)</li>
    </ul>
    <h3>Key Concepts</h3>
    <ul>
      <li><strong>Insta-buy price:</strong> The price at which your offer fills immediately (buy at the current offer price)</li>
      <li><strong>Insta-sell price:</strong> The price at which your item sells immediately</li>
      <li><strong>Margin:</strong> The difference between insta-buy and insta-sell prices</li>
      <li><strong>GE Tax:</strong> 1% of the sell price, capped at 5,000,000 GP per item</li>
      <li><strong>Buy Limit:</strong> Maximum quantity you can buy every 4 hours</li>
    </ul>
    <h3>Why it works</h3>
    <p>Prices constantly fluctuate due to supply and demand. Flippers profit from this spread by acting as market makers — buying from sellers and selling to buyers.</p>
  `,
  'first': `
    <h2>Your First Flip</h2>
    <p>New to flipping? Here's a step-by-step guide to making your first profit.</p>
    <h3>Step 1: Find an item to flip</h3>
    <p>Open the <strong>Scanner</strong> tab and sort by <strong>After Tax</strong> margin. Look for items with:</p>
    <ul>
      <li>Margin after tax <strong>&gt; 500 GP</strong></li>
      <li>Reasonable volume (the item actually trades)</li>
      <li>A price you can afford (start small!)</li>
    </ul>
    <h3>Step 2: Check the margin in-game</h3>
    <p>In-game, buy 1 of the item at a high price to find the insta-buy price. Then sell 1 at a low price to find the insta-sell price. This is called <strong>margin checking</strong>.</p>
    <h3>Step 3: Place your orders</h3>
    <ul>
      <li>Buy order: insta-sell price + 1-5 GP</li>
      <li>Sell order: insta-buy price - 1-5 GP</li>
    </ul>
    <h3>Step 4: Wait and collect</h3>
    <p>Check back periodically. When both orders fill, collect your profit. Use this tracker to record your flips and analyze performance.</p>
    <h3>Starting capital advice</h3>
    <p>With <strong>under 100K GP</strong>: Focus on cheap, high-volume items like runes, arrows, and low-level food.</p>
    <p>With <strong>1M+ GP</strong>: You can flip more expensive items with higher margins. The calculator tab can help estimate max profit at buy limits.</p>
  `,
  'limits': `
    <h2>Buy Limits</h2>
    <p>Every item in the GE has a <strong>buy limit</strong> — the maximum quantity you can buy in a 4-hour window.</p>
    <h3>Why limits exist</h3>
    <p>Jagex introduced buy limits to prevent market manipulation and ensure items remain accessible to all players. High-demand items tend to have lower limits to reduce hoarding.</p>
    <h3>Working around limits</h3>
    <ul>
      <li>Use multiple accounts (must be legitimate accounts you own)</li>
      <li>Rotate between different items</li>
      <li>Flip items with higher limits for more volume</li>
      <li>Time your offers around the 4-hour reset</li>
    </ul>
    <h3>Common buy limits</h3>
    <ul>
      <li><strong>Runes:</strong> 25,000 per 4h</li>
      <li><strong>Arrows/bolts:</strong> 11,000 per 4h</li>
      <li><strong>Food (lobsters, sharks):</strong> 1,500–3,000 per 4h</li>
      <li><strong>Potions:</strong> 2,000 per 4h</li>
      <li><strong>High-value items (whip, etc.):</strong> 8–70 per 4h</li>
    </ul>
    <p>The <strong>Calculator</strong> tab shows the buy limit for any item and calculates your <strong>Max Profit at Limit</strong> — the theoretical maximum profit per 4-hour window.</p>
  `,
  'advanced': `
    <h2>Advanced Flipping Tips</h2>
    <h3>High-alch flipping</h3>
    <p>Some items can be bought on the GE and high-alched for profit. Check if the <strong>Alch value</strong> in the Scanner exceeds the buy price + nature rune cost (~200 GP).</p>
    <h3>Merching vs. flipping</h3>
    <p><strong>Flipping</strong> involves quick turnover — buy and sell the same day. <strong>Merching</strong> involves holding items longer, betting on price increases. This tracker is designed for active flipping.</p>
    <h3>Margin squeezing</h3>
    <p>To get the best price, undercut the competition by 1 GP. On buy orders, offer 1 GP above the current highest buyer. On sell orders, list 1 GP below the lowest seller.</p>
    <h3>Volume flipping</h3>
    <p>Some items have small margins but huge volume. Flipping 10,000 runes at 5 GP profit each = 50K GP in minutes. Use the <strong>High Volume</strong> filter in the Scanner.</p>
    <h3>Reading price charts</h3>
    <p>Click any item in the Scanner to open its detail modal and view the price chart. Look for:</p>
    <ul>
      <li><strong>Stable spreads:</strong> Consistent margin between buy/sell</li>
      <li><strong>Trending items:</strong> Rising buy prices signal strong demand</li>
      <li><strong>Volatile items:</strong> Large swings = higher risk but higher reward</li>
    </ul>
    <h3>Protecting yourself</h3>
    <ul>
      <li>Never flip items you can't afford to lose</li>
      <li>Check volume before investing — low volume = slow sales</li>
      <li>Be aware of update cycles — game updates can crash or spike item prices</li>
    </ul>
  `
};

function showGuide(key, btn) {
  if (!GUIDES[key]) return;
  document.getElementById('guide-content').innerHTML = GUIDES[key];
  document.querySelectorAll('.guides-tabs .pill').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// ===========================
// SECTION 12: SETTINGS
// ===========================

function initSettings() {
  document.getElementById('settings-name').value = appState.settings.displayName || '';
  document.getElementById('settings-api-key').value = appState.settings.apiKey || '';
}

function updateSettingsName(val) {
  appState.settings.displayName = val;
}

function generateApiKey() {
  const key = 'osrs_' + Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
  appState.settings.apiKey = key;
  document.getElementById('settings-api-key').value = key;
  showToast('API key generated', 'success');
}

function exportFlips() {
  const data = JSON.stringify(appState.flips, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'osrs-flips-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Flips exported', 'success');
}

function clearAllData() {
  if (!confirm('Are you sure? This will delete all your flips, watchlist, and settings.')) return;
  appState.flips = [];
  appState.watchlist = [];
  appState.settings = { displayName: '', apiKey: '' };
  appState.flipIdCounter = 1;
  renderKanban();
  renderStats();
  renderWatchlist();
  initSettings();
  showToast('All data cleared', 'info');
}

// ===========================
// SECTION 13: AUTH
// ===========================

let authMode = 'login';

function openAuthModal() {
  if (appState.currentUser) {
    // Show logout option
    if (confirm(`Logged in as "${appState.currentUser}". Log out?`)) {
      appState.currentUser = null;
      updateAuthUI();
      showToast('Logged out', 'info');
    }
    return;
  }
  authMode = 'login';
  document.getElementById('auth-modal-title').textContent = 'Login';
  document.getElementById('auth-submit-btn').textContent = 'Login';
  document.getElementById('auth-toggle-btn').textContent = 'Need an account? Register';
  document.getElementById('auth-error').textContent = '';
  document.getElementById('auth-username').value = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-modal').style.display = 'flex';
  lucide.createIcons();
}

function closeAuthModal() {
  document.getElementById('auth-modal').style.display = 'none';
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  if (authMode === 'register') {
    document.getElementById('auth-modal-title').textContent = 'Register';
    document.getElementById('auth-submit-btn').textContent = 'Create Account';
    document.getElementById('auth-toggle-btn').textContent = 'Already have an account? Login';
  } else {
    document.getElementById('auth-modal-title').textContent = 'Login';
    document.getElementById('auth-submit-btn').textContent = 'Login';
    document.getElementById('auth-toggle-btn').textContent = 'Need an account? Register';
  }
  document.getElementById('auth-error').textContent = '';
}

function togglePasswordVisibility() {
  const input = document.getElementById('auth-password');
  const btn = document.querySelector('.password-toggle i');
  if (input.type === 'password') {
    input.type = 'text';
    btn.setAttribute('data-lucide', 'eye');
  } else {
    input.type = 'password';
    btn.setAttribute('data-lucide', 'eye-off');
  }
  lucide.createIcons();
}

function handleAuthSubmit() {
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  const errorEl = document.getElementById('auth-error');

  if (!username || !password) {
    errorEl.textContent = 'Please fill in all fields';
    return;
  }
  if (username.length < 2) {
    errorEl.textContent = 'Username must be at least 2 characters';
    return;
  }
  if (password.length < 4) {
    errorEl.textContent = 'Password must be at least 4 characters';
    return;
  }

  if (authMode === 'register') {
    if (appState.users[username]) {
      errorEl.textContent = 'Username already taken';
      return;
    }
    // Simple hash (not secure, just demo)
    appState.users[username] = { password };
    appState.currentUser = username;
    closeAuthModal();
    updateAuthUI();
    showToast('Account created! Welcome, ' + username, 'success');
  } else {
    const user = appState.users[username];
    if (!user || user.password !== password) {
      errorEl.textContent = 'Invalid username or password';
      return;
    }
    appState.currentUser = username;
    closeAuthModal();
    updateAuthUI();
    showToast('Welcome back, ' + username + '!', 'success');
  }
}

function continueAsGuest() {
  closeAuthModal();
  showToast('Continuing as guest', 'info');
}

function updateAuthUI() {
  const btn = document.getElementById('auth-btn');
  const label = document.getElementById('auth-btn-label');
  if (appState.currentUser) {
    label.textContent = appState.currentUser;
  } else {
    label.textContent = 'Login';
  }
}

// ===========================
// SECTION 14: SIDEBAR & MOBILE
// ===========================

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function (e) {
    if (e.target === this) {
      this.style.display = 'none';
      if (appState.itemChart && this.id === 'item-modal') {
        appState.itemChart.destroy();
        appState.itemChart = null;
      }
    }
  });
});

// ===========================
// SECTION 15: SESSION TIMER
// ===========================

function startSessionTimer() {
  appState.sessionTimer = setInterval(() => {
    const el = document.getElementById('kpi-session');
    if (el) {
      el.innerHTML = '<span class="session-live-dot"></span>' + formatDuration(Date.now() - appState.sessionStart);
    }
  }, 1000);
}

// ===========================
// SECTION 16: INIT
// ===========================

async function init() {
  // Show scanner loading state immediately
  document.getElementById('scanner-loading').style.display = 'flex';

  // Load data
  await loadMapping();
  await loadPrices();

  // Route to current page
  route();

  // Set up auto-refresh every 60s
  appState.refreshTimer = setInterval(async () => {
    await loadPrices();
    // Re-render current page
    const hash = (location.hash || '#scanner').slice(1);
    if (hash === 'scanner') renderScanner();
    if (hash === 'watchlist') renderWatchlist();
  }, 60000);

  // Update timer display every second
  appState.updateTimerInterval = setInterval(updateTimerDisplay, 1000);

  // Start session timer
  startSessionTimer();
}

init();