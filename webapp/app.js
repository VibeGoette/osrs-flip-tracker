/* OSRS Flipit2 — Complete Application Logic */
/* eslint-disable no-unused-vars */
(function () {
  "use strict";

  // ========== STATE ==========
  const state = {
    items: [],          // mapping data [{id, name, icon, examine, members, lowalch, highalch, limit, value}]
    itemMap: {},        // id -> item
    prices: {},         // id -> {high, highTime, low, lowTime}
    hourData: {},       // id -> {avgHighPrice, highPriceVolume, avgLowPrice, lowPriceVolume}
    taskCards: [],
    alarms: [],
    watchlist: [],
    blogPosts: [
      {
        id: "default-1",
        title: "Welcome to OSRS Flipit2",
        date: "2026-03-05",
        content: "# Welcome to OSRS Flipit2!\n\nThis is your **Grand Exchange flipping companion**. Use the Task Cards to track your flips, the Scanner to find profitable items, and the Calculator to compute taxes.\n\n## Getting Started\n\n1. Head to the **Scanner** to find items with good margins\n2. Click **Quick Flip** to create a Task Card\n3. Track your progress and earn **Karma Gold** and **EXP**!\n\n## Features\n\n- Real-time GE prices from the OSRS Wiki API\n- Task card system with timers and profit tracking\n- Buy limit alarms with sound notifications\n- Gamification with levels and Karma Gold\n\nHappy flipping!"
      }
    ],
    gamification: {
      karmaGold: 0,
      totalExp: 0,
      level: 1,
      cardsCompleted: 0
    },
    stats: {
      totalProfit: 0,
      totalTax: 0,
      totalROI: [],
      flipsCompleted: 0,
      profitHistory: [],
      sessionStart: Date.now()
    },
    auth: { loggedIn: false, username: "Guest", users: [] },
    adminAuthed: false,
    currentPage: "cards",
    scannerPage: 0,
    scannerSort: { key: "afterTax", dir: -1 },
    scannerFilter: "all",
    scannerSearchText: "",
    cardsFilter: "all",
    apiCountdown: 60,
    selectedCardItem: null,
    selectedWatchlistItem: null,
    detailChart: null,
    profitChart: null,
    calcSelectedItem: null,
    editingPostId: null
  };

  const LEVEL_NAMES = {
    1: "Novice", 5: "Apprentice", 10: "Journeyman", 15: "Expert",
    20: "Master", 25: "Grandmaster"
  };

  const API_BASE = "https://prices.runescape.wiki/api/v1/osrs";
  const HEADERS = { "User-Agent": "osrs-flip-tracker - @VibeGoette on GitHub" };
  const WIKI_ICON_BASE = "https://oldschool.runescape.wiki/images/";
  const ITEMS_PER_PAGE = 200;

  // ========== HELPERS ==========
  function formatGP(n) {
    if (n == null || isNaN(n)) return "—";
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1e9) return sign + (abs / 1e9).toFixed(1) + "B";
    if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + "M";
    if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + "K";
    return sign + abs.toLocaleString();
  }

  function formatGPFull(n) {
    if (n == null || isNaN(n)) return "—";
    return n.toLocaleString() + " GP";
  }

  function geTax(sellPrice) {
    return Math.min(Math.floor(sellPrice * 0.01), 5000000);
  }

  function getItemIcon(icon) {
    if (!icon) return "";
    return WIKI_ICON_BASE + icon.replace(/ /g, "_").replace(/'/g, "%27");
  }

  function getLevelName(level) {
    let name = "Novice";
    const keys = Object.keys(LEVEL_NAMES).map(Number).sort((a, b) => a - b);
    for (const k of keys) {
      if (level >= k) name = LEVEL_NAMES[k];
    }
    return name;
  }

  function calcLevel(exp) {
    return Math.floor(exp / 200) + 1;
  }

  function expToNextLevel(exp) {
    return 200 - (exp % 200);
  }

  function expProgress(exp) {
    return ((exp % 200) / 200) * 100;
  }

  function formatTime(ms) {
    if (ms <= 0) return "00:00:00";
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function formatTimeShort(ms) {
    if (ms <= 0) return "0s";
    const totalSec = Math.floor(ms / 1000);
    if (totalSec < 60) return totalSec + "s";
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    if (m < 60) return m + "m " + s + "s";
    const h = Math.floor(m / 60);
    return h + "h " + (m % 60) + "m";
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ========== TOAST ==========
  function showToast(msg, type, duration) {
    type = type || "";
    duration = duration || 3000;
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = "toast " + type;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(40px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ========== ALARM SOUND ==========
  function playAlarmSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(830, ctx.currentTime);
      osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(830, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) { /* audio not available */ }
  }

  // ========== MARKDOWN RENDERER ==========
  function renderMarkdown(md) {
    if (!md) return "";
    let html = md;
    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, function (m, code) {
      return "<pre><code>" + code.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</code></pre>";
    });
    // Inline code
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    // Headings
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // Italic
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    // Unordered lists
    html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>\n?)+/g, function (m) {
      return "<ul>" + m + "</ul>";
    });
    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
    // Paragraphs
    html = html.replace(/\n\n/g, "</p><p>");
    html = "<p>" + html + "</p>";
    // Clean up
    html = html.replace(/<p><(h[1-3]|pre|ul|ol)/g, "<$1");
    html = html.replace(/<\/(h[1-3]|pre|ul|ol)><\/p>/g, "</$1>");
    html = html.replace(/<p><\/p>/g, "");
    return html;
  }

  // ========== API ==========
  async function apiFetch(endpoint) {
    try {
      const res = await fetch(API_BASE + endpoint, {
        headers: HEADERS
      });
      if (!res.ok) throw new Error("API error: " + res.status);
      return await res.json();
    } catch (e) {
      console.error("API fetch failed:", endpoint, e);
      return null;
    }
  }

  async function loadMapping() {
    const data = await apiFetch("/mapping");
    if (data) {
      state.items = data;
      state.itemMap = {};
      for (const item of data) {
        state.itemMap[item.id] = item;
      }
    }
  }

  async function loadPrices() {
    const data = await apiFetch("/latest");
    if (data && data.data) {
      state.prices = data.data;
    }
  }

  async function loadHourData() {
    const data = await apiFetch("/1h");
    if (data && data.data) {
      state.hourData = data.data;
    }
  }

  async function loadTimeseries(itemId, timestep) {
    timestep = timestep || "5m";
    const data = await apiFetch("/timeseries?id=" + itemId + "&timestep=" + timestep);
    if (data && data.data) return data.data;
    return [];
  }

  async function initData() {
    await Promise.all([loadMapping(), loadPrices(), loadHourData()]);
    renderCurrentPage();
  }

  async function refreshPrices() {
    await Promise.all([loadPrices(), loadHourData()]);
    if (state.currentPage === "scanner") renderScanner();
    if (state.currentPage === "watchlist") renderWatchlist();
    updateGamificationUI();
  }

  // ========== ROUTING ==========
  function navigateTo(page) {
    state.currentPage = page;
    // Hide all pages
    document.querySelectorAll(".page").forEach(function (p) { p.style.display = "none"; });
    const el = document.getElementById("page-" + page);
    if (el) el.style.display = "block";

    // Update nav
    document.querySelectorAll(".nav-item").forEach(function (n) {
      n.classList.toggle("active", n.dataset.page === page);
    });
    document.querySelectorAll(".mobile-nav-item").forEach(function (n) {
      n.classList.toggle("active", n.dataset.page === page);
    });

    renderCurrentPage();
    // Close mobile sidebar
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebarOverlay").classList.remove("show");
  }

  function renderCurrentPage() {
    switch (state.currentPage) {
      case "cards": renderCards(); break;
      case "scanner": renderScanner(); break;
      case "calculator": break;
      case "alarms": renderAlarms(); break;
      case "watchlist": renderWatchlist(); break;
      case "stats": renderStats(); break;
      case "guides": renderGuides("101"); break;
      case "blog": renderBlog(); break;
      case "admin": renderAdmin(); break;
      case "settings": renderSettings(); break;
    }
  }

  function initRouting() {
    const hash = window.location.hash.replace("#", "") || "cards";
    navigateTo(hash);

    window.addEventListener("hashchange", function () {
      const hash = window.location.hash.replace("#", "") || "cards";
      navigateTo(hash);
    });

    // Nav clicks
    document.querySelectorAll("[data-page]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        const page = this.dataset.page;
        window.location.hash = "#" + page;
      });
    });
  }

  // ========== SIDEBAR TOGGLE ==========
  function initSidebar() {
    const toggle = document.getElementById("sidebarToggle");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");

    toggle.addEventListener("click", function () {
      sidebar.classList.toggle("open");
      overlay.classList.toggle("show");
    });
    overlay.addEventListener("click", function () {
      sidebar.classList.remove("open");
      overlay.classList.remove("show");
    });
  }

  // ========== TASK CARDS ==========
  function renderCards() {
    const grid = document.getElementById("cardsGrid");
    const empty = document.getElementById("cardsEmpty");
    let cards = state.taskCards;

    if (state.cardsFilter !== "all") {
      cards = cards.filter(function (c) { return c.status === state.cardsFilter; });
    }

    if (cards.length === 0) {
      grid.innerHTML = "";
      grid.appendChild(empty);
      empty.style.display = "flex";
      return;
    }

    empty.style.display = "none";
    grid.innerHTML = cards.map(function (card) {
      const now = Date.now();
      const elapsed = now - card.startTime;
      const total = card.endTime - card.startTime;
      const remaining = Math.max(0, card.endTime - now);
      const progress = Math.min(100, (elapsed / total) * 100);

      if (card.status === "active" && remaining <= 0) {
        card.status = "expired";
      }

      const tax = geTax(card.sellPrice);
      const profit = (card.sellPrice - card.buyPrice - tax) * card.quantity;
      const roi = card.buyPrice > 0 ? ((card.sellPrice - card.buyPrice - tax) / card.buyPrice * 100).toFixed(1) : "0";
      const goldNeeded = card.buyPrice * card.quantity;
      const hasAlarm = state.alarms.some(function (a) { return a.cardId === card.id && a.active; });

      const statusClass = card.status === "completed" ? "completed" : card.status === "expired" ? "expired" : "";
      const statusBadge = card.status === "active" ? "active" : card.status === "completed" ? "completed-status" : "expired-status";

      return '<div class="task-card ' + statusClass + '" data-card-id="' + card.id + '">' +
        '<span class="task-card-xp-badge">+40 XP</span>' +
        '<div class="task-card-header">' +
          '<img src="' + getItemIcon(card.icon) + '" alt="" class="task-card-icon" onerror="this.style.display=\'none\'">' +
          '<span class="task-card-title">' + escapeHtml(card.itemName) + '</span>' +
          '<span class="task-card-status ' + statusBadge + '">' + card.status + '</span>' +
        '</div>' +
        '<div class="task-card-body">' +
          '<div class="task-card-stat"><span class="task-card-stat-label">Buy</span><span class="task-card-stat-value price-buy">' + formatGP(card.buyPrice) + '</span></div>' +
          '<div class="task-card-stat"><span class="task-card-stat-label">Sell</span><span class="task-card-stat-value price-sell">' + formatGP(card.sellPrice) + '</span></div>' +
          '<div class="task-card-stat"><span class="task-card-stat-label">Quantity</span><span class="task-card-stat-value">' + card.quantity.toLocaleString() + '</span></div>' +
          '<div class="task-card-stat"><span class="task-card-stat-label">Gold Needed</span><span class="task-card-stat-value">' + formatGP(goldNeeded) + '</span></div>' +
          '<div class="task-card-profit">' +
            '<div><span class="task-card-profit-label">Est. Profit</span></div>' +
            '<div style="text-align:right"><span class="task-card-profit-value ' + (profit >= 0 ? "positive" : "negative") + '">' + formatGP(profit) + '</span>' +
            '<span class="task-card-roi"> (' + roi + '%)</span></div>' +
          '</div>' +
        '</div>' +
        (card.status === "active" ?
          '<div class="task-card-timer">' +
            '<div class="task-card-timer-row"><span class="task-card-timer-label">Time Left</span><span class="task-card-timer-value">' + formatTimeShort(remaining) + '</span></div>' +
            '<div class="task-card-progress"><div class="task-card-progress-fill' + (progress > 80 ? " low" : "") + '" style="width:' + progress + '%"></div></div>' +
          '</div>' : "") +
        (hasAlarm ? '<div class="alarm-countdown"><i data-lucide="bell"></i> Buy limit alarm active</div>' : "") +
        '<div class="task-card-actions">' +
          (card.status === "active" ? '<button class="btn btn-sm btn-primary complete-card-btn" data-card-id="' + card.id + '">Complete</button>' : "") +
          '<button class="btn-icon alarm-toggle ' + (hasAlarm ? "alarm-active" : "") + '" data-card-id="' + card.id + '" title="Toggle 4h buy limit alarm"><i data-lucide="bell"></i></button>' +
          '<button class="btn-icon delete-card-btn" data-card-id="' + card.id + '" title="Delete card"><i data-lucide="trash-2"></i></button>' +
        '</div>' +
      '</div>';
    }).join("");

    lucide.createIcons();
    bindCardActions();
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function bindCardActions() {
    document.querySelectorAll(".complete-card-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        completeCard(this.dataset.cardId);
      });
    });
    document.querySelectorAll(".alarm-toggle").forEach(function (btn) {
      btn.addEventListener("click", function () {
        toggleAlarm(this.dataset.cardId);
      });
    });
    document.querySelectorAll(".delete-card-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        deleteCard(this.dataset.cardId);
      });
    });
  }

  function completeCard(cardId) {
    const card = state.taskCards.find(function (c) { return c.id === cardId; });
    if (!card || card.status !== "active") return;

    card.status = "completed";

    const tax = geTax(card.sellPrice);
    const profit = (card.sellPrice - card.buyPrice - tax) * card.quantity;
    const totalTax = tax * card.quantity;

    // Gamification rewards
    state.gamification.totalExp += 40;
    const karmaEarned = Math.max(0, Math.floor(profit / 1000));
    state.gamification.karmaGold += karmaEarned;
    state.gamification.cardsCompleted += 1;

    const newLevel = calcLevel(state.gamification.totalExp);
    const oldLevel = state.gamification.level;
    state.gamification.level = newLevel;

    // Stats
    state.stats.totalProfit += profit;
    state.stats.totalTax += totalTax;
    state.stats.flipsCompleted += 1;
    if (card.buyPrice > 0) {
      state.stats.totalROI.push((card.sellPrice - card.buyPrice - tax) / card.buyPrice * 100);
    }
    state.stats.profitHistory.push({ time: Date.now(), profit: profit, item: card.itemName });

    showToast("+40 XP", "gold", 2000);
    setTimeout(function () {
      if (karmaEarned > 0) showToast("+" + karmaEarned + " Karma Gold", "gold", 2000);
    }, 500);

    if (newLevel > oldLevel) {
      setTimeout(function () {
        showToast("Level Up! You are now a " + getLevelName(newLevel) + "!", "level-up", 4000);
      }, 1200);
    }

    updateGamificationUI();
    renderCards();
  }

  function deleteCard(cardId) {
    state.taskCards = state.taskCards.filter(function (c) { return c.id !== cardId; });
    renderCards();
  }

  function toggleAlarm(cardId) {
    const card = state.taskCards.find(function (c) { return c.id === cardId; });
    if (!card) return;

    const existing = state.alarms.find(function (a) { return a.cardId === cardId && a.active; });
    if (existing) {
      existing.active = false;
      state.alarms = state.alarms.filter(function (a) { return a.active || a.fired; });
    } else {
      state.alarms.push({
        id: uid(),
        cardId: card.id,
        itemId: card.itemId,
        itemName: card.itemName,
        itemIcon: card.icon,
        startTime: Date.now(),
        endTime: Date.now() + 4 * 60 * 60 * 1000,
        active: true,
        fired: false
      });
    }
    updateAlarmBadge();
    renderCards();
    if (state.currentPage === "alarms") renderAlarms();
  }

  // ========== NEW CARD MODAL ==========
  function initNewCardModal() {
    const modal = document.getElementById("newCardModal");
    const openBtns = [document.getElementById("newCardBtn"), document.getElementById("newCardBtnEmpty")];

    openBtns.forEach(function (btn) {
      if (btn) btn.addEventListener("click", function () {
        openNewCardModal();
      });
    });

    document.getElementById("closeNewCardModal").addEventListener("click", closeNewCardModal);
    document.getElementById("cancelNewCard").addEventListener("click", closeNewCardModal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeNewCardModal(); });

    document.getElementById("createCardBtn").addEventListener("click", createCard);

    // Item search autocomplete
    const searchInput = document.getElementById("cardItemSearch");
    const dropdown = document.getElementById("cardAutocomplete");

    searchInput.addEventListener("input", function () {
      const q = this.value.toLowerCase().trim();
      if (q.length < 2) { dropdown.classList.remove("show"); return; }
      const matches = state.items.filter(function (item) {
        return item.name.toLowerCase().includes(q);
      }).slice(0, 20);

      dropdown.innerHTML = matches.map(function (item) {
        return '<div class="autocomplete-item" data-item-id="' + item.id + '">' +
          '<img src="' + getItemIcon(item.icon) + '" alt="" onerror="this.style.display=\'none\'">' +
          '<span>' + escapeHtml(item.name) + '</span></div>';
      }).join("");
      dropdown.classList.add("show");

      dropdown.querySelectorAll(".autocomplete-item").forEach(function (el) {
        el.addEventListener("click", function () {
          selectCardItem(parseInt(this.dataset.itemId));
          dropdown.classList.remove("show");
        });
      });
    });

    // Timer change
    document.getElementById("cardTimer").addEventListener("change", function () {
      document.getElementById("customTimerGroup").style.display = this.value === "custom" ? "block" : "none";
    });

    // Auto-calc previews
    ["cardBuyPrice", "cardSellPrice", "cardQuantity"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", updateCardPreview);
    });
  }

  function openNewCardModal(item) {
    const modal = document.getElementById("newCardModal");
    modal.style.display = "flex";
    state.selectedCardItem = null;

    // Reset form
    document.getElementById("cardItemSearch").value = "";
    document.getElementById("cardBuyPrice").value = "";
    document.getElementById("cardSellPrice").value = "";
    document.getElementById("cardQuantity").value = "1";
    document.getElementById("cardTimer").value = "30";
    document.getElementById("customTimerGroup").style.display = "none";
    document.getElementById("cardItemInfo").style.display = "none";
    updateCardPreview();

    if (item) {
      selectCardItem(item.id || item);
    }
  }

  function closeNewCardModal() {
    document.getElementById("newCardModal").style.display = "none";
    document.getElementById("cardAutocomplete").classList.remove("show");
  }

  function selectCardItem(itemId) {
    const item = state.itemMap[itemId];
    if (!item) return;
    state.selectedCardItem = item;

    document.getElementById("cardItemSearch").value = item.name;
    document.getElementById("cardItemInfo").style.display = "flex";
    document.getElementById("cardItemIcon").src = getItemIcon(item.icon);
    document.getElementById("cardItemName").textContent = item.name;
    document.getElementById("cardItemLimit").textContent = "Buy limit: " + (item.limit || "Unknown");

    // Fill prices from API
    const p = state.prices[item.id];
    if (p) {
      document.getElementById("cardBuyPrice").value = p.low || "";
      document.getElementById("cardSellPrice").value = p.high || "";
    }
    updateCardPreview();
  }

  function updateCardPreview() {
    const buy = parseInt(document.getElementById("cardBuyPrice").value) || 0;
    const sell = parseInt(document.getElementById("cardSellPrice").value) || 0;
    const qty = parseInt(document.getElementById("cardQuantity").value) || 1;
    const tax = geTax(sell);
    const profit = (sell - buy - tax) * qty;
    const roi = buy > 0 ? ((sell - buy - tax) / buy * 100).toFixed(1) : "0";

    document.getElementById("cardGoldNeeded").textContent = formatGPFull(buy * qty);
    document.getElementById("cardEstProfit").textContent = formatGPFull(profit);
    document.getElementById("cardEstProfit").className = profit >= 0 ? "profit-text" : "loss-text";
    document.getElementById("cardEstROI").textContent = roi + "%";
  }

  function createCard() {
    if (!state.selectedCardItem) { showToast("Select an item first", "red"); return; }
    const buy = parseInt(document.getElementById("cardBuyPrice").value) || 0;
    const sell = parseInt(document.getElementById("cardSellPrice").value) || 0;
    const qty = parseInt(document.getElementById("cardQuantity").value) || 1;
    const timerVal = document.getElementById("cardTimer").value;
    let timerMin = parseInt(timerVal);
    if (timerVal === "custom") {
      timerMin = parseInt(document.getElementById("cardCustomTimer").value) || 30;
    }

    const now = Date.now();
    const card = {
      id: uid(),
      itemId: state.selectedCardItem.id,
      itemName: state.selectedCardItem.name,
      icon: state.selectedCardItem.icon,
      buyPrice: buy,
      sellPrice: sell,
      quantity: qty,
      startTime: now,
      endTime: now + timerMin * 60 * 1000,
      status: "active",
      limit: state.selectedCardItem.limit
    };

    state.taskCards.unshift(card);
    closeNewCardModal();
    navigateTo("cards");
    showToast("Task Card created for " + card.itemName, "gold");
  }

  // ========== SCANNER ==========
  function getProcessedItems() {
    const items = [];
    for (const item of state.items) {
      const p = state.prices[item.id];
      const h = state.hourData[item.id];
      if (!p || !p.high || !p.low) continue;

      const buy = p.low;
      const sell = p.high;
      const margin = sell - buy;
      const tax = geTax(sell);
      const afterTax = margin - tax;
      const roi = buy > 0 ? (afterTax / buy * 100) : 0;
      const volume = h ? ((h.highPriceVolume || 0) + (h.lowPriceVolume || 0)) : 0;

      items.push({
        id: item.id,
        name: item.name,
        icon: item.icon,
        members: item.members,
        buy: buy,
        sell: sell,
        margin: margin,
        afterTax: afterTax,
        roi: roi,
        volume: volume,
        highalch: item.highalch || 0,
        limit: item.limit || 0,
        item: item
      });
    }
    return items;
  }

  function renderScanner() {
    const skeleton = document.getElementById("scannerSkeleton");
    const tbody = document.getElementById("scannerBody");
    const loadMore = document.getElementById("scannerLoadMore");

    if (state.items.length === 0) {
      skeleton.style.display = "flex";
      tbody.innerHTML = "";
      loadMore.style.display = "none";
      return;
    }
    skeleton.style.display = "none";

    let items = getProcessedItems();

    // Filter
    if (state.scannerFilter === "best-margins") {
      items = items.filter(function (i) { return i.afterTax > 0; });
    } else if (state.scannerFilter === "high-volume") {
      items = items.filter(function (i) { return i.volume > 100; });
    } else if (state.scannerFilter === "f2p") {
      items = items.filter(function (i) { return !i.members; });
    } else if (state.scannerFilter === "members") {
      items = items.filter(function (i) { return i.members; });
    }

    // Search
    if (state.scannerSearchText) {
      const q = state.scannerSearchText.toLowerCase();
      items = items.filter(function (i) { return i.name.toLowerCase().includes(q); });
    }

    // Sort
    items.sort(function (a, b) {
      const va = a[state.scannerSort.key] || 0;
      const vb = b[state.scannerSort.key] || 0;
      if (typeof va === "string") return va.localeCompare(vb) * state.scannerSort.dir;
      return (va - vb) * state.scannerSort.dir;
    });

    const total = items.length;
    const countEl = document.getElementById("scannerItemCount");
    if (countEl) countEl.textContent = "(" + total + " items)";
    const pageItems = items.slice(0, (state.scannerPage + 1) * ITEMS_PER_PAGE);

    tbody.innerHTML = pageItems.map(function (item) {
      const marginClass = item.afterTax >= 0 ? "positive" : "negative";
      const roiClass = item.roi > 0 ? "positive" : "";
      return '<tr class="scanner-row" data-item-id="' + item.id + '">' +
        '<td class="item-icon-cell"><img src="' + getItemIcon(item.icon) + '" alt="" onerror="this.style.display=\'none\'"></td>' +
        '<td>' + escapeHtml(item.name) + '</td>' +
        '<td class="price-buy">' + formatGP(item.buy) + '</td>' +
        '<td class="price-sell">' + formatGP(item.sell) + '</td>' +
        '<td class="price-margin ' + marginClass + '">' + formatGP(item.margin) + '</td>' +
        '<td class="price-margin ' + marginClass + '">' + formatGP(item.afterTax) + '</td>' +
        '<td class="roi-cell ' + roiClass + '">' + item.roi.toFixed(1) + '%</td>' +
        '<td>' + formatGP(item.volume) + '</td>' +
        '<td><button class="btn btn-sm btn-primary quick-flip-btn" data-item-id="' + item.id + '">Flip</button></td>' +
      '</tr>';
    }).join("");

    loadMore.style.display = pageItems.length < total ? "block" : "none";

    // Row click for detail
    tbody.querySelectorAll(".scanner-row").forEach(function (row) {
      row.addEventListener("click", function (e) {
        if (e.target.closest(".quick-flip-btn")) return;
        openDetailModal(parseInt(this.dataset.itemId));
      });
    });

    // Quick flip
    tbody.querySelectorAll(".quick-flip-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        openNewCardModal(parseInt(this.dataset.itemId));
      });
    });
  }

  function initScanner() {
    document.getElementById("scannerSearch").addEventListener("input", function () {
      state.scannerSearchText = this.value;
      state.scannerPage = 0;
      renderScanner();
    });

    document.getElementById("scannerFilterBar").addEventListener("click", function (e) {
      const pill = e.target.closest(".filter-pill");
      if (!pill) return;
      this.querySelectorAll(".filter-pill").forEach(function (p) { p.classList.remove("active"); });
      pill.classList.add("active");
      state.scannerFilter = pill.dataset.filter;
      state.scannerPage = 0;
      renderScanner();
    });

    document.querySelectorAll("#scannerTable th.sortable").forEach(function (th) {
      th.addEventListener("click", function () {
        const key = this.dataset.sort;
        if (state.scannerSort.key === key) {
          state.scannerSort.dir *= -1;
        } else {
          state.scannerSort.key = key;
          state.scannerSort.dir = -1;
        }
        state.scannerPage = 0;
        renderScanner();
      });
    });

    document.getElementById("scannerLoadMore").addEventListener("click", function () {
      state.scannerPage++;
      renderScanner();
    });
  }

  // ========== ITEM DETAIL MODAL ==========
  function openDetailModal(itemId) {
    const item = state.itemMap[itemId];
    if (!item) return;
    const p = state.prices[itemId];
    const modal = document.getElementById("itemDetailModal");

    document.getElementById("detailItemIcon").src = getItemIcon(item.icon);
    document.getElementById("detailItemName").textContent = item.name;

    if (p) {
      const buy = p.low || 0;
      const sell = p.high || 0;
      const margin = sell - buy;
      const tax = geTax(sell);
      const afterTax = margin - tax;
      const roi = buy > 0 ? ((afterTax / buy) * 100).toFixed(1) : "0";

      document.getElementById("detailBuy").textContent = formatGP(buy);
      document.getElementById("detailSell").textContent = formatGP(sell);
      document.getElementById("detailMargin").textContent = formatGP(margin);
      document.getElementById("detailAfterTax").textContent = formatGP(afterTax);
      document.getElementById("detailROI").textContent = roi + "%";

      const limit = item.limit || 0;
      document.getElementById("detailLimit").textContent = limit > 0 ? limit.toLocaleString() : "Unknown";
      const maxProfit = limit > 0 ? afterTax * limit : 0;
      document.getElementById("detailMaxProfit").textContent = maxProfit > 0 ? formatGP(maxProfit) : "—";
      document.getElementById("detailHighAlch").textContent = item.highalch ? formatGP(item.highalch) : "—";
    }

    modal.style.display = "flex";

    // Load chart
    loadTimeseriesChart(itemId);

    // Bind actions
    document.getElementById("detailQuickFlip").onclick = function () {
      modal.style.display = "none";
      openNewCardModal(itemId);
    };
    document.getElementById("detailWatchlist").onclick = function () {
      addToWatchlist(itemId);
      modal.style.display = "none";
    };
    document.getElementById("detailCalc").onclick = function () {
      modal.style.display = "none";
      navigateTo("calculator");
      // Auto-fill the calculator
      const calcSearch = document.getElementById("calcItemSearch");
      if (calcSearch) calcSearch.value = item.name;
      state.calcSelectedItem = item;
      var p2 = state.prices[itemId];
      if (p2) {
        document.getElementById("calcBuyPrice").value = p2.low || "";
        document.getElementById("calcSellPrice").value = p2.high || "";
      }
    };
  }

  async function loadTimeseriesChart(itemId) {
    const canvas = document.getElementById("detailChart");
    if (state.detailChart) { state.detailChart.destroy(); state.detailChart = null; }

    const data = await loadTimeseries(itemId, "5m");
    if (!data || data.length === 0) return;

    const labels = data.map(function (d) {
      return new Date(d.timestamp * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    });
    const highs = data.map(function (d) { return d.avgHighPrice; });
    const lows = data.map(function (d) { return d.avgLowPrice; });

    state.detailChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          { label: "Buy Price", data: highs, borderColor: "#00ff00", backgroundColor: "rgba(0,255,0,0.05)", borderWidth: 1.5, pointRadius: 0, fill: false },
          { label: "Sell Price", data: lows, borderColor: "#ff4444", backgroundColor: "rgba(255,68,68,0.05)", borderWidth: 1.5, pointRadius: 0, fill: false }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: "#888", font: { size: 11 } } },
          tooltip: { backgroundColor: "#1b1b1e", titleColor: "#e8e8e8", bodyColor: "#b5b5b5", borderColor: "rgba(255,255,255,0.1)", borderWidth: 1 }
        },
        scales: {
          x: { ticks: { color: "#666", font: { size: 10 }, maxTicksLimit: 10 }, grid: { color: "rgba(255,255,255,0.04)" } },
          y: { ticks: { color: "#888", font: { size: 10 }, callback: function (v) { return formatGP(v); } }, grid: { color: "rgba(255,255,255,0.04)" } }
        }
      }
    });
  }

  function initDetailModal() {
    const modal = document.getElementById("itemDetailModal");
    document.getElementById("closeDetailModal").addEventListener("click", function () { modal.style.display = "none"; });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.style.display = "none"; });
  }

  // ========== CALCULATOR ==========
  function initCalculator() {
    const searchInput = document.getElementById("calcItemSearch");
    const dropdown = document.getElementById("calcAutocomplete");

    searchInput.addEventListener("input", function () {
      const q = this.value.toLowerCase().trim();
      if (q.length < 2) { dropdown.classList.remove("show"); return; }
      const matches = state.items.filter(function (item) {
        return item.name.toLowerCase().includes(q);
      }).slice(0, 15);

      dropdown.innerHTML = matches.map(function (item) {
        return '<div class="autocomplete-item" data-item-id="' + item.id + '">' +
          '<img src="' + getItemIcon(item.icon) + '" alt="" onerror="this.style.display=\'none\'">' +
          '<span>' + escapeHtml(item.name) + '</span></div>';
      }).join("");
      dropdown.classList.add("show");

      dropdown.querySelectorAll(".autocomplete-item").forEach(function (el) {
        el.addEventListener("click", function () {
          const item = state.itemMap[parseInt(this.dataset.itemId)];
          if (!item) return;
          state.calcSelectedItem = item;
          searchInput.value = item.name;
          dropdown.classList.remove("show");

          const p = state.prices[item.id];
          if (p) {
            document.getElementById("calcBuyPrice").value = p.low || "";
            document.getElementById("calcSellPrice").value = p.high || "";
          }
        });
      });
    });

    document.getElementById("calcBtn").addEventListener("click", calculateTax);

    // Also calculate on enter
    document.querySelectorAll("#page-calculator .form-input").forEach(function (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") calculateTax();
      });
    });
  }

  function calculateTax() {
    const buy = parseInt(document.getElementById("calcBuyPrice").value) || 0;
    const sell = parseInt(document.getElementById("calcSellPrice").value) || 0;
    const qty = parseInt(document.getElementById("calcQuantity").value) || 1;

    const tax = geTax(sell);
    const gross = sell - buy;
    const net = gross - tax;
    const totalProfit = net * qty;
    const totalTax = tax * qty;
    const roi = buy > 0 ? ((net / buy) * 100).toFixed(2) : "0";
    const breakeven = buy > 0 ? Math.ceil(buy / 0.99) : 0;
    const limit = state.calcSelectedItem ? (state.calcSelectedItem.limit || 0) : 0;
    const maxProfit = net * limit;

    document.getElementById("resTaxUnit").textContent = formatGPFull(tax);
    document.getElementById("resGrossMargin").textContent = formatGPFull(gross);
    document.getElementById("resNetUnit").textContent = formatGPFull(net);
    document.getElementById("resTotalProfit").textContent = formatGPFull(totalProfit);
    document.getElementById("resTotalTax").textContent = formatGPFull(totalTax);
    document.getElementById("resROI").textContent = roi + "%";
    document.getElementById("resBreakeven").textContent = formatGPFull(breakeven);
    document.getElementById("resBuyLimit").textContent = limit > 0 ? limit.toLocaleString() : "Unknown";
    document.getElementById("resMaxProfit").textContent = limit > 0 ? formatGPFull(maxProfit) : "—";
  }

  // ========== ALARMS ==========
  function renderAlarms() {
    const list = document.getElementById("alarmsList");
    const empty = document.getElementById("alarmsEmpty");
    const activeAlarms = state.alarms.filter(function (a) { return a.active || a.fired; });

    if (activeAlarms.length === 0) {
      list.innerHTML = "";
      list.appendChild(empty);
      empty.style.display = "flex";
      return;
    }

    empty.style.display = "none";
    list.innerHTML = activeAlarms.map(function (alarm) {
      const now = Date.now();
      const remaining = Math.max(0, alarm.endTime - now);
      const total = alarm.endTime - alarm.startTime;
      const progress = Math.min(100, ((total - remaining) / total) * 100);
      const isReady = remaining <= 0;
      const firedClass = isReady ? "fired" : "";
      const timeText = isReady ? "Ready!" : formatTime(remaining);
      const timeClass = isReady ? "ready" : "";

      return '<div class="alarm-entry ' + firedClass + '" data-alarm-id="' + alarm.id + '">' +
        '<img src="' + getItemIcon(alarm.itemIcon) + '" alt="" class="alarm-entry-icon" onerror="this.style.display=\'none\'">' +
        '<div class="alarm-entry-info">' +
          '<div class="alarm-entry-name">' + escapeHtml(alarm.itemName) + '</div>' +
          '<div class="alarm-entry-progress"><div class="alarm-entry-progress-fill" style="width:' + progress + '%"></div></div>' +
        '</div>' +
        '<div class="alarm-entry-time ' + timeClass + '">' + timeText + '</div>' +
        '<div class="alarm-entry-actions">' +
          '<button class="btn-icon dismiss-alarm" data-alarm-id="' + alarm.id + '" title="Dismiss"><i data-lucide="x"></i></button>' +
        '</div>' +
      '</div>';
    }).join("");

    lucide.createIcons();

    list.querySelectorAll(".dismiss-alarm").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = this.dataset.alarmId;
        state.alarms = state.alarms.filter(function (a) { return a.id !== id; });
        updateAlarmBadge();
        renderAlarms();
      });
    });
  }

  function updateAlarmBadge() {
    const count = state.alarms.filter(function (a) { return a.active; }).length;
    const badge = document.getElementById("alarmBadge");
    const mobileBadge = document.getElementById("mobileAlarmBadge");
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = "inline";
      mobileBadge.textContent = count;
      mobileBadge.style.display = "inline";
    } else {
      badge.style.display = "none";
      mobileBadge.style.display = "none";
    }
  }

  function tickAlarms() {
    const now = Date.now();
    let changed = false;
    for (const alarm of state.alarms) {
      if (alarm.active && !alarm.fired && now >= alarm.endTime) {
        alarm.fired = true;
        alarm.active = false;
        changed = true;
        playAlarmSound();
        showToast(alarm.itemName + " buy limit reset! You can flip again!", "gold", 5000);
      }
    }
    if (changed) {
      updateAlarmBadge();
      if (state.currentPage === "alarms") renderAlarms();
      if (state.currentPage === "cards") renderCards();
    }
  }

  function initAlarms() {
    document.getElementById("clearAllAlarms").addEventListener("click", function () {
      state.alarms = [];
      updateAlarmBadge();
      renderAlarms();
      showToast("All alarms cleared", "", 2000);
    });
  }

  // ========== WATCHLIST ==========
  function addToWatchlist(itemId) {
    if (state.watchlist.find(function (w) { return w.id === itemId; })) {
      showToast("Already on watchlist", "", 2000);
      return;
    }
    const item = state.itemMap[itemId];
    if (!item) return;
    state.watchlist.push({ id: itemId, name: item.name, icon: item.icon });
    showToast(item.name + " added to watchlist", "gold", 2000);
    if (state.currentPage === "watchlist") renderWatchlist();
  }

  function renderWatchlist() {
    const grid = document.getElementById("watchlistGrid");
    const empty = document.getElementById("watchlistEmpty");

    if (state.watchlist.length === 0) {
      grid.innerHTML = "";
      grid.appendChild(empty);
      empty.style.display = "flex";
      return;
    }

    empty.style.display = "none";
    grid.innerHTML = state.watchlist.map(function (w) {
      const p = state.prices[w.id];
      const buy = p ? (p.low || 0) : 0;
      const sell = p ? (p.high || 0) : 0;
      const margin = sell - buy;
      const tax = geTax(sell);
      const afterTax = margin - tax;

      return '<div class="watchlist-card" data-item-id="' + w.id + '">' +
        '<div class="watchlist-card-header">' +
          '<img src="' + getItemIcon(w.icon) + '" alt="" onerror="this.style.display=\'none\'">' +
          '<span class="watchlist-card-name">' + escapeHtml(w.name) + '</span>' +
          '<button class="btn-icon remove-watchlist" data-item-id="' + w.id + '" title="Remove"><i data-lucide="x"></i></button>' +
        '</div>' +
        '<div class="watchlist-card-prices">' +
          '<span>Buy</span><span class="price-buy">' + formatGP(buy) + '</span>' +
          '<span>Sell</span><span class="price-sell">' + formatGP(sell) + '</span>' +
          '<span>Margin</span><span>' + formatGP(margin) + '</span>' +
          '<span>After Tax</span><span class="' + (afterTax >= 0 ? "profit-text" : "loss-text") + '">' + formatGP(afterTax) + '</span>' +
        '</div>' +
      '</div>';
    }).join("");

    lucide.createIcons();

    grid.querySelectorAll(".watchlist-card").forEach(function (card) {
      card.addEventListener("click", function (e) {
        if (e.target.closest(".remove-watchlist")) return;
        openDetailModal(parseInt(this.dataset.itemId));
      });
    });

    grid.querySelectorAll(".remove-watchlist").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const id = parseInt(this.dataset.itemId);
        state.watchlist = state.watchlist.filter(function (w) { return w.id !== id; });
        renderWatchlist();
      });
    });
  }

  function initWatchlist() {
    const modal = document.getElementById("watchlistModal");
    document.getElementById("addWatchlistBtn").addEventListener("click", function () { modal.style.display = "flex"; });
    document.getElementById("closeWatchlistModal").addEventListener("click", function () { modal.style.display = "none"; });
    document.getElementById("cancelWatchlist").addEventListener("click", function () { modal.style.display = "none"; });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.style.display = "none"; });

    const searchInput = document.getElementById("watchlistItemSearch");
    const dropdown = document.getElementById("watchlistAutocomplete");

    searchInput.addEventListener("input", function () {
      const q = this.value.toLowerCase().trim();
      if (q.length < 2) { dropdown.classList.remove("show"); return; }
      const matches = state.items.filter(function (item) {
        return item.name.toLowerCase().includes(q);
      }).slice(0, 15);
      dropdown.innerHTML = matches.map(function (item) {
        return '<div class="autocomplete-item" data-item-id="' + item.id + '">' +
          '<img src="' + getItemIcon(item.icon) + '" alt="" onerror="this.style.display=\'none\'">' +
          '<span>' + escapeHtml(item.name) + '</span></div>';
      }).join("");
      dropdown.classList.add("show");

      dropdown.querySelectorAll(".autocomplete-item").forEach(function (el) {
        el.addEventListener("click", function () {
          const itemId = parseInt(this.dataset.itemId);
          state.selectedWatchlistItem = itemId;
          const item = state.itemMap[itemId];
          searchInput.value = item ? item.name : "";
          dropdown.classList.remove("show");
        });
      });
    });

    document.getElementById("addWatchlistConfirm").addEventListener("click", function () {
      if (state.selectedWatchlistItem) {
        addToWatchlist(state.selectedWatchlistItem);
        state.selectedWatchlistItem = null;
        searchInput.value = "";
        modal.style.display = "none";
      }
    });
  }

  // ========== STATS ==========
  function renderStats() {
    const g = state.gamification;
    const s = state.stats;
    const sessionMs = Date.now() - s.sessionStart;
    const sessionMin = Math.floor(sessionMs / 60000);
    const profitPerHour = sessionMs > 0 ? Math.floor(s.totalProfit / (sessionMs / 3600000)) : 0;
    const avgROI = s.totalROI.length > 0 ? (s.totalROI.reduce(function (a, b) { return a + b; }, 0) / s.totalROI.length).toFixed(1) : "0";

    document.getElementById("statTotalProfit").textContent = formatGP(s.totalProfit) + " GP";
    document.getElementById("statAvgROI").textContent = avgROI + "%";
    document.getElementById("statFlipsDone").textContent = s.flipsCompleted;
    document.getElementById("statTaxPaid").textContent = formatGP(s.totalTax) + " GP";
    document.getElementById("statSessionTime").textContent = sessionMin + "m";
    document.getElementById("statProfitHour").textContent = formatGP(profitPerHour) + " GP";

    document.getElementById("statKarmaGold").textContent = g.karmaGold.toLocaleString();
    document.getElementById("statLevel").textContent = g.level + " — " + getLevelName(g.level);
    document.getElementById("statTotalExp").textContent = g.totalExp.toLocaleString();
    document.getElementById("statCardsCompleted").textContent = g.cardsCompleted;
    document.getElementById("statExpNext").textContent = expToNextLevel(g.totalExp);
    document.getElementById("statExpFill").style.width = expProgress(g.totalExp) + "%";

    renderProfitChart();
  }

  function renderProfitChart() {
    const canvas = document.getElementById("profitChart");
    if (state.profitChart) { state.profitChart.destroy(); }

    const history = state.stats.profitHistory;
    if (history.length === 0) {
      state.profitChart = new Chart(canvas, {
        type: "bar",
        data: { labels: ["No data"], datasets: [{ label: "Profit", data: [0], backgroundColor: "rgba(255,152,31,0.3)", borderColor: "#ff981f", borderWidth: 1 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#666" }, grid: { color: "rgba(255,255,255,0.04)" } }, y: { ticks: { color: "#888" }, grid: { color: "rgba(255,255,255,0.04)" } } } }
      });
      return;
    }

    const labels = history.map(function (h) { return h.item; });
    const data = history.map(function (h) { return h.profit; });
    const colors = data.map(function (v) { return v >= 0 ? "rgba(0,255,0,0.5)" : "rgba(255,68,68,0.5)"; });
    const borders = data.map(function (v) { return v >= 0 ? "#00ff00" : "#ff4444"; });

    state.profitChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Profit",
          data: data,
          backgroundColor: colors,
          borderColor: borders,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: "#1b1b1e", titleColor: "#e8e8e8", bodyColor: "#b5b5b5" } },
        scales: {
          x: { ticks: { color: "#666", font: { size: 10 } }, grid: { color: "rgba(255,255,255,0.04)" } },
          y: { ticks: { color: "#888", font: { size: 10 }, callback: function (v) { return formatGP(v); } }, grid: { color: "rgba(255,255,255,0.04)" } }
        }
      }
    });
  }

  // ========== GUIDES ==========
  const GUIDES = {
    "101": {
      title: "Flipping 101",
      content: "<h2>What is Flipping?</h2><p>Flipping is the act of buying items on the Grand Exchange at a low price and selling them at a higher price for profit. It's one of the most reliable money-making methods in OSRS.</p><h2>How the GE Works</h2><p>The Grand Exchange matches buyers and sellers. When you place a buy offer at a certain price, you'll get the item if someone sells at or below your price. The difference between what people buy and sell at is the <strong>margin</strong>.</p><h2>The GE Tax</h2><p>Jagex introduced a 1% tax on all GE sales, capped at 5M GP. This means: <code>Tax = min(sellPrice × 0.01, 5,000,000)</code>. You need to account for this in your profit calculations.</p><h2>Key Terms</h2><ul><li><strong>Margin</strong> — The difference between buy and sell price</li><li><strong>Spread</strong> — Same as margin</li><li><strong>ROI</strong> — Return on Investment (profit / buy price × 100)</li><li><strong>Buy Limit</strong> — Max items you can buy per 4 hours</li><li><strong>Margin Check</strong> — Buying and selling 1 item to find current prices</li></ul>"
    },
    "first": {
      title: "Your First Flip",
      content: "<h2>Step 1: Pick an Item</h2><p>Use the Scanner to find items with good margins. Start with commonly traded items like <strong>runes</strong>, <strong>food</strong>, or <strong>potions</strong>. These have high volume and stable prices.</p><h2>Step 2: Margin Check</h2><p>Buy 1 of the item at a very high price (instant buy) and sell 1 at a very low price (instant sell). The prices you get show the current margin.</p><h2>Step 3: Place Your Offers</h2><p>Now place a buy offer at the instant sell price and a sell offer at the instant buy price. Wait for them to complete.</p><h2>Step 4: Calculate Profit</h2><p>Your profit per item is: <code>Sell Price - Buy Price - Tax</code>. Use the Calculator page to compute this precisely.</p><h2>Tips for Beginners</h2><ul><li>Start with low-value items to minimize risk</li><li>Always account for the 1% GE tax</li><li>Don't invest all your gold in one item</li><li>Check buy limits — you can only buy so many per 4 hours</li></ul>"
    },
    "limits": {
      title: "Buy Limits",
      content: "<h2>What are Buy Limits?</h2><p>Every item on the GE has a buy limit — the maximum number you can purchase every 4 hours. This prevents market manipulation and ensures everyone has fair access.</p><h2>Common Buy Limits</h2><ul><li><strong>Runes</strong> — 13,000-25,000</li><li><strong>Food</strong> — 6,000-13,000</li><li><strong>Potions</strong> — 2,000-10,000</li><li><strong>Weapons/Armor</strong> — 8-125</li><li><strong>Rare items</strong> — 2-8</li></ul><h2>4-Hour Timer</h2><p>Your buy limit resets exactly 4 hours after your first purchase. Use the Alarm feature on Task Cards to get notified when you can buy again.</p><h2>Strategy</h2><p>To maximize profit, calculate the max profit at buy limit: <code>Net Profit Per Item × Buy Limit</code>. Items with higher limits can generate more total profit even with smaller margins.</p>"
    },
    "advanced": {
      title: "Advanced Tips",
      content: "<h2>Volume Analysis</h2><p>High-volume items flip faster but usually have smaller margins. Low-volume items can have huge margins but may take hours to sell. Balance is key.</p><h2>Time of Day</h2><p>Prices fluctuate throughout the day. Peak hours (evening EU/US) have the most volume. Off-peak hours often have wider margins but fewer trades.</p><h2>Update Days</h2><p>OSRS updates happen on Wednesdays. Items mentioned in updates can see huge price swings. Plan your flips accordingly.</p><h2>Multiple Flips</h2><p>Run 8 GE slots simultaneously. Diversify across item types to reduce risk. Use Task Cards to track all active flips.</p><h2>Margin Monitoring</h2><p>Margins change constantly. Re-check margins every 15-30 minutes for active items. The Scanner auto-refreshes every 60 seconds.</p><h2>Risk Management</h2><ul><li>Never invest more than 20% of your total gold in one item</li><li>Set stop-losses mentally — if an item drops 5%, cut your losses</li><li>Avoid items with recent price spikes — they often crash back</li><li>Keep a cash reserve for opportunities</li></ul>"
    }
  };

  function renderGuides(tab) {
    const guide = GUIDES[tab || "101"];
    if (!guide) return;
    document.getElementById("guideContent").innerHTML = guide.content;

    document.querySelectorAll("#page-guides .filter-pill").forEach(function (p) {
      p.classList.toggle("active", p.dataset.guide === tab);
    });
  }

  function initGuides() {
    document.querySelector("#page-guides .guides-tabs").addEventListener("click", function (e) {
      const pill = e.target.closest(".filter-pill");
      if (!pill) return;
      renderGuides(pill.dataset.guide);
    });
  }

  // ========== BLOG ==========
  function renderBlog() {
    const list = document.getElementById("blogList");
    const empty = document.getElementById("blogEmpty");
    const postView = document.getElementById("blogPostView");

    postView.style.display = "none";
    list.style.display = "flex";

    if (state.blogPosts.length === 0) {
      list.innerHTML = "";
      list.appendChild(empty);
      empty.style.display = "flex";
      return;
    }

    empty.style.display = "none";
    list.innerHTML = state.blogPosts.map(function (post) {
      const excerpt = post.content.replace(/[#*`\[\]()]/g, "").substring(0, 150) + "...";
      return '<div class="blog-card" data-post-id="' + post.id + '">' +
        '<div class="blog-card-title">' + escapeHtml(post.title) + '</div>' +
        '<div class="blog-card-date">' + post.date + '</div>' +
        '<div class="blog-card-excerpt">' + escapeHtml(excerpt) + '</div>' +
      '</div>';
    }).join("");

    list.querySelectorAll(".blog-card").forEach(function (card) {
      card.addEventListener("click", function () {
        const postId = this.dataset.postId;
        showBlogPost(postId);
      });
    });
  }

  function showBlogPost(postId) {
    const post = state.blogPosts.find(function (p) { return p.id === postId; });
    if (!post) return;

    document.getElementById("blogList").style.display = "none";
    const postView = document.getElementById("blogPostView");
    postView.style.display = "block";

    document.getElementById("blogArticle").innerHTML =
      '<h1>' + escapeHtml(post.title) + '</h1>' +
      '<div class="blog-article-date">' + post.date + '</div>' +
      renderMarkdown(post.content);
  }

  function initBlog() {
    document.getElementById("blogBackBtn").addEventListener("click", function () {
      renderBlog();
    });
  }

  // ========== ADMIN ==========
  function renderAdmin() {
    if (!state.adminAuthed) {
      document.getElementById("adminAuth").style.display = "block";
      document.getElementById("adminPanel").style.display = "none";
    } else {
      document.getElementById("adminAuth").style.display = "none";
      document.getElementById("adminPanel").style.display = "block";
      renderAdminPosts();
    }
  }

  function renderAdminPosts() {
    const list = document.getElementById("adminPostsList");
    if (state.blogPosts.length === 0) {
      list.innerHTML = '<p class="text-muted">No posts yet.</p>';
      return;
    }
    list.innerHTML = state.blogPosts.map(function (post) {
      return '<div class="admin-post-item">' +
        '<div><span class="admin-post-item-title">' + escapeHtml(post.title) + '</span> <span class="admin-post-item-date">' + post.date + '</span></div>' +
        '<div class="admin-post-item-actions">' +
          '<button class="btn btn-sm btn-secondary edit-post" data-post-id="' + post.id + '">Edit</button>' +
          '<button class="btn btn-sm btn-danger delete-post" data-post-id="' + post.id + '">Delete</button>' +
        '</div>' +
      '</div>';
    }).join("");

    list.querySelectorAll(".edit-post").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const post = state.blogPosts.find(function (p) { return p.id === btn.dataset.postId; });
        if (post) {
          state.editingPostId = post.id;
          document.getElementById("adminPostTitle").value = post.title;
          document.getElementById("adminPostContent").value = post.content;
          updateAdminPreview();
        }
      });
    });

    list.querySelectorAll(".delete-post").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.blogPosts = state.blogPosts.filter(function (p) { return p.id !== btn.dataset.postId; });
        renderAdminPosts();
        showToast("Post deleted", "", 2000);
      });
    });
  }

  function updateAdminPreview() {
    const content = document.getElementById("adminPostContent").value;
    document.getElementById("adminPreview").innerHTML = renderMarkdown(content);
  }

  function initAdmin() {
    document.getElementById("adminLoginBtn").addEventListener("click", function () {
      const pw = document.getElementById("adminPassword").value;
      if (pw === "flipit2admin") {
        state.adminAuthed = true;
        document.getElementById("adminError").style.display = "none";
        renderAdmin();
      } else {
        document.getElementById("adminError").style.display = "block";
      }
    });

    document.getElementById("adminPostContent").addEventListener("input", updateAdminPreview);

    document.getElementById("adminPublishBtn").addEventListener("click", function () {
      const title = document.getElementById("adminPostTitle").value.trim();
      const content = document.getElementById("adminPostContent").value.trim();
      if (!title || !content) { showToast("Title and content required", "red"); return; }

      if (state.editingPostId) {
        const post = state.blogPosts.find(function (p) { return p.id === state.editingPostId; });
        if (post) {
          post.title = title;
          post.content = content;
        }
        state.editingPostId = null;
        showToast("Post updated", "gold");
      } else {
        state.blogPosts.unshift({
          id: uid(),
          title: title,
          date: new Date().toISOString().split("T")[0],
          content: content
        });
        showToast("Post published", "gold");
      }

      document.getElementById("adminPostTitle").value = "";
      document.getElementById("adminPostContent").value = "";
      document.getElementById("adminPreview").innerHTML = "";
      renderAdminPosts();
    });

    document.getElementById("adminClearBtn").addEventListener("click", function () {
      document.getElementById("adminPostTitle").value = "";
      document.getElementById("adminPostContent").value = "";
      document.getElementById("adminPreview").innerHTML = "";
      state.editingPostId = null;
    });
  }

  // ========== SETTINGS ==========
  function renderSettings() {
    const g = state.gamification;
    document.getElementById("settingsKarma").textContent = g.karmaGold.toLocaleString();
    document.getElementById("settingsExp").textContent = g.totalExp.toLocaleString();
    document.getElementById("settingsLevel").textContent = g.level + " — " + getLevelName(g.level);
    document.getElementById("settingsName").value = state.auth.username;
  }

  function initSettings() {
    document.getElementById("settingsName").addEventListener("change", function () {
      state.auth.username = this.value || "Guest";
    });

    document.getElementById("generateApiKey").addEventListener("click", function () {
      const key = "flt2_" + uid() + uid();
      document.getElementById("settingsApiKey").value = key;
      showToast("API Key generated", "gold");
    });

    document.getElementById("exportJsonBtn").addEventListener("click", function () {
      const data = JSON.stringify({
        taskCards: state.taskCards,
        gamification: state.gamification,
        stats: state.stats,
        watchlist: state.watchlist,
        blogPosts: state.blogPosts
      }, null, 2);
      downloadFile("flipit2-export.json", data, "application/json");
    });

    document.getElementById("exportCsvBtn").addEventListener("click", function () {
      let csv = "Item,Buy,Sell,Quantity,Status,Profit\n";
      for (const card of state.taskCards) {
        const tax = geTax(card.sellPrice);
        const profit = (card.sellPrice - card.buyPrice - tax) * card.quantity;
        csv += [card.itemName, card.buyPrice, card.sellPrice, card.quantity, card.status, profit].join(",") + "\n";
      }
      downloadFile("flipit2-export.csv", csv, "text/csv");
    });

    document.getElementById("importBtn").addEventListener("click", function () {
      document.getElementById("importFileInput").click();
    });

    document.getElementById("importFileInput").addEventListener("change", function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const data = JSON.parse(e.target.result);
          if (data.taskCards) state.taskCards = data.taskCards;
          if (data.gamification) Object.assign(state.gamification, data.gamification);
          if (data.stats) Object.assign(state.stats, data.stats);
          if (data.watchlist) state.watchlist = data.watchlist;
          if (data.blogPosts) state.blogPosts = data.blogPosts;
          updateGamificationUI();
          showToast("Data imported", "gold");
        } catch (err) {
          showToast("Invalid file", "red");
        }
      };
      reader.readAsText(file);
    });

    document.getElementById("clearAllBtn").addEventListener("click", function () {
      state.taskCards = [];
      state.alarms = [];
      state.watchlist = [];
      state.gamification = { karmaGold: 0, totalExp: 0, level: 1, cardsCompleted: 0 };
      state.stats = { totalProfit: 0, totalTax: 0, totalROI: [], flipsCompleted: 0, profitHistory: [], sessionStart: Date.now() };
      updateGamificationUI();
      showToast("All data cleared", "", 2000);
    });
  }

  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ========== AUTH ==========
  function initAuth() {
    const modal = document.getElementById("authModal");
    document.getElementById("authBtn").addEventListener("click", function () { modal.style.display = "flex"; });
    document.getElementById("closeAuthModal").addEventListener("click", function () { modal.style.display = "none"; });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.style.display = "none"; });

    document.getElementById("authLoginTab").addEventListener("click", function () {
      document.getElementById("authLoginForm").style.display = "block";
      document.getElementById("authRegisterForm").style.display = "none";
      document.getElementById("authLoginTab").classList.add("active");
      document.getElementById("authRegisterTab").classList.remove("active");
      document.getElementById("authModalTitle").textContent = "Login";
    });

    document.getElementById("authRegisterTab").addEventListener("click", function () {
      document.getElementById("authLoginForm").style.display = "none";
      document.getElementById("authRegisterForm").style.display = "block";
      document.getElementById("authRegisterTab").classList.add("active");
      document.getElementById("authLoginTab").classList.remove("active");
      document.getElementById("authModalTitle").textContent = "Register";
    });

    document.getElementById("loginBtn").addEventListener("click", function () {
      const u = document.getElementById("loginUsername").value.trim();
      const p = document.getElementById("loginPassword").value;
      const user = state.auth.users.find(function (usr) { return usr.username === u && usr.password === p; });
      if (user) {
        state.auth.loggedIn = true;
        state.auth.username = u;
        modal.style.display = "none";
        showToast("Welcome back, " + u + "!", "gold");
      } else {
        showToast("Invalid credentials", "red");
      }
    });

    document.getElementById("registerBtn").addEventListener("click", function () {
      const u = document.getElementById("registerUsername").value.trim();
      const p = document.getElementById("registerPassword").value;
      if (!u || !p) { showToast("Fill in all fields", "red"); return; }
      if (state.auth.users.find(function (usr) { return usr.username === u; })) {
        showToast("Username taken", "red"); return;
      }
      state.auth.users.push({ username: u, password: p });
      state.auth.loggedIn = true;
      state.auth.username = u;
      modal.style.display = "none";
      showToast("Account created! Welcome, " + u + "!", "gold");
    });

    document.getElementById("guestBtn").addEventListener("click", function () {
      state.auth.loggedIn = true;
      state.auth.username = "Guest";
      modal.style.display = "none";
      showToast("Continuing as Guest", "");
    });
  }

  // ========== GAMIFICATION UI ==========
  function updateGamificationUI() {
    const g = state.gamification;
    g.level = calcLevel(g.totalExp);

    document.getElementById("headerKarmaGold").textContent = g.karmaGold.toLocaleString();
    document.getElementById("headerLevel").textContent = g.level;
    document.getElementById("headerExpFill").style.width = expProgress(g.totalExp) + "%";
  }

  // ========== CARD FILTER ==========
  function initCardFilters() {
    document.getElementById("cardsFilterBar").addEventListener("click", function (e) {
      const pill = e.target.closest(".filter-pill");
      if (!pill) return;
      this.querySelectorAll(".filter-pill").forEach(function (p) { p.classList.remove("active"); });
      pill.classList.add("active");
      state.cardsFilter = pill.dataset.filter;
      renderCards();
    });
  }

  // ========== TIMERS ==========
  function startTimers() {
    // API countdown
    setInterval(function () {
      state.apiCountdown--;
      if (state.apiCountdown <= 0) {
        state.apiCountdown = 60;
        refreshPrices();
      }
      document.getElementById("apiTimerText").textContent = state.apiCountdown + "s";
    }, 1000);

    // Alarm ticks + card timer updates
    setInterval(function () {
      tickAlarms();
      // Update active card timers and alarms UI
      if (state.currentPage === "cards") {
        const now = Date.now();
        document.querySelectorAll(".task-card[data-card-id]").forEach(function (el) {
          const cardId = el.dataset.cardId;
          const card = state.taskCards.find(function (c) { return c.id === cardId; });
          if (!card || card.status !== "active") return;
          const remaining = Math.max(0, card.endTime - now);
          const total = card.endTime - card.startTime;
          const progress = Math.min(100, ((now - card.startTime) / total) * 100);
          const timerVal = el.querySelector(".task-card-timer-value");
          const progressFill = el.querySelector(".task-card-progress-fill");
          if (timerVal) timerVal.textContent = formatTimeShort(remaining);
          if (progressFill) {
            progressFill.style.width = progress + "%";
            if (progress > 80) progressFill.classList.add("low");
          }
          if (remaining <= 0 && card.status === "active") {
            card.status = "expired";
            renderCards();
          }
        });
      }
      if (state.currentPage === "alarms") {
        renderAlarms();
      }
    }, 1000);
  }

  // ========== CLOSE DROPDOWNS ON CLICK OUTSIDE ==========
  document.addEventListener("click", function (e) {
    document.querySelectorAll(".autocomplete-dropdown.show").forEach(function (d) {
      if (!d.parentElement.contains(e.target)) d.classList.remove("show");
    });
  });

  // ========== INIT ==========
  async function init() {
    initRouting();
    initSidebar();
    initNewCardModal();
    initScanner();
    initDetailModal();
    initCalculator();
    initAlarms();
    initWatchlist();
    initGuides();
    initBlog();
    initAdmin();
    initSettings();
    initAuth();
    initCardFilters();
    updateGamificationUI();

    // Initialize Lucide icons
    lucide.createIcons();

    // Load data
    await initData();

    startTimers();

    showToast("OSRS Flipit2 loaded — Prices updated!", "gold", 3000);
  }

  // Start
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
