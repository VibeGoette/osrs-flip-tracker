/* ==========================================================================
   OSRS Flip Tracker — app.js
   Complete application logic
========================================================================== */

'use strict';

/* ---------- Constants ---------- */
const STORAGE_KEY = 'osrsFlipTracker_v2';
const AUTH_KEY    = 'osrsFlipTracker_auth';
const GE_TAX_RATE = 0.01; // 1% GE tax

/* ---------- State ---------- */
let flips      = [];
let currentUser = null;
let editingId  = null;
let deleteId   = null;
let chartRange = '7d';
let profitChart = null;
let dailyChart  = null;
let itemChart   = null;
let roiChart    = null;
let timerInterval = null;
let sessionStart  = null;

/* ==========================================================================
   Persistence
========================================================================== */
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      flips = Array.isArray(parsed.flips) ? parsed.flips : [];
    }
  } catch (e) {
    console.warn('Failed to load data:', e);
    flips = [];
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ flips, version: 2 }));
  } catch (e) {
    console.warn('Failed to save data:', e);
  }
}

function loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) currentUser = JSON.parse(raw);
  } catch (e) {
    currentUser = null;
  }
}

function saveAuth() {
  try {
    if (currentUser) localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
    else localStorage.removeItem(AUTH_KEY);
  } catch (e) {}
}

/* ==========================================================================
   Auth
========================================================================== */
let authMode = 'login'; // 'login' | 'register'

function openAuthModal(mode = 'login') {
  authMode = mode;
  const modal = document.getElementById('auth-modal');
  const title = document.getElementById('auth-modal-title');
  const submitBtn = document.getElementById('auth-submit-btn');
  const switchText = document.getElementById('auth-switch-text');
  if (mode === 'login') {
    title.textContent = 'Login';
    submitBtn.textContent = 'Login';
    switchText.innerHTML = `Don't have an account? <a href="#" onclick="switchAuthMode()">Register</a>`;
  } else {
    title.textContent = 'Register';
    submitBtn.textContent = 'Create Account';
    switchText.innerHTML = `Already have an account? <a href="#" onclick="switchAuthMode()">Login</a>`;
  }
  clearAuthError();
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('auth-username').focus(), 50);
}

function closeAuthModal() {
  document.getElementById('auth-modal').style.display = 'none';
  clearAuthError();
}

function switchAuthMode() {
  openAuthModal(authMode === 'login' ? 'register' : 'login');
}

function clearAuthError() {
  const el = document.getElementById('auth-error');
  el.textContent = '';
  el.style.display = 'none';
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function togglePasswordVisibility() {
  const input = document.getElementById('auth-password');
  const icon  = document.getElementById('pw-eye-icon');
  if (input.type === 'password') {
    input.type = 'text';
    icon.setAttribute('data-lucide', 'eye-off');
  } else {
    input.type = 'password';
    icon.setAttribute('data-lucide', 'eye');
  }
  lucide.createIcons();
}

function submitAuth() {
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!username) return showAuthError('Username is required.');
  if (!password || password.length < 4) return showAuthError('Password must be at least 4 characters.');

  // Simulated auth — in production, this would be an API call
  if (authMode === 'register') {
    currentUser = { username, avatarLetter: username[0].toUpperCase() };
    saveAuth();
    closeAuthModal();
    updateUserUI();
    showToast(`Welcome, ${username}!`, 'success');
  } else {
    // Simple login: accept any username/password (demo mode)
    currentUser = { username, avatarLetter: username[0].toUpperCase() };
    saveAuth();
    closeAuthModal();
    updateUserUI();
    showToast(`Welcome back, ${username}!`, 'success');
  }
}

function handleAuthBtn() {
  if (currentUser) {
    // Logout
    currentUser = null;
    saveAuth();
    updateUserUI();
    showToast('Logged out.', 'info');
  } else {
    openAuthModal('login');
  }
}

function updateUserUI() {
  const usernameEl = document.getElementById('sidebar-username');
  const avatarEl   = document.getElementById('sidebar-avatar');
  const authIcon   = document.getElementById('sidebar-auth-icon');
  const authBtn    = document.getElementById('sidebar-auth-btn');

  if (currentUser) {
    usernameEl.textContent = currentUser.username;
    avatarEl.textContent   = currentUser.avatarLetter || currentUser.username[0].toUpperCase();
    authIcon.setAttribute('data-lucide', 'log-out');
    authBtn.title = 'Logout';
  } else {
    usernameEl.textContent = 'Guest';
    avatarEl.textContent   = 'G';
    authIcon.setAttribute('data-lucide', 'log-in');
    authBtn.title = 'Login';
  }
  lucide.createIcons();
}

/* ==========================================================================
   Session Timer
========================================================================== */
function startSessionTimer() {
  sessionStart = Date.now();
  updateTimerDisplay();
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function updateTimerDisplay() {
  const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
  const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
  const el = document.getElementById('timer-display');
  if (el) el.textContent = `${h}:${m}:${s}`;
}

/* ==========================================================================
   Navigation
========================================================================== */
function navigateTo(section) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const sectionEl = document.getElementById(`section-${section}`);
  if (sectionEl) sectionEl.classList.add('active');

  const navEl = document.querySelector(`.nav-item[data-section="${section}"]`);
  if (navEl) navEl.classList.add('active');

  const titles = { dashboard: 'Dashboard', flips: 'My Flips', analytics: 'Analytics', calculator: 'Calculator' };
  document.getElementById('page-title').textContent = titles[section] || section;

  if (section === 'dashboard') {
    renderDashboard();
  } else if (section === 'flips') {
    renderFlipsList();
  } else if (section === 'analytics') {
    renderAnalytics();
  } else if (section === 'calculator') {
    // nothing extra needed
  }

  // Close sidebar on mobile
  if (window.innerWidth < 768) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

/* ==========================================================================
   Modal — Add / Edit Flip
========================================================================== */
function openModal(id = null) {
  editingId = id;
  const modal = document.getElementById('flip-modal');
  const title = document.getElementById('modal-title');
  const saveBtn = document.getElementById('save-flip-btn');

  if (id) {
    const flip = flips.find(f => f.id === id);
    if (!flip) return;
    title.textContent = 'Edit Flip';
    saveBtn.textContent = 'Update Flip';
    document.getElementById('item-name').value  = flip.item;
    document.getElementById('buy-price').value  = flip.buyPrice;
    document.getElementById('sell-price').value = flip.sellPrice;
    document.getElementById('quantity').value   = flip.quantity;
    document.getElementById('flip-date').value  = flip.date;
    document.getElementById('flip-notes').value = flip.notes || '';
  } else {
    title.textContent = 'Add Flip';
    saveBtn.textContent = 'Save Flip';
    document.getElementById('item-name').value  = '';
    document.getElementById('buy-price').value  = '';
    document.getElementById('sell-price').value = '';
    document.getElementById('quantity').value   = '1';
    document.getElementById('flip-date').value  = today();
    document.getElementById('flip-notes').value = '';
  }
  document.getElementById('modal-preview').style.display = 'none';
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('item-name').focus(), 50);
  updateModalPreview();
}

function closeModal() {
  document.getElementById('flip-modal').style.display = 'none';
  editingId = null;
}

function updateModalPreview() {
  const buy  = parseFloat(document.getElementById('buy-price').value)  || 0;
  const sell = parseFloat(document.getElementById('sell-price').value) || 0;
  const qty  = parseInt(document.getElementById('quantity').value)     || 1;

  if (buy > 0 && sell > 0) {
    const tax        = Math.floor(sell * GE_TAX_RATE);
    const profitPer  = sell - buy - tax;
    const profitTotal = profitPer * qty;
    const roi        = ((profitPer / buy) * 100).toFixed(2);

    document.getElementById('preview-profit-per').textContent   = formatGP(profitPer);
    document.getElementById('preview-profit-total').textContent = formatGP(profitTotal);
    document.getElementById('preview-roi').textContent          = `${roi}%`;
    document.getElementById('modal-preview').style.display = 'block';
  } else {
    document.getElementById('modal-preview').style.display = 'none';
  }
}

function saveFlip() {
  const item      = document.getElementById('item-name').value.trim();
  const buyPrice  = parseFloat(document.getElementById('buy-price').value);
  const sellPrice = parseFloat(document.getElementById('sell-price').value);
  const quantity  = parseInt(document.getElementById('quantity').value) || 1;
  const date      = document.getElementById('flip-date').value || today();
  const notes     = document.getElementById('flip-notes').value.trim();

  if (!item)           return showToast('Item name is required.', 'error');
  if (isNaN(buyPrice)) return showToast('Buy price is required.', 'error');
  if (isNaN(sellPrice))return showToast('Sell price is required.', 'error');

  const tax        = Math.floor(sellPrice * GE_TAX_RATE);
  const profitPer  = sellPrice - buyPrice - tax;
  const profitTotal = profitPer * quantity;
  const roi        = buyPrice > 0 ? ((profitPer / buyPrice) * 100) : 0;

  if (editingId) {
    const idx = flips.findIndex(f => f.id === editingId);
    if (idx !== -1) {
      flips[idx] = { ...flips[idx], item, buyPrice, sellPrice, quantity, date, notes, profitPer, profitTotal, roi, tax };
    }
    showToast('Flip updated!', 'success');
  } else {
    const flip = {
      id: genId(), item, buyPrice, sellPrice, quantity, date, notes,
      profitPer, profitTotal, roi, tax,
      createdAt: new Date().toISOString()
    };
    flips.unshift(flip);
    showToast('Flip added!', 'success');
  }

  saveData();
  closeModal();
  refreshAll();
}

/* ==========================================================================
   Delete Modal
========================================================================== */
function openDeleteModal(id) {
  deleteId = id;
  const flip = flips.find(f => f.id === id);
  document.getElementById('delete-item-name').textContent = flip ? flip.item : 'this item';
  document.getElementById('delete-modal').style.display = 'flex';
}

function closeDeleteModal() {
  document.getElementById('delete-modal').style.display = 'none';
  deleteId = null;
}

function confirmDelete() {
  if (!deleteId) return;
  flips = flips.filter(f => f.id !== deleteId);
  saveData();
  closeDeleteModal();
  showToast('Flip deleted.', 'info');
  refreshAll();
}

/* ==========================================================================
   Calculator Modal
========================================================================== */
function openCalcModal() {
  document.getElementById('calc-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('calc-buy').focus(), 50);
}

function closeCalcModal() {
  document.getElementById('calc-modal').style.display = 'none';
}

function updateCalc() {
  const buy  = parseFloat(document.getElementById('calc-buy').value)  || 0;
  const sell = parseFloat(document.getElementById('calc-sell').value) || 0;
  const qty  = parseInt(document.getElementById('calc-qty').value)    || 1;
  const taxPct = parseFloat(document.getElementById('calc-tax').value) / 100 || GE_TAX_RATE;

  const revenue   = sell * qty;
  const cost      = buy * qty;
  const taxAmt    = Math.floor(sell * taxPct) * qty;
  const netProfit = revenue - cost - taxAmt;
  const roi       = cost > 0 ? ((netProfit / cost) * 100).toFixed(2) : '0.00';

  document.getElementById('calc-profit-display').textContent = formatGP(netProfit);
  document.getElementById('calc-roi-display').textContent    = `ROI: ${roi}%`;
  document.getElementById('calc-revenue').textContent  = formatGP(revenue);
  document.getElementById('calc-cost').textContent     = formatGP(cost);
  document.getElementById('calc-tax-amount').textContent = formatGP(taxAmt);
  document.getElementById('calc-net').textContent      = formatGP(netProfit);
}

function useCalcValues() {
  const buy  = document.getElementById('calc-buy').value;
  const sell = document.getElementById('calc-sell').value;
  const qty  = document.getElementById('calc-qty').value;
  closeCalcModal();
  openModal();
  document.getElementById('buy-price').value  = buy;
  document.getElementById('sell-price').value = sell;
  document.getElementById('quantity').value   = qty;
  updateModalPreview();
}

/* ==========================================================================
   Calculator Page
========================================================================== */
function updatePageCalc() {
  const buy  = parseFloat(document.getElementById('calc-page-buy').value)  || 0;
  const sell = parseFloat(document.getElementById('calc-page-sell').value) || 0;
  const qty  = parseInt(document.getElementById('calc-page-qty').value)    || 1;
  const taxPct = parseFloat(document.getElementById('calc-page-tax').value) / 100 || GE_TAX_RATE;

  const revenue   = sell * qty;
  const cost      = buy * qty;
  const taxAmt    = Math.floor(sell * taxPct) * qty;
  const netProfit = revenue - cost - taxAmt;
  const roi       = cost > 0 ? ((netProfit / cost) * 100).toFixed(2) : '0.00';

  document.getElementById('calc-page-profit-display').textContent = formatGP(netProfit);
  document.getElementById('calc-page-roi-display').textContent    = `ROI: ${roi}%`;
  document.getElementById('calc-page-revenue').textContent  = formatGP(revenue);
  document.getElementById('calc-page-cost').textContent     = formatGP(cost);
  document.getElementById('calc-page-tax-amount').textContent = formatGP(taxAmt);
  document.getElementById('calc-page-net').textContent      = formatGP(netProfit);
}

function usePageCalcValues() {
  const buy  = document.getElementById('calc-page-buy').value;
  const sell = document.getElementById('calc-page-sell').value;
  const qty  = document.getElementById('calc-page-qty').value;
  navigateTo('flips');
  openModal();
  document.getElementById('buy-price').value  = buy;
  document.getElementById('sell-price').value = sell;
  document.getElementById('quantity').value   = qty;
  updateModalPreview();
}

/* ==========================================================================
   Export / Import
========================================================================== */
function exportFlips() {
  if (!flips.length) return showToast('No flips to export.', 'error');
  const blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), flips }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `osrs-flips-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Flips exported!', 'success');
}

function importFlips(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const imported = Array.isArray(data) ? data : (Array.isArray(data.flips) ? data.flips : null);
      if (!imported) return showToast('Invalid file format.', 'error');
      const newFlips = imported.filter(f => f.id && f.item);
      let added = 0;
      for (const flip of newFlips) {
        if (!flips.find(f => f.id === flip.id)) {
          flips.unshift(flip);
          added++;
        }
      }
      saveData();
      refreshAll();
      showToast(`Imported ${added} flip(s).`, 'success');
    } catch (err) {
      showToast('Failed to parse file.', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

/* ==========================================================================
   Dashboard
========================================================================== */
function renderDashboard() {
  renderStats();
  renderProfitChart();
  renderTopItems();
  renderRecentFlips();
}

function renderStats() {
  const grid = document.getElementById('stats-grid');
  const totalProfit = flips.reduce((s, f) => s + (f.profitTotal || 0), 0);
  const totalFlips  = flips.length;
  const avgRoi      = flips.length ? (flips.reduce((s, f) => s + (f.roi || 0), 0) / flips.length).toFixed(1) : '0.0';
  const bestFlip    = flips.length ? flips.reduce((a, b) => (a.profitTotal > b.profitTotal ? a : b)) : null;

  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total Profit</div>
      <div class="stat-value ${totalProfit >= 0 ? 'profit' : 'loss'}">${formatGP(totalProfit)}</div>
      <div class="stat-sub">${totalFlips} flip${totalFlips !== 1 ? 's' : ''} tracked</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Avg ROI</div>
      <div class="stat-value">${avgRoi}%</div>
      <div class="stat-sub">Across all flips</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Best Flip</div>
      <div class="stat-value">${bestFlip ? formatGP(bestFlip.profitTotal) : '—'}</div>
      <div class="stat-sub">${bestFlip ? bestFlip.item : 'No flips yet'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Volume</div>
      <div class="stat-value">${formatGP(flips.reduce((s, f) => s + (f.buyPrice * f.quantity || 0), 0))}</div>
      <div class="stat-sub">GP invested</div>
    </div>
  `;
}

function renderProfitChart() {
  const canvas = document.getElementById('profit-chart');
  const ctx = canvas.getContext('2d');
  const data = getChartData(chartRange);

  if (profitChart) profitChart.destroy();
  profitChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'Profit',
        data: data.values,
        borderColor: '#ff981f',
        backgroundColor: 'rgba(255,152,31,0.08)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#ff981f',
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: chartOptions('GP')
  });
}

function setChartRange(range) {
  chartRange = range;
  document.querySelectorAll('.chart-controls .chip').forEach(c => {
    c.classList.toggle('active', c.dataset.range === range);
  });
  renderProfitChart();
}

function getChartData(range) {
  const now   = new Date();
  const days  = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const labels = [];
  const values = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    labels.push(range === 'all' ? dateStr : dateStr.slice(5));
    const dayProfit = flips
      .filter(f => f.date === dateStr)
      .reduce((s, f) => s + (f.profitTotal || 0), 0);
    values.push(dayProfit);
  }
  return { labels, values };
}

function renderTopItems() {
  const list = document.getElementById('top-items-list');
  const itemMap = {};
  for (const f of flips) {
    if (!itemMap[f.item]) itemMap[f.item] = 0;
    itemMap[f.item] += f.profitTotal || 0;
  }
  const sorted = Object.entries(itemMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (!sorted.length) {
    list.innerHTML = '<div class="top-item" style="color:var(--text-muted);font-size:13px;">No flips yet.</div>';
    return;
  }
  list.innerHTML = sorted.map(([name, profit]) => `
    <div class="top-item">
      <span class="top-item-name">${escHtml(name)}</span>
      <span class="top-item-profit ${profit < 0 ? 'neg' : ''}">${formatGP(profit)}</span>
    </div>
  `).join('');
}

function renderRecentFlips() {
  const list = document.getElementById('recent-flips-list');
  const recent = [...flips].slice(0, 8);
  if (!recent.length) {
    list.innerHTML = '<div style="padding:16px 20px;color:var(--text-muted);font-size:13px;">No flips yet.</div>';
    return;
  }
  list.innerHTML = recent.map(f => `
    <div class="recent-flip-row">
      <div>
        <div class="recent-flip-name">${escHtml(f.item)}</div>
        <div class="recent-flip-date">${formatDate(f.date)} &middot; x${f.quantity}</div>
      </div>
      <span class="badge ${f.profitTotal >= 0 ? 'badge-profit' : 'badge-loss'}">${f.roi ? f.roi.toFixed(1) + '%' : '0%'} ROI</span>
      <span class="recent-flip-profit ${f.profitTotal >= 0 ? 'pos' : 'neg'}">${formatGP(f.profitTotal)}</span>
    </div>
  `).join('');
}

/* ==========================================================================
   My Flips
========================================================================== */
function filterFlips() {
  const query  = document.getElementById('search-input').value.toLowerCase();
  const sort   = document.getElementById('sort-select').value;
  const filter = document.getElementById('filter-select').value;

  let list = [...flips];

  // Filter by time
  if (filter !== 'all') {
    const now = new Date();
    list = list.filter(f => {
      const d = new Date(f.date);
      if (filter === 'today') return f.date === today();
      if (filter === 'week')  return (now - d) <= 7  * 86400000;
      if (filter === 'month') return (now - d) <= 30 * 86400000;
      return true;
    });
  }

  // Search
  if (query) list = list.filter(f => f.item.toLowerCase().includes(query) || (f.notes || '').toLowerCase().includes(query));

  // Sort
  list.sort((a, b) => {
    if (sort === 'date-desc')   return new Date(b.date) - new Date(a.date);
    if (sort === 'date-asc')    return new Date(a.date) - new Date(b.date);
    if (sort === 'profit-desc') return b.profitTotal - a.profitTotal;
    if (sort === 'profit-asc')  return a.profitTotal - b.profitTotal;
    if (sort === 'roi-desc')    return b.roi - a.roi;
    return 0;
  });

  renderFlipsListWith(list);
}

function renderFlipsList() {
  filterFlips();
}

function renderFlipsListWith(list) {
  const container  = document.getElementById('flips-list');
  const emptyState = document.getElementById('flips-empty');

  if (!list.length) {
    container.innerHTML  = '';
    emptyState.style.display = 'flex';
    return;
  }
  emptyState.style.display = 'none';
  container.innerHTML = list.map(f => `
    <div class="flip-card" tabindex="0" onclick="openModal('${f.id}')" onkeydown="if(event.key==='Enter'||event.key===' ')openModal('${f.id}')" role="button" aria-label="Edit ${escHtml(f.item)} flip">
      <div class="flip-card-left">
        <div class="flip-item-name">${escHtml(f.item)}</div>
        <div class="flip-meta">
          <span class="flip-meta-item">Buy: <span>${formatGP(f.buyPrice)}</span></span>
          <span class="flip-meta-item">Sell: <span>${formatGP(f.sellPrice)}</span></span>
          <span class="flip-meta-item">Qty: <span>${f.quantity}</span></span>
          <span class="flip-meta-item">Date: <span>${formatDate(f.date)}</span></span>
          ${f.notes ? `<span class="flip-meta-item">Note: <span>${escHtml(f.notes)}</span></span>` : ''}
        </div>
      </div>
      <div class="flip-card-right">
        <div class="flip-profit ${f.profitTotal >= 0 ? 'pos' : 'neg'}">${formatGP(f.profitTotal)}</div>
        <div class="flip-roi">${f.roi ? f.roi.toFixed(2) : '0.00'}% ROI</div>
        <div class="flip-actions" onclick="event.stopPropagation()">
          <button class="icon-btn" onclick="openModal('${f.id}')" title="Edit"><i data-lucide="pencil"></i></button>
          <button class="icon-btn" onclick="openDeleteModal('${f.id}')" title="Delete" style="color:var(--loss)"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

/* ==========================================================================
   Analytics
========================================================================== */
function renderAnalytics() {
  renderDailyChart();
  renderItemChart();
  renderRoiChart();
  renderAlltimeStats();
}

function renderDailyChart() {
  const ctx = document.getElementById('daily-chart').getContext('2d');
  const data = getChartData('30d');
  if (dailyChart) dailyChart.destroy();
  dailyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'Daily Profit',
        data: data.values,
        backgroundColor: data.values.map(v => v >= 0 ? 'rgba(74,222,128,0.7)' : 'rgba(248,113,113,0.7)'),
        borderRadius: 4
      }]
    },
    options: chartOptions('GP')
  });
}

function renderItemChart() {
  const ctx = document.getElementById('item-chart').getContext('2d');
  const itemMap = {};
  for (const f of flips) {
    if (!itemMap[f.item]) itemMap[f.item] = 0;
    itemMap[f.item] += f.profitTotal || 0;
  }
  const sorted  = Object.entries(itemMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const labels  = sorted.map(([name]) => name);
  const values  = sorted.map(([, v]) => v);
  const colors  = [
    '#ff981f','#4ade80','#60a5fa','#f472b6',
    '#a78bfa','#34d399','#fbbf24','#f87171'
  ];
  if (itemChart) itemChart.destroy();
  itemChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#9aa0b4', font: { size: 12 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatGP(ctx.raw)}` } }
      }
    }
  });
}

function renderRoiChart() {
  const ctx = document.getElementById('roi-chart').getContext('2d');
  const buckets = { '<0%': 0, '0–5%': 0, '5–10%': 0, '10–20%': 0, '>20%': 0 };
  for (const f of flips) {
    const r = f.roi || 0;
    if (r < 0) buckets['<0%']++;
    else if (r < 5)  buckets['0–5%']++;
    else if (r < 10) buckets['5–10%']++;
    else if (r < 20) buckets['10–20%']++;
    else buckets['>20%']++;
  }
  if (roiChart) roiChart.destroy();
  roiChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(buckets),
      datasets: [{
        label: 'Flips',
        data: Object.values(buckets),
        backgroundColor: ['#f87171','#fbbf24','#4ade80','#34d399','#60a5fa'],
        borderRadius: 4
      }]
    },
    options: chartOptions('')
  });
}

function renderAlltimeStats() {
  const el = document.getElementById('alltime-stats');
  if (!flips.length) {
    el.innerHTML = '<div class="alltime-row"><span class="alltime-label">No flips yet.</span></div>';
    return;
  }
  const totalProfit  = flips.reduce((s, f) => s + (f.profitTotal || 0), 0);
  const totalVolume  = flips.reduce((s, f) => s + (f.buyPrice * f.quantity || 0), 0);
  const avgProfit    = totalProfit / flips.length;
  const bestFlip     = flips.reduce((a, b) => a.profitTotal > b.profitTotal ? a : b);
  const worstFlip    = flips.reduce((a, b) => a.profitTotal < b.profitTotal ? a : b);
  const profitableCount = flips.filter(f => f.profitTotal > 0).length;
  const winRate         = ((profitableCount / flips.length) * 100).toFixed(1);
  const rows = [
    ['Total Profit',      formatGP(totalProfit)],
    ['Total Volume',      formatGP(totalVolume)],
    ['Avg Profit/Flip',   formatGP(avgProfit)],
    ['Win Rate',          `${winRate}%`],
    ['Total Flips',       flips.length],
    ['Best Flip',         `${escHtml(bestFlip.item)} (${formatGP(bestFlip.profitTotal)})`],
    ['Worst Flip',        `${escHtml(worstFlip.item)} (${formatGP(worstFlip.profitTotal)})`],
  ];
  el.innerHTML = rows.map(([label, value]) => `
    <div class="alltime-row">
      <span class="alltime-label">${label}</span>
      <span class="alltime-value">${value}</span>
    </div>
  `).join('');
}

/* ==========================================================================
   Helpers
========================================================================== */
function chartOptions(yUnit) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => yUnit ? ` ${formatGP(ctx.raw)}` : ` ${ctx.raw}`
        }
      }
    },
    scales: {
      x: { ticks: { color: '#5c6278', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
      y: { ticks: { color: '#5c6278', font: { size: 11 }, callback: v => yUnit ? formatGPShort(v) : v }, grid: { color: 'rgba(255,255,255,0.05)' } }
    }
  };
}

function formatGP(n) {
  if (n === undefined || n === null) return '0 GP';
  const abs = Math.abs(n);
  let str;
  if (abs >= 1e9)      str = (n / 1e9).toFixed(2) + 'B';
  else if (abs >= 1e6) str = (n / 1e6).toFixed(2) + 'M';
  else if (abs >= 1e3) str = (n / 1e3).toFixed(1) + 'K';
  else                 str = Math.round(n).toLocaleString();
  return str + ' GP';
}

function formatGPShort(n) {
  if (!n) return '0';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return Math.round(n);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ---------- Toast ---------- */
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

/* ---------- Refresh All ---------- */
function refreshAll() {
  const active = document.querySelector('.content-section.active');
  if (!active) return;
  const section = active.id.replace('section-', '');
  navigateTo(section);
}

/* ==========================================================================
   Keyboard Navigation
========================================================================== */
document.addEventListener('keydown', (e) => {
  // Escape closes any open modal
  if (e.key === 'Escape') {
    if (document.getElementById('flip-modal').style.display !== 'none') closeModal();
    else if (document.getElementById('delete-modal').style.display !== 'none') closeDeleteModal();
    else if (document.getElementById('calc-modal').style.display !== 'none') closeCalcModal();
    else if (document.getElementById('auth-modal').style.display !== 'none') closeAuthModal();
    return;
  }
  // Alt+N = new flip
  if (e.altKey && e.key === 'n') { e.preventDefault(); openModal(); }
  // Alt+C = calculator
  if (e.altKey && e.key === 'c') { e.preventDefault(); openCalcModal(); }
});

/* ========= Modal input listeners for live preview ========= */
['buy-price','sell-price','quantity'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', updateModalPreview);
});

/* ==========================================================================
   Init
========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  loadAuth();
  updateUserUI();
  startSessionTimer();
  lucide.createIcons();
  navigateTo('dashboard');
});
