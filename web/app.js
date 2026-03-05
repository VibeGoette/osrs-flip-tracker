/* OSRS Flipit2 — Complete Application Logic */
/* eslint-disable no-unused-vars */
(function () {
  "use strict";

  // ========== STATE ==========
  var state = {
    items: [],          // mapping data [{id, name, icon, examine, members, lowalch, highalch, limit, value}]
    itemMap: {},        // id -> item
    prices: {},         // id -> {high, highTime, low, lowTime}
    hourData: {},       // id -> {avgHighPrice, highPriceVolume, avgLowPrice, lowPriceVolume}
    dayData: {},        // id -> {avgHighPrice, highPriceVolume, avgLowPrice, lowPriceVolume} (24h)
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
    auth: { loggedIn: false, username: "Guest", users: [], isPro: false },
    adminAuthed: false,
    currentPage: "cards",
    previousPage: "cards",
    scannerPage: 0,
    scannerSort: { key: "afterTax", dir: -1 },
    scannerFilter: "all",
    scannerSearchText: "",
    cardsFilter: "all",
    apiCountdown: 60,
    selectedCardItem: null,
    selectedWatchlistItem: null,
    itemDetailChart: null,
    profitChart: null,
    calcSelectedItem: null,
    editingPostId: null,
    // Feed system
    smartFlips: [],
    randomFlips: [],
    flipHistory: [],
    cardsTab: "smart",
    skippedItems: {},
    dataLoaded: false,
    // Smart flips filters/sort
    smartVolumeMin: 50,
    smartSort: "score",
    smartRecentlyTraded: false,
    // Random flips filter
    randomVolumeMin: 0,
    // Item detail page
    itemDetailId: null,
    itemDetailRefreshCooldown: 0,
    itemDetailRefreshTimer: null,
    // Free/Pro gating
    freeConfig: {
      dailyLimit: 20,
      refreshesPerWindow: 2,
      refreshWindowHours: 4
    },
    freeUsage: {
      cardsFlippedToday: 0,
      lastResetDate: null,
      refreshesUsed: 0,
      lastRefreshReset: null
    }
  };

  var LEVEL_NAMES = {
    1: "Novice", 5: "Apprentice", 10: "Journeyman", 15: "Expert",
    20: "Master", 25: "Grandmaster"
  };

  var API_BASE = "https://prices.runescape.wiki/api/v1/osrs";
  var HEADERS = { "User-Agent": "osrs-flip-tracker - @VibeGoette on GitHub" };
  var WIKI_ICON_BASE = "https://oldschool.runescape.wiki/images/";
  var ITEMS_PER_PAGE = 200;

  // ========== HELPERS ==========
  function formatGP(n) {
    if (n == null || isNaN(n)) return "\u2014";
    var abs = Math.abs(n);
    var sign = n < 0 ? "-" : "";
    if (abs >= 1e9) return sign + (abs / 1e9).toFixed(1) + "B";
    if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + "M";
    if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + "K";
    return sign + abs.toLocaleString();
  }

  function formatGPFull(n) {
    if (n == null || isNaN(n)) return "\u2014";
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
    var name = "Novice";
    var keys = Object.keys(LEVEL_NAMES).map(Number).sort(function (a, b) { return a - b; });
    for (var i = 0; i < keys.length; i++) {
      if (level >= keys[i]) name = LEVEL_NAMES[keys[i]];
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
    var totalSec = Math.floor(ms / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function formatTimeShort(ms) {
    if (ms <= 0) return "0s";
    var totalSec = Math.floor(ms / 1000);
    if (totalSec < 60) return totalSec + "s";
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    if (m < 60) return m + "m " + s + "s";
    var h = Math.floor(m / 60);
    return h + "h " + (m % 60) + "m";
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function formatTimestamp(ts) {
    var d = new Date(ts);
    var month = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    var hours = String(d.getHours()).padStart(2, "0");
    var mins = String(d.getMinutes()).padStart(2, "0");
    return d.getFullYear() + "-" + month + "-" + day + " " + hours + ":" + mins;
  }

  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function getTodayString() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  // ========== TOAST ==========
  function showToast(msg, type, duration) {
    type = type || "";
    duration = duration || 3000;
    var container = document.getElementById("toastContainer");
    var toast = document.createElement("div");
    toast.className = "toast " + type;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(40px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(function () { toast.remove(); }, 300);
    }, duration);
  }

  // ========== ALARM SOUND ==========
  function playAlarmSound() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
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
    var html = md;
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
  function apiFetch(endpoint) {
    return fetch(API_BASE + endpoint, {
      headers: HEADERS
    }).then(function (res) {
      if (!res.ok) throw new Error("API error: " + res.status);
      return res.json();
    }).catch(function (e) {
      console.error("API fetch failed:", endpoint, e);
      return null;
    });
  }

  function loadMapping() {
    return apiFetch("/mapping").then(function (data) {
      if (data) {
        state.items = data;
        state.itemMap = {};
        for (var i = 0; i < data.length; i++) {
          state.itemMap[data[i].id] = data[i];
        }
      }
    });
  }

  function loadPrices() {
    return apiFetch("/latest").then(function (data) {
      if (data && data.data) {
        state.prices = data.data;
      }
    });
  }

  function loadHourData() {
    return apiFetch("/1h").then(function (data) {
      if (data && data.data) {
        state.hourData = data.data;
      }
    });
  }

  function loadDayData() {
    return apiFetch("/24h").then(function (data) {
      if (data && data.data) {
        state.dayData = data.data;
      }
    });
  }

  function loadTimeseries(itemId, timestep) {
    timestep = timestep || "5m";
    return apiFetch("/timeseries?id=" + itemId + "&timestep=" + timestep).then(function (data) {
      if (data && data.data) return data.data;
      return [];
    });
  }

  function initData() {
    return Promise.all([loadMapping(), loadPrices(), loadHourData(), loadDayData()]).then(function () {
      state.dataLoaded = true;
      generateSmartFlips();
      generateRandomFlips();
      renderCurrentPage();
    });
  }

  function refreshPrices() {
    return Promise.all([loadPrices(), loadHourData(), loadDayData()]).then(function () {
      if (state.dataLoaded) {
        generateSmartFlips();
        generateRandomFlips();
      }
      if (state.currentPage === "scanner") renderScanner();
      if (state.currentPage === "watchlist") renderWatchlist();
      if (state.currentPage === "cards") {
        if (state.cardsTab === "smart") renderSmartFlips();
        if (state.cardsTab === "random") renderRandomFlips();
      }
      updateGamificationUI();
    });
  }

  // ========== PROCESSED ITEMS ==========
  function getProcessedItems() {
    var items = [];
    for (var i = 0; i < state.items.length; i++) {
      var item = state.items[i];
      var p = state.prices[item.id];
      var h = state.hourData[item.id];
      if (!p || !p.high || !p.low) continue;

      var buy = p.low;
      var sell = p.high;
      var margin = sell - buy;
      var tax = geTax(sell);
      var afterTax = margin - tax;
      var roi = buy > 0 ? (afterTax / buy * 100) : 0;
      var volume = h ? ((h.highPriceVolume || 0) + (h.lowPriceVolume || 0)) : 0;

      // lastTradeTime: most recent of highTime/lowTime (unix seconds)
      var lastTradeTime = Math.max(p.highTime || 0, p.lowTime || 0);

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
        lastTradeTime: lastTradeTime,
        item: item
      });
    }
    return items;
  }

  // ========== SMART FLIPS ALGORITHM ==========
  function generateSmartFlips() {
    if (!state.dataLoaded) return;
    var items = getProcessedItems();

    // Filter: afterTax > 0, volume > 10, buy > 100
    items = items.filter(function (i) {
      return i.afterTax > 0 && i.volume > 10 && i.buy > 100;
    });

    // Score each: score = (afterTax * sqrt(volume)) / max(1, buy/10000)
    for (var i = 0; i < items.length; i++) {
      items[i].score = (items[i].afterTax * Math.sqrt(items[i].volume)) / Math.max(1, items[i].buy / 10000);
    }

    // Sort by score descending
    items.sort(function (a, b) { return b.score - a.score; });

    // Filter out items already in active task cards or skipped
    var activeItemIds = {};
    for (var j = 0; j < state.taskCards.length; j++) {
      if (state.taskCards[j].status === "active") {
        activeItemIds[state.taskCards[j].itemId] = true;
      }
    }

    items = items.filter(function (i) {
      return !activeItemIds[i.id] && !state.skippedItems[i.id];
    });

    // Take top 50 (we'll filter/sort in render)
    state.smartFlips = items.slice(0, 50);
  }

  // ========== RANDOM FLIPS ALGORITHM ==========
  function generateRandomFlips() {
    if (!state.dataLoaded) return;
    var items = getProcessedItems();

    // Filter: afterTax > 0, buy > 100
    items = items.filter(function (i) {
      return i.afterTax > 0 && i.buy > 100;
    });

    // Fisher-Yates shuffle
    for (var i = items.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = items[i];
      items[i] = items[j];
      items[j] = temp;
    }

    // Filter out active cards and skipped
    var activeItemIds = {};
    for (var k = 0; k < state.taskCards.length; k++) {
      if (state.taskCards[k].status === "active") {
        activeItemIds[state.taskCards[k].itemId] = true;
      }
    }

    items = items.filter(function (i) {
      return !activeItemIds[i.id] && !state.skippedItems[i.id];
    });

    // Take first 5 that meet volume threshold
    var filtered = items.filter(function (i) {
      return i.volume >= state.randomVolumeMin;
    });
    if (filtered.length < 5) filtered = items; // fallback if not enough
    state.randomFlips = filtered.slice(0, 5);
  }

  // ========== FREE TIER LOGIC ==========
  function checkDailyReset() {
    var today = getTodayString();
    if (state.freeUsage.lastResetDate !== today) {
      state.freeUsage.cardsFlippedToday = 0;
      state.freeUsage.lastResetDate = today;
    }
  }

  function checkRefreshWindowReset() {
    if (!state.freeUsage.lastRefreshReset) {
      state.freeUsage.refreshesUsed = 0;
      state.freeUsage.lastRefreshReset = Date.now();
      return;
    }
    var windowMs = state.freeConfig.refreshWindowHours * 60 * 60 * 1000;
    if (Date.now() - state.freeUsage.lastRefreshReset >= windowMs) {
      state.freeUsage.refreshesUsed = 0;
      state.freeUsage.lastRefreshReset = Date.now();
    }
  }

  function isProUser() {
    return state.auth.loggedIn && state.auth.isPro;
  }

  function getRefreshWindowRemaining() {
    if (!state.freeUsage.lastRefreshReset) return 0;
    var windowMs = state.freeConfig.refreshWindowHours * 60 * 60 * 1000;
    var remaining = windowMs - (Date.now() - state.freeUsage.lastRefreshReset);
    return Math.max(0, remaining);
  }

  function formatRefreshCountdown(ms) {
    var totalSec = Math.floor(ms / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    return h + "h " + String(m).padStart(2, "0") + "m";
  }

  function canFlipMoreCards() {
    if (isProUser()) return true;
    checkDailyReset();
    return state.freeUsage.cardsFlippedToday < state.freeConfig.dailyLimit;
  }

  function canRefresh() {
    if (isProUser()) return true;
    checkRefreshWindowReset();
    return state.freeUsage.refreshesUsed < state.freeConfig.refreshesPerWindow;
  }

  function updateTierBadge() {
    var badge = document.getElementById("tierBadge");
    if (!badge) return;
    if (!state.auth.loggedIn) {
      badge.textContent = "";
      badge.className = "tier-badge";
    } else if (isProUser()) {
      badge.textContent = "PRO";
      badge.className = "tier-badge pro-badge";
    } else {
      badge.textContent = "FREE";
      badge.className = "tier-badge free-badge";
    }
  }

  // ========== TREND CALCULATION ==========
  function calc1dTrend(itemId) {
    var p = state.prices[itemId];
    var d = state.dayData[itemId];
    if (!p || !d || !p.low || !d.avgLowPrice) return "neutral";
    var currentLow = p.low;
    var avgLow = d.avgLowPrice;
    var pctChange = (currentLow - avgLow) / avgLow;
    if (pctChange > 0.02) return "up";
    if (pctChange < -0.02) return "down";
    return "neutral";
  }

  function getTrendHtml(trend) {
    if (trend === "up") return '<span class="trend-up">\u2191 Up</span>';
    if (trend === "down") return '<span class="trend-down">\u2193 Down</span>';
    return '<span class="trend-neutral">\u2192 Flat</span>';
  }

  function getTrendBadgeHtml(trend, label) {
    if (trend === "up") return '<span class="feed-trend-badge trend-up">1D \u2191</span>';
    if (trend === "down") return '<span class="feed-trend-badge trend-down">1D \u2193</span>';
    return '<span class="feed-trend-badge trend-neutral">1D \u2192</span>';
  }

  // ========== ROUTING ==========
  function navigateTo(page) {
    state.previousPage = state.currentPage;
    state.currentPage = page;
    // Hide all pages
    document.querySelectorAll(".page").forEach(function (p) { p.style.display = "none"; });
    var el = document.getElementById("page-" + page);
    if (el) el.style.display = "block";

    // Update nav (don't update for itemdetail since it's not in sidebar)
    if (page !== "itemdetail") {
      document.querySelectorAll(".nav-item").forEach(function (n) {
        n.classList.toggle("active", n.dataset.page === page);
      });
      document.querySelectorAll(".mobile-nav-item").forEach(function (n) {
        n.classList.toggle("active", n.dataset.page === page);
      });
    }

    renderCurrentPage();
    // Close mobile sidebar
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebarOverlay").classList.remove("show");
  }

  function renderCurrentPage() {
    switch (state.currentPage) {
      case "cards": renderFeedPage(); break;
      case "itemdetail": renderItemDetailPage(); break;
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
    var hash = window.location.hash.replace("#", "") || "cards";
    navigateTo(hash);

    window.addEventListener("hashchange", function () {
      var hash2 = window.location.hash.replace("#", "") || "cards";
      if (hash2 === "itemdetail") return; // navigated programmatically
      navigateTo(hash2);
    });

    // Nav clicks
    document.querySelectorAll("[data-page]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        var page = this.dataset.page;
        window.location.hash = "#" + page;
      });
    });
  }

  // ========== SIDEBAR TOGGLE ==========
  function initSidebar() {
    var toggle = document.getElementById("sidebarToggle");
    var sidebar = document.getElementById("sidebar");
    var overlay = document.getElementById("sidebarOverlay");

    toggle.addEventListener("click", function () {
      sidebar.classList.toggle("open");
      overlay.classList.toggle("show");
    });
    overlay.addEventListener("click", function () {
      sidebar.classList.remove("open");
      overlay.classList.remove("show");
    });
  }

  // ========== FEED PAGE (TABS) ==========
  function renderFeedPage() {
    updateActiveTabCount();
    // Show auth gate if not logged in
    var gate = document.getElementById("feedAuthGate");
    if (gate) {
      if (!state.auth.loggedIn) {
        gate.style.display = "flex";
      } else {
        gate.style.display = "none";
        switchFeedTab(state.cardsTab);
      }
    } else {
      switchFeedTab(state.cardsTab);
    }
  }

  function switchFeedTab(tab) {
    state.cardsTab = tab;

    // Update tab buttons
    document.querySelectorAll(".feed-tab").forEach(function (t) {
      t.classList.toggle("active", t.dataset.tab === tab);
    });

    // Show/hide panels
    document.getElementById("feedSmart").style.display = tab === "smart" ? "block" : "none";
    document.getElementById("feedRandom").style.display = tab === "random" ? "block" : "none";
    document.getElementById("feedActive").style.display = tab === "active" ? "block" : "none";
    document.getElementById("feedHistory").style.display = tab === "history" ? "block" : "none";

    // Render the active panel
    if (tab === "smart") renderSmartFlips();
    if (tab === "random") renderRandomFlips();
    if (tab === "active") renderCards();
    if (tab === "history") renderHistory();
  }

  function updateActiveTabCount() {
    var count = 0;
    for (var i = 0; i < state.taskCards.length; i++) {
      if (state.taskCards[i].status === "active") count++;
    }
    var el = document.getElementById("activeTabCount");
    if (el) el.textContent = count;
  }

  function initFeedTabs() {
    document.getElementById("feedTabs").addEventListener("click", function (e) {
      var tab = e.target.closest(".feed-tab");
      if (!tab) return;
      if (!state.auth.loggedIn && (tab.dataset.tab === "smart" || tab.dataset.tab === "random")) {
        openAuthModal();
        return;
      }
      switchFeedTab(tab.dataset.tab);
    });

    document.getElementById("shuffleRandomBtn").addEventListener("click", function () {
      if (!canRefresh()) {
        var remaining = getRefreshWindowRemaining();
        showToast("Refresh limit reached. Resets in " + formatRefreshCountdown(remaining), "red", 3000);
        return;
      }
      if (!isProUser()) {
        checkRefreshWindowReset();
        state.freeUsage.refreshesUsed++;
      }
      generateRandomFlips();
      renderRandomFlips();
      showToast("Shuffled! New random flips.", "gold", 2000);
    });

    document.getElementById("clearHistoryBtn").addEventListener("click", function () {
      state.flipHistory = [];
      renderHistory();
      showToast("History cleared", "", 2000);
    });

    // Auth gate buttons
    var gateLogin = document.getElementById("gateLoginBtn");
    var gateReg = document.getElementById("gateRegisterBtn");
    if (gateLogin) gateLogin.addEventListener("click", function () { openAuthModal("login"); });
    if (gateReg) gateReg.addEventListener("click", function () { openAuthModal("register"); });

    // Smart flips filter/sort
    var smartSlider = document.getElementById("smartVolumeSlider");
    if (smartSlider) {
      smartSlider.addEventListener("input", function () {
        state.smartVolumeMin = parseInt(this.value);
        document.getElementById("smartVolumeVal").textContent = this.value;
        renderSmartFlips();
      });
    }

    var smartSort = document.getElementById("smartSortSelect");
    if (smartSort) {
      smartSort.addEventListener("change", function () {
        state.smartSort = this.value;
        renderSmartFlips();
      });
    }

    var smartRecentCheckbox = document.getElementById("smartRecentlyTraded");
    if (smartRecentCheckbox) {
      smartRecentCheckbox.addEventListener("change", function () {
        state.smartRecentlyTraded = this.checked;
        renderSmartFlips();
      });
    }

    // Random flips volume slider
    var randomSlider = document.getElementById("randomVolumeSlider");
    if (randomSlider) {
      randomSlider.addEventListener("input", function () {
        state.randomVolumeMin = parseInt(this.value);
        document.getElementById("randomVolumeVal").textContent = this.value;
        generateRandomFlips();
        renderRandomFlips();
      });
    }

    // Upgrade buttons
    var smartUpgrade = document.getElementById("smartUpgradeBtn");
    if (smartUpgrade) smartUpgrade.addEventListener("click", function () { showToast("Pro upgrade coming soon!", "gold", 3000); });
    var randomUpgrade = document.getElementById("randomUpgradeBtn");
    if (randomUpgrade) randomUpgrade.addEventListener("click", function () { showToast("Pro upgrade coming soon!", "gold", 3000); });
  }

  // ========== RENDER SMART FLIPS ==========
  function renderSmartFlips() {
    var grid = document.getElementById("smartFlipsGrid");
    var empty = document.getElementById("smartFlipsEmpty");
    var upgradeOverlay = document.getElementById("smartUpgradeOverlay");
    var freeTierBar = document.getElementById("smartFreeTierBar");

    // Apply volume filter and recently traded filter
    var nowSec = Math.floor(Date.now() / 1000);
    var items = state.smartFlips.filter(function (i) {
      if (i.volume < state.smartVolumeMin) return false;
      if (state.smartRecentlyTraded && (!i.lastTradeTime || (nowSec - i.lastTradeTime) > 900)) return false;
      return true;
    });

    // Apply sort
    var sortKey = state.smartSort;
    if (sortKey === "score") {
      items.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
    } else if (sortKey === "afterTax") {
      items.sort(function (a, b) { return b.afterTax - a.afterTax; });
    } else if (sortKey === "roi") {
      items.sort(function (a, b) { return b.roi - a.roi; });
    } else if (sortKey === "volume") {
      items.sort(function (a, b) { return b.volume - a.volume; });
    } else if (sortKey === "buy") {
      items.sort(function (a, b) { return a.buy - b.buy; });
    } else if (sortKey === "recent") {
      items.sort(function (a, b) { return (b.lastTradeTime || 0) - (a.lastTradeTime || 0); });
    }

    // Free tier info bar (no card limiting — flip action is gated instead)
    if (!isProUser() && state.auth.loggedIn) {
      checkDailyReset();
      var limit = state.freeConfig.dailyLimit;
      var flipped = state.freeUsage.cardsFlippedToday;
      var remaining = Math.max(0, limit - flipped);

      freeTierBar.style.display = "flex";
      document.getElementById("smartFreeTierText").textContent = remaining + "/" + limit + " free flips remaining today";
      checkRefreshWindowReset();
      var refreshesLeft = state.freeConfig.refreshesPerWindow - state.freeUsage.refreshesUsed;
      var windowRem = getRefreshWindowRemaining();
      document.getElementById("smartFreeRefreshesText").textContent =
        refreshesLeft + " refresh(es) left (resets in " + formatRefreshCountdown(windowRem) + ")";
    } else {
      freeTierBar.style.display = "none";
    }

    if (upgradeOverlay) upgradeOverlay.style.display = "none";

    if (items.length === 0) {
      grid.innerHTML = "";
      grid.appendChild(empty);
      empty.style.display = "flex";
      if (state.dataLoaded) {
        empty.querySelector("h3").textContent = "No Smart Flips Available";
        empty.querySelector("p").textContent = "All profitable items are already active or skipped.";
      }
      return;
    }

    empty.style.display = "none";

    grid.innerHTML = items.map(function (item, idx) {
      var potProfit = item.afterTax * (item.limit || 1);
      return buildFeedCard(item, "smart", potProfit, idx + 1);
    }).join("");

    lucide.createIcons();
    bindFeedCardActions("smart");
  }

  // ========== RENDER RANDOM FLIPS ==========
  function renderRandomFlips() {
    var grid = document.getElementById("randomFlipsGrid");
    var empty = document.getElementById("randomFlipsEmpty");
    var upgradeOverlay = document.getElementById("randomUpgradeOverlay");
    var freeTierBar = document.getElementById("randomFreeTierBar");

    // Apply volume filter
    var items = state.randomFlips.filter(function (i) {
      return i.volume >= state.randomVolumeMin;
    });

    // Free tier info bar
    if (!isProUser() && state.auth.loggedIn) {
      checkDailyReset();
      var limit = state.freeConfig.dailyLimit;
      var flipped = state.freeUsage.cardsFlippedToday;
      var remaining = Math.max(0, limit - flipped);

      freeTierBar.style.display = "flex";
      document.getElementById("randomFreeTierText").textContent = remaining + "/" + limit + " free flips remaining today";
      checkRefreshWindowReset();
      var refreshesLeft = state.freeConfig.refreshesPerWindow - state.freeUsage.refreshesUsed;
      var windowRem = getRefreshWindowRemaining();
      document.getElementById("randomFreeRefreshesText").textContent =
        refreshesLeft + " refresh(es) left (resets in " + formatRefreshCountdown(windowRem) + ")";
    } else {
      freeTierBar.style.display = "none";
    }

    if (upgradeOverlay) upgradeOverlay.style.display = "none";

    if (items.length === 0) {
      grid.innerHTML = "";
      grid.appendChild(empty);
      empty.style.display = "flex";
      if (state.dataLoaded) {
        empty.querySelector("h3").textContent = "No Random Flips Available";
        empty.querySelector("p").textContent = "Try shuffling or adjusting the volume filter.";
      }
      return;
    }

    empty.style.display = "none";

    grid.innerHTML = items.map(function (item) {
      var potProfit = item.afterTax * (item.limit || 1);
      return buildFeedCard(item, "random", potProfit);
    }).join("");

    lucide.createIcons();
    bindFeedCardActions("random");
  }

  function buildFeedCard(item, type, potProfit, rank) {
    var badgeClass = type === "smart" ? "smart-badge" : "random-badge";
    var badgeText = type === "smart" ? "SMART PICK" : "RANDOM";
    var cardClass = type === "random" ? " random-card" : "";
    var marginClass = item.afterTax >= 0 ? "positive" : "negative";
    var roiDisplay = item.roi.toFixed(1);
    var rankHtml = rank ? '<span class="feed-card-rank">#' + rank + '</span>' : '';

    // 1-day trend
    var trend1d = calc1dTrend(item.id);
    var trendBadge = getTrendBadgeHtml(trend1d);

    return '<div class="feed-card' + cardClass + '" data-item-id="' + item.id + '" data-feed-type="' + type + '">' +
      rankHtml +
      '<span class="feed-card-badge ' + badgeClass + '">' + badgeText + '</span>' +
      '<div class="feed-card-header">' +
        '<img src="' + getItemIcon(item.icon) + '" alt="" class="feed-card-icon" onerror="this.style.display=\'none\'">' +
        '<span class="feed-card-name">' + escapeHtml(item.name) + '</span>' +
        (item.members ? '<span class="members-badge">M</span>' : '') +
      '</div>' +
      '<div class="feed-card-prices">' +
        '<div class="feed-card-stat"><span class="feed-card-stat-label">Best Buy-In</span><span class="feed-card-stat-value price-buy">' + formatGP(item.buy) + '</span></div>' +
        '<div class="feed-card-stat"><span class="feed-card-stat-label">Possible Sell</span><span class="feed-card-stat-value price-sell">' + formatGP(item.sell) + '</span></div>' +
        '<div class="feed-card-stat"><span class="feed-card-stat-label">After Tax</span><span class="feed-card-stat-value ' + marginClass + '">' + formatGP(item.afterTax) + '</span></div>' +
        '<div class="feed-card-stat"><span class="feed-card-stat-label">ROI%</span><span class="feed-card-stat-value ' + (item.roi > 0 ? "positive" : "") + '">' + roiDisplay + '%</span></div>' +
        '<div class="feed-card-stat"><span class="feed-card-stat-label">Volume</span><span class="feed-card-stat-value">' + formatGP(item.volume) + '</span></div>' +
        '<div class="feed-card-stat"><span class="feed-card-stat-label">Buy Limit</span><span class="feed-card-stat-value">' + (item.limit > 0 ? item.limit.toLocaleString() : "?") + '</span></div>' +
      '</div>' +
      '<div class="feed-card-trend-row">' +
        trendBadge +
        '<span class="feed-card-7d-badge trend-neutral">7D \u2014</span>' +
      '</div>' +
      '<div class="feed-card-profit-row">' +
        '<div><span class="feed-card-profit-label">Potential Profit at Limit</span></div>' +
        '<span class="feed-card-profit-value ' + (potProfit >= 0 ? "positive" : "negative") + '">' + formatGP(potProfit) + '</span>' +
      '</div>' +
      '<div class="feed-card-actions">' +
        '<button class="btn btn-flip feed-flip-btn" data-item-id="' + item.id + '"><i data-lucide="zap"></i> Flip It</button>' +
        '<button class="btn btn-skip btn-sm feed-skip-btn" data-item-id="' + item.id + '"><i data-lucide="x"></i> Skip</button>' +
      '</div>' +
    '</div>';
  }

  function bindFeedCardActions(type) {
    var container = type === "smart" ? document.getElementById("smartFlipsGrid") : document.getElementById("randomFlipsGrid");

    container.querySelectorAll(".feed-flip-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        // Free tier gating on flip action
        if (!isProUser() && state.auth.loggedIn) {
          checkDailyReset();
          if (state.freeUsage.cardsFlippedToday >= state.freeConfig.dailyLimit) {
            showToast("Daily flip limit reached. Upgrade to Pro for unlimited flips.", "red", 3000);
            return;
          }
          state.freeUsage.cardsFlippedToday++;
        }
        var itemId = parseInt(this.dataset.itemId);
        openNewCardModal(itemId);
        // Re-render to update the counter
        if (type === "smart") renderSmartFlips();
        else renderRandomFlips();
      });
    });

    container.querySelectorAll(".feed-skip-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var itemId = parseInt(this.dataset.itemId);
        state.skippedItems[itemId] = true;

        if (type === "smart") {
          state.smartFlips = state.smartFlips.filter(function (f) { return f.id !== itemId; });
          generateSmartFlipReplacement();
          renderSmartFlips();
        } else {
          state.randomFlips = state.randomFlips.filter(function (f) { return f.id !== itemId; });
          generateRandomFlipReplacement();
          renderRandomFlips();
        }
        showToast("Item skipped", "", 1500);
      });
    });

    // Clicking card opens item detail page
    container.querySelectorAll(".feed-card").forEach(function (card) {
      card.addEventListener("click", function (e) {
        if (e.target.closest(".feed-flip-btn") || e.target.closest(".feed-skip-btn")) return;
        openItemDetailPage(parseInt(this.dataset.itemId));
      });
    });
  }

  function generateSmartFlipReplacement() {
    var items = getProcessedItems();
    items = items.filter(function (i) { return i.afterTax > 0 && i.volume > 10 && i.buy > 100; });
    for (var i = 0; i < items.length; i++) {
      items[i].score = (items[i].afterTax * Math.sqrt(items[i].volume)) / Math.max(1, items[i].buy / 10000);
    }
    items.sort(function (a, b) { return b.score - a.score; });

    var activeItemIds = {};
    for (var j = 0; j < state.taskCards.length; j++) {
      if (state.taskCards[j].status === "active") activeItemIds[state.taskCards[j].itemId] = true;
    }
    var existingIds = {};
    for (var k = 0; k < state.smartFlips.length; k++) {
      existingIds[state.smartFlips[k].id] = true;
    }

    for (var m = 0; m < items.length; m++) {
      var it = items[m];
      if (!activeItemIds[it.id] && !state.skippedItems[it.id] && !existingIds[it.id]) {
        state.smartFlips.push(it);
        break;
      }
    }
  }

  function generateRandomFlipReplacement() {
    var items = getProcessedItems();
    items = items.filter(function (i) { return i.afterTax > 0 && i.buy > 100; });

    for (var i = items.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = items[i];
      items[i] = items[j];
      items[j] = temp;
    }

    var activeItemIds = {};
    for (var k = 0; k < state.taskCards.length; k++) {
      if (state.taskCards[k].status === "active") activeItemIds[state.taskCards[k].itemId] = true;
    }
    var existingIds = {};
    for (var m = 0; m < state.randomFlips.length; m++) {
      existingIds[state.randomFlips[m].id] = true;
    }

    for (var n = 0; n < items.length; n++) {
      var it = items[n];
      if (!activeItemIds[it.id] && !state.skippedItems[it.id] && !existingIds[it.id]) {
        state.randomFlips.push(it);
        break;
      }
    }
  }

  // ========== ITEM DETAIL PAGE ==========
  function openItemDetailPage(itemId) {
    state.itemDetailId = itemId;
    state.previousPage = state.currentPage;
    navigateTo("itemdetail");
  }

  function renderItemDetailPage() {
    var itemId = state.itemDetailId;
    if (!itemId) return;

    var item = state.itemMap[itemId];
    if (!item) return;

    var p = state.prices[itemId];

    // Icon and name
    var iconEl = document.getElementById("itemDetailPageIcon");
    var nameEl = document.getElementById("itemDetailPageName");
    var membersEl = document.getElementById("itemDetailMembersBadge");

    if (iconEl) {
      iconEl.src = getItemIcon(item.icon);
      iconEl.style.display = "";
    }
    if (nameEl) nameEl.textContent = item.name;
    if (membersEl) {
      membersEl.textContent = item.members ? "Members" : "F2P";
      membersEl.className = "itemdetail-members-badge " + (item.members ? "badge-members" : "badge-f2p");
    }

    // Stats
    if (p) {
      var buy = p.low || 0;
      var sell = p.high || 0;
      var margin = sell - buy;
      var tax = geTax(sell);
      var afterTax = margin - tax;
      var roi = buy > 0 ? ((afterTax / buy) * 100) : 0;
      var limit = item.limit || 0;
      var maxProfit = limit > 0 ? afterTax * limit : 0;

      setEl("itemDetailBuy", formatGP(buy));
      setEl("itemDetailSell", formatGP(sell));
      setEl("itemDetailAfterTax", formatGP(afterTax));
      setElClass("itemDetailAfterTax", "itemdetail-stat-value " + (afterTax >= 0 ? "positive" : "negative"));
      setEl("itemDetailROI", roi.toFixed(1) + "%");
      setElClass("itemDetailROI", "itemdetail-stat-value " + (roi > 0 ? "positive" : "negative"));
      setEl("itemDetailLimit", limit > 0 ? limit.toLocaleString() : "Unknown");
      setEl("itemDetailMaxProfit", maxProfit > 0 ? formatGP(maxProfit) : "\u2014");
      setEl("itemDetailHighAlch", item.highalch ? formatGP(item.highalch) : "\u2014");
      setEl("itemDetailMargin", formatGP(margin));
    }

    // 1-day trend
    var trend1d = calc1dTrend(itemId);
    var trend1dEl = document.getElementById("itemDetail1dTrend");
    if (trend1dEl) trend1dEl.innerHTML = getTrendHtml(trend1d);

    // Load 7-day chart + 7d trend
    loadItemDetailChart(itemId);

    // Bind back button
    var backBtn = document.getElementById("itemDetailBackBtn");
    if (backBtn) {
      backBtn.onclick = function () {
        navigateTo(state.previousPage || "cards");
      };
    }

    // Bind action buttons
    var flipBtn = document.getElementById("itemDetailFlipBtn");
    if (flipBtn) {
      flipBtn.onclick = function () {
        openNewCardModal(itemId);
      };
    }

    var watchBtn = document.getElementById("itemDetailWatchBtn");
    if (watchBtn) {
      watchBtn.onclick = function () {
        addToWatchlist(itemId);
        showToast(item.name + " added to watchlist", "gold", 2000);
      };
    }

    var calcBtn = document.getElementById("itemDetailCalcBtn");
    if (calcBtn) {
      calcBtn.onclick = function () {
        navigateTo("calculator");
        var calcSearch = document.getElementById("calcItemSearch");
        if (calcSearch) calcSearch.value = item.name;
        state.calcSelectedItem = item;
        var p2 = state.prices[itemId];
        if (p2) {
          document.getElementById("calcBuyPrice").value = p2.low || "";
          document.getElementById("calcSellPrice").value = p2.high || "";
        }
      };
    }

    // Bind refresh button
    var refreshBtn = document.getElementById("itemDetailRefreshBtn");
    if (refreshBtn) {
      refreshBtn.onclick = function () {
        if (state.itemDetailRefreshCooldown > 0) {
          showToast("Please wait " + state.itemDetailRefreshCooldown + "s before refreshing.", "red", 2000);
          return;
        }
        doItemDetailRefresh(itemId);
      };
    }

    lucide.createIcons();
  }

  function doItemDetailRefresh(itemId) {
    var refreshBtn = document.getElementById("itemDetailRefreshBtn");
    var countdown = document.getElementById("itemDetailRefreshCountdown");

    if (refreshBtn) refreshBtn.disabled = true;
    if (countdown) countdown.style.display = "inline";

    // Fetch fresh data
    Promise.all([loadPrices(), loadDayData()]).then(function () {
      renderItemDetailPage();
      showToast("Prices refreshed!", "gold", 2000);
    });

    // 60-second cooldown
    state.itemDetailRefreshCooldown = 60;
    if (state.itemDetailRefreshTimer) clearInterval(state.itemDetailRefreshTimer);
    state.itemDetailRefreshTimer = setInterval(function () {
      state.itemDetailRefreshCooldown--;
      if (countdown) countdown.textContent = "Next refresh in " + state.itemDetailRefreshCooldown + "s";
      if (state.itemDetailRefreshCooldown <= 0) {
        clearInterval(state.itemDetailRefreshTimer);
        state.itemDetailRefreshTimer = null;
        if (refreshBtn) refreshBtn.disabled = false;
        if (countdown) countdown.style.display = "none";
      }
    }, 1000);
  }

  function loadItemDetailChart(itemId) {
    var canvas = document.getElementById("itemDetailChart");
    if (!canvas) return;

    if (state.itemDetailChart) {
      state.itemDetailChart.destroy();
      state.itemDetailChart = null;
    }

    var trend7dEl = document.getElementById("itemDetail7dTrend");
    if (trend7dEl) trend7dEl.innerHTML = '<span class="text-muted">Loading...</span>';

    // Load 7-day timeseries with 6h timestep (~28 data points)
    loadTimeseries(itemId, "6h").then(function (data) {
      if (!data || data.length === 0) {
        if (trend7dEl) trend7dEl.innerHTML = '<span class="text-muted">\u2014</span>';
        return;
      }

      // Calculate 7d trend: compare most recent low with 7 days ago low
      if (data.length >= 2) {
        var oldLow = data[0].avgLowPrice;
        var newLow = data[data.length - 1].avgLowPrice;
        if (oldLow && newLow) {
          var pct7d = (newLow - oldLow) / oldLow;
          var trend7d;
          if (pct7d > 0.02) trend7d = "up";
          else if (pct7d < -0.02) trend7d = "down";
          else trend7d = "neutral";
          if (trend7dEl) trend7dEl.innerHTML = getTrendHtml(trend7d);
        } else {
          if (trend7dEl) trend7dEl.innerHTML = '<span class="text-muted">\u2014</span>';
        }
      }

      var labels = data.map(function (d) {
        var date = new Date(d.timestamp * 1000);
        return (date.getMonth() + 1) + "/" + date.getDate() + " " +
          String(date.getHours()).padStart(2, "0") + ":00";
      });
      var highs = data.map(function (d) { return d.avgHighPrice; });
      var lows = data.map(function (d) { return d.avgLowPrice; });

      state.itemDetailChart = new Chart(canvas, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Buy Price",
              data: highs,
              borderColor: "#00ff00",
              backgroundColor: "rgba(0,255,0,0.05)",
              borderWidth: 1.5,
              pointRadius: 0,
              fill: false,
              tension: 0.2
            },
            {
              label: "Sell Price",
              data: lows,
              borderColor: "#ff4444",
              backgroundColor: "rgba(255,68,68,0.05)",
              borderWidth: 1.5,
              pointRadius: 0,
              fill: false,
              tension: 0.2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#1b1b1e",
              titleColor: "#e8e8e8",
              bodyColor: "#b5b5b5",
              borderColor: "rgba(255,255,255,0.1)",
              borderWidth: 1,
              callbacks: {
                label: function (ctx) {
                  return ctx.dataset.label + ": " + formatGP(ctx.parsed.y) + " GP";
                }
              }
            }
          },
          scales: {
            x: {
              ticks: { color: "#666", font: { size: 10 }, maxTicksLimit: 8, maxRotation: 0 },
              grid: { color: "rgba(255,255,255,0.04)" }
            },
            y: {
              ticks: {
                color: "#888",
                font: { size: 10 },
                callback: function (v) { return formatGP(v); }
              },
              grid: { color: "rgba(255,255,255,0.04)" }
            }
          }
        }
      });
    });
  }

  function setEl(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setElClass(id, cls) {
    var el = document.getElementById(id);
    if (el) el.className = cls;
  }

  // ========== TASK CARDS (Active tab) ==========
  function renderCards() {
    var grid = document.getElementById("cardsGrid");
    var empty = document.getElementById("cardsEmpty");
    var cards = state.taskCards;

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
      var now = Date.now();
      var elapsed = now - card.startTime;
      var total = card.endTime - card.startTime;
      var remaining = Math.max(0, card.endTime - now);
      var progress = Math.min(100, (elapsed / total) * 100);

      if (card.status === "active" && remaining <= 0) {
        card.status = "expired";
      }

      var tax = geTax(card.sellPrice);
      var profit = (card.sellPrice - card.buyPrice - tax) * card.quantity;
      var roi = card.buyPrice > 0 ? ((card.sellPrice - card.buyPrice - tax) / card.buyPrice * 100).toFixed(1) : "0";
      var goldNeeded = card.buyPrice * card.quantity;
      var hasAlarm = state.alarms.some(function (a) { return a.cardId === card.id && a.active; });

      var statusClass = card.status === "completed" ? "completed" : card.status === "expired" ? "expired" : "";
      var statusBadge = card.status === "active" ? "active" : card.status === "completed" ? "completed-status" : "expired-status";

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
    var card = state.taskCards.find(function (c) { return c.id === cardId; });
    if (!card || card.status !== "active") return;

    card.status = "completed";

    var tax = geTax(card.sellPrice);
    var profit = (card.sellPrice - card.buyPrice - tax) * card.quantity;
    var totalTax = tax * card.quantity;
    var roi = card.buyPrice > 0 ? ((card.sellPrice - card.buyPrice - tax) / card.buyPrice * 100) : 0;

    // Gamification rewards
    state.gamification.totalExp += 40;
    var karmaEarned = Math.max(0, Math.floor(profit / 1000));
    state.gamification.karmaGold += karmaEarned;
    state.gamification.cardsCompleted += 1;

    var newLevel = calcLevel(state.gamification.totalExp);
    var oldLevel = state.gamification.level;
    state.gamification.level = newLevel;

    // Stats
    state.stats.totalProfit += profit;
    state.stats.totalTax += totalTax;
    state.stats.flipsCompleted += 1;
    if (card.buyPrice > 0) {
      state.stats.totalROI.push((card.sellPrice - card.buyPrice - tax) / card.buyPrice * 100);
    }
    state.stats.profitHistory.push({ time: Date.now(), profit: profit, item: card.itemName });

    // Push to flip history
    state.flipHistory.unshift({
      id: uid(),
      itemId: card.itemId,
      itemName: card.itemName,
      icon: card.icon,
      buyPrice: card.buyPrice,
      sellPrice: card.sellPrice,
      quantity: card.quantity,
      profit: profit,
      totalTax: totalTax,
      roi: roi,
      karmaEarned: karmaEarned,
      timestamp: Date.now()
    });

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
    updateActiveTabCount();
    renderCards();

    if (state.cardsTab === "history") renderHistory();
  }

  function deleteCard(cardId) {
    state.taskCards = state.taskCards.filter(function (c) { return c.id !== cardId; });
    updateActiveTabCount();
    renderCards();
  }

  function toggleAlarm(cardId) {
    var card = state.taskCards.find(function (c) { return c.id === cardId; });
    if (!card) return;

    var existing = state.alarms.find(function (a) { return a.cardId === cardId && a.active; });
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

  // ========== HISTORY ==========
  function renderHistory() {
    var list = document.getElementById("historyList");
    var empty = document.getElementById("historyEmpty");

    updateHistorySummary();

    if (state.flipHistory.length === 0) {
      list.innerHTML = "";
      list.appendChild(empty);
      empty.style.display = "flex";
      return;
    }

    empty.style.display = "none";
    list.innerHTML = state.flipHistory.map(function (entry) {
      var profitClass = entry.profit >= 0 ? "profit-entry" : "loss-entry";
      var profitValueClass = entry.profit >= 0 ? "positive" : "negative";
      var roiStr = entry.roi ? entry.roi.toFixed(1) : "0";

      return '<div class="history-entry ' + profitClass + '" data-history-id="' + entry.id + '">' +
        '<img src="' + getItemIcon(entry.icon) + '" alt="" class="history-entry-icon" onerror="this.style.display=\'none\'">' +
        '<div class="history-entry-info">' +
          '<div class="history-entry-name">' + escapeHtml(entry.itemName) + '</div>' +
          '<div class="history-entry-details">' +
            '<span>Buy: <strong>' + formatGP(entry.buyPrice) + '</strong></span>' +
            '<span>Sell: <strong>' + formatGP(entry.sellPrice) + '</strong></span>' +
            '<span>Qty: <strong>' + entry.quantity.toLocaleString() + '</strong></span>' +
            '<span>ROI: <strong>' + roiStr + '%</strong></span>' +
          '</div>' +
        '</div>' +
        '<div class="history-entry-right">' +
          '<div class="history-entry-profit ' + profitValueClass + '">' + formatGP(entry.profit) + '</div>' +
          (entry.karmaEarned > 0 ? '<div class="history-entry-karma">+' + entry.karmaEarned + ' KG</div>' : '') +
          '<div class="history-entry-time">' + formatTimestamp(entry.timestamp) + '</div>' +
        '</div>' +
        '<button class="btn-icon history-delete-btn" data-history-id="' + entry.id + '" title="Delete entry"><i data-lucide="trash-2"></i></button>' +
      '</div>';
    }).join("");

    lucide.createIcons();

    // Bind delete buttons
    list.querySelectorAll(".history-delete-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = this.dataset.historyId;
        state.flipHistory = state.flipHistory.filter(function (h) { return h.id !== id; });
        renderHistory();
        showToast("Entry deleted", "", 1500);
      });
    });

    list.scrollTop = 0;
  }

  function updateHistorySummary() {
    var totalProfit = 0;
    var totalTax = 0;
    var totalKarma = 0;
    var bestFlip = 0;
    var rois = [];

    for (var i = 0; i < state.flipHistory.length; i++) {
      var e = state.flipHistory[i];
      totalProfit += e.profit;
      totalTax += e.totalTax || 0;
      totalKarma += e.karmaEarned || 0;
      if (e.profit > bestFlip) bestFlip = e.profit;
      if (e.roi) rois.push(e.roi);
    }

    var avgROI = rois.length > 0 ? (rois.reduce(function (a, b) { return a + b; }, 0) / rois.length).toFixed(1) : "0";

    document.getElementById("histTotalProfit").textContent = formatGP(totalProfit) + " GP";
    document.getElementById("histTotalProfit").className = "history-kpi-value " + (totalProfit >= 0 ? "profit-text" : "loss-text");
    document.getElementById("histFlipsDone").textContent = state.flipHistory.length;
    document.getElementById("histAvgROI").textContent = avgROI + "%";
    document.getElementById("histTotalTax").textContent = formatGP(totalTax) + " GP";
    document.getElementById("histBestFlip").textContent = bestFlip > 0 ? formatGP(bestFlip) + " GP" : "\u2014";
    document.getElementById("histKarmaGold").textContent = totalKarma.toLocaleString();
  }

  // ========== NEW CARD MODAL ==========
  function initNewCardModal() {
    var modal = document.getElementById("newCardModal");
    var openBtns = [document.getElementById("newCardBtn"), document.getElementById("newCardBtnEmpty")];

    openBtns.forEach(function (btn) {
      if (btn) btn.addEventListener("click", function () {
        openNewCardModal();
      });
    });

    document.getElementById("closeNewCardModal").addEventListener("click", closeNewCardModal);
    document.getElementById("cancelNewCard").addEventListener("click", closeNewCardModal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeNewCardModal(); });

    document.getElementById("createCardBtn").addEventListener("click", createCard);

    var searchInput = document.getElementById("cardItemSearch");
    var dropdown = document.getElementById("cardAutocomplete");

    searchInput.addEventListener("input", function () {
      var q = this.value.toLowerCase().trim();
      if (q.length < 2) { dropdown.classList.remove("show"); return; }
      var matches = state.items.filter(function (item) {
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

    document.getElementById("cardTimer").addEventListener("change", function () {
      document.getElementById("customTimerGroup").style.display = this.value === "custom" ? "block" : "none";
    });

    ["cardBuyPrice", "cardSellPrice", "cardQuantity"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", updateCardPreview);
    });
  }

  function openNewCardModal(item) {
    var modal = document.getElementById("newCardModal");
    modal.style.display = "flex";
    state.selectedCardItem = null;

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
    var item = state.itemMap[itemId];
    if (!item) return;
    state.selectedCardItem = item;

    document.getElementById("cardItemSearch").value = item.name;
    document.getElementById("cardItemInfo").style.display = "flex";
    document.getElementById("cardItemIcon").src = getItemIcon(item.icon);
    document.getElementById("cardItemName").textContent = item.name;
    document.getElementById("cardItemLimit").textContent = "Buy limit: " + (item.limit || "Unknown");

    var p = state.prices[item.id];
    if (p) {
      document.getElementById("cardBuyPrice").value = p.low || "";
      document.getElementById("cardSellPrice").value = p.high || "";
    }
    updateCardPreview();
  }

  function updateCardPreview() {
    var buy = parseInt(document.getElementById("cardBuyPrice").value) || 0;
    var sell = parseInt(document.getElementById("cardSellPrice").value) || 0;
    var qty = parseInt(document.getElementById("cardQuantity").value) || 1;
    var tax = geTax(sell);
    var profit = (sell - buy - tax) * qty;
    var roi = buy > 0 ? ((sell - buy - tax) / buy * 100).toFixed(1) : "0";

    document.getElementById("cardGoldNeeded").textContent = formatGPFull(buy * qty);
    document.getElementById("cardEstProfit").textContent = formatGPFull(profit);
    document.getElementById("cardEstProfit").className = profit >= 0 ? "profit-text" : "loss-text";
    document.getElementById("cardEstROI").textContent = roi + "%";
  }

  function createCard() {
    if (!state.selectedCardItem) { showToast("Select an item first", "red"); return; }
    var buy = parseInt(document.getElementById("cardBuyPrice").value) || 0;
    var sell = parseInt(document.getElementById("cardSellPrice").value) || 0;
    var qty = parseInt(document.getElementById("cardQuantity").value) || 1;
    var timerVal = document.getElementById("cardTimer").value;
    var timerMin = parseInt(timerVal);
    if (timerVal === "custom") {
      timerMin = parseInt(document.getElementById("cardCustomTimer").value) || 30;
    }

    var now = Date.now();
    var card = {
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

    state.cardsTab = "active";
    if (state.currentPage === "cards") {
      renderFeedPage();
    } else {
      navigateTo("cards");
    }

    updateActiveTabCount();
    showToast("Task Card created for " + card.itemName, "gold");
  }

  // ========== SCANNER ==========
  function renderScanner() {
    var skeleton = document.getElementById("scannerSkeleton");
    var tbody = document.getElementById("scannerBody");
    var loadMore = document.getElementById("scannerLoadMore");

    if (state.items.length === 0) {
      skeleton.style.display = "flex";
      tbody.innerHTML = "";
      loadMore.style.display = "none";
      return;
    }
    skeleton.style.display = "none";

    var items = getProcessedItems();

    if (state.scannerFilter === "best-margins") {
      items = items.filter(function (i) { return i.afterTax > 0; });
    } else if (state.scannerFilter === "high-volume") {
      items = items.filter(function (i) { return i.volume > 100; });
    } else if (state.scannerFilter === "recently-traded") {
      var nowSec = Math.floor(Date.now() / 1000);
      items = items.filter(function (i) { return i.lastTradeTime && (nowSec - i.lastTradeTime) <= 900; });
    } else if (state.scannerFilter === "f2p") {
      items = items.filter(function (i) { return !i.members; });
    } else if (state.scannerFilter === "members") {
      items = items.filter(function (i) { return i.members; });
    }

    if (state.scannerSearchText) {
      var q = state.scannerSearchText.toLowerCase();
      items = items.filter(function (i) { return i.name.toLowerCase().includes(q); });
    }

    items.sort(function (a, b) {
      var va = a[state.scannerSort.key] || 0;
      var vb = b[state.scannerSort.key] || 0;
      if (typeof va === "string") return va.localeCompare(vb) * state.scannerSort.dir;
      return (va - vb) * state.scannerSort.dir;
    });

    var total = items.length;
    var countEl = document.getElementById("scannerItemCount");
    if (countEl) countEl.textContent = "(" + total + " items)";
    var pageItems = items.slice(0, (state.scannerPage + 1) * ITEMS_PER_PAGE);

    tbody.innerHTML = pageItems.map(function (item) {
      var marginClass = item.afterTax >= 0 ? "positive" : "negative";
      var roiClass = item.roi > 0 ? "positive" : "";
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

    tbody.querySelectorAll(".scanner-row").forEach(function (row) {
      row.addEventListener("click", function (e) {
        if (e.target.closest(".quick-flip-btn")) return;
        openItemDetailPage(parseInt(this.dataset.itemId));
      });
    });

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
      var pill = e.target.closest(".filter-pill");
      if (!pill) return;
      this.querySelectorAll(".filter-pill").forEach(function (p) { p.classList.remove("active"); });
      pill.classList.add("active");
      state.scannerFilter = pill.dataset.filter;
      state.scannerPage = 0;
      renderScanner();
    });

    document.querySelectorAll("#scannerTable th.sortable").forEach(function (th) {
      th.addEventListener("click", function () {
        var key = this.dataset.sort;
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

  // ========== CALCULATOR ==========
  function initCalculator() {
    var searchInput = document.getElementById("calcItemSearch");
    var dropdown = document.getElementById("calcAutocomplete");

    searchInput.addEventListener("input", function () {
      var q = this.value.toLowerCase().trim();
      if (q.length < 2) { dropdown.classList.remove("show"); return; }
      var matches = state.items.filter(function (item) {
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
          var item = state.itemMap[parseInt(this.dataset.itemId)];
          if (!item) return;
          state.calcSelectedItem = item;
          searchInput.value = item.name;
          dropdown.classList.remove("show");

          var p = state.prices[item.id];
          if (p) {
            document.getElementById("calcBuyPrice").value = p.low || "";
            document.getElementById("calcSellPrice").value = p.high || "";
          }
        });
      });
    });

    document.getElementById("calcBtn").addEventListener("click", calculateTax);

    document.querySelectorAll("#page-calculator .form-input").forEach(function (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") calculateTax();
      });
    });
  }

  function calculateTax() {
    var buy = parseInt(document.getElementById("calcBuyPrice").value) || 0;
    var sell = parseInt(document.getElementById("calcSellPrice").value) || 0;
    var qty = parseInt(document.getElementById("calcQuantity").value) || 1;

    var tax = geTax(sell);
    var gross = sell - buy;
    var net = gross - tax;
    var totalProfit = net * qty;
    var totalTax = tax * qty;
    var roi = buy > 0 ? ((net / buy) * 100).toFixed(2) : "0";
    var breakeven = buy > 0 ? Math.ceil(buy / 0.99) : 0;
    var limit = state.calcSelectedItem ? (state.calcSelectedItem.limit || 0) : 0;
    var maxProfit = net * limit;

    document.getElementById("resTaxUnit").textContent = formatGPFull(tax);
    document.getElementById("resGrossMargin").textContent = formatGPFull(gross);
    document.getElementById("resNetUnit").textContent = formatGPFull(net);
    document.getElementById("resTotalProfit").textContent = formatGPFull(totalProfit);
    document.getElementById("resTotalTax").textContent = formatGPFull(totalTax);
    document.getElementById("resROI").textContent = roi + "%";
    document.getElementById("resBreakeven").textContent = formatGPFull(breakeven);
    document.getElementById("resBuyLimit").textContent = limit > 0 ? limit.toLocaleString() : "Unknown";
    document.getElementById("resMaxProfit").textContent = limit > 0 ? formatGPFull(maxProfit) : "\u2014";
  }

  // ========== ALARMS ==========
  function renderAlarms() {
    var list = document.getElementById("alarmsList");
    var empty = document.getElementById("alarmsEmpty");
    var activeAlarms = state.alarms.filter(function (a) { return a.active || a.fired; });

    if (activeAlarms.length === 0) {
      list.innerHTML = "";
      list.appendChild(empty);
      empty.style.display = "flex";
      return;
    }

    empty.style.display = "none";
    list.innerHTML = activeAlarms.map(function (alarm) {
      var now = Date.now();
      var remaining = Math.max(0, alarm.endTime - now);
      var total = alarm.endTime - alarm.startTime;
      var progress = Math.min(100, ((total - remaining) / total) * 100);
      var isReady = remaining <= 0;
      var firedClass = isReady ? "fired" : "";
      var timeText = isReady ? "Ready!" : formatTime(remaining);
      var timeClass = isReady ? "ready" : "";

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
        var id = this.dataset.alarmId;
        state.alarms = state.alarms.filter(function (a) { return a.id !== id; });
        updateAlarmBadge();
        renderAlarms();
      });
    });
  }

  function updateAlarmBadge() {
    var count = state.alarms.filter(function (a) { return a.active; }).length;
    var badge = document.getElementById("alarmBadge");
    var mobileBadge = document.getElementById("mobileAlarmBadge");
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
    var now = Date.now();
    var changed = false;
    for (var i = 0; i < state.alarms.length; i++) {
      var alarm = state.alarms[i];
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
      if (state.currentPage === "cards" && state.cardsTab === "active") renderCards();
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
    var item = state.itemMap[itemId];
    if (!item) return;
    state.watchlist.push({ id: itemId, name: item.name, icon: item.icon });
    showToast(item.name + " added to watchlist", "gold", 2000);
    if (state.currentPage === "watchlist") renderWatchlist();
  }

  function renderWatchlist() {
    var grid = document.getElementById("watchlistGrid");
    var empty = document.getElementById("watchlistEmpty");

    if (state.watchlist.length === 0) {
      grid.innerHTML = "";
      grid.appendChild(empty);
      empty.style.display = "flex";
      return;
    }

    empty.style.display = "none";
    grid.innerHTML = state.watchlist.map(function (w) {
      var p = state.prices[w.id];
      var buy = p ? (p.low || 0) : 0;
      var sell = p ? (p.high || 0) : 0;
      var margin = sell - buy;
      var tax = geTax(sell);
      var afterTax = margin - tax;

      return '<div class="watchlist-card" data-item-id="' + w.id + '">' +
        '<div class="watchlist-card-header">' +
          '<img src="' + getItemIcon(w.icon) + '" alt="" onerror="this.style.display=\'none\'">' +
          '<span class="watchlist-card-name">' + escapeHtml(w.name) + '</span>' +
          '<button class="btn-icon remove-watchlist" data-item-id="' + w.id + '" title="Remove"><i data-lucide="x"></i></button>' +
        '</div>' +
        '<div class="watchlist-card-prices">' +
          '<span>Best Buy-In</span><span class="price-buy">' + formatGP(buy) + '</span>' +
          '<span>Possible Sell</span><span class="price-sell">' + formatGP(sell) + '</span>' +
          '<span>Margin</span><span>' + formatGP(margin) + '</span>' +
          '<span>After Tax</span><span class="' + (afterTax >= 0 ? "profit-text" : "loss-text") + '">' + formatGP(afterTax) + '</span>' +
        '</div>' +
      '</div>';
    }).join("");

    lucide.createIcons();

    grid.querySelectorAll(".watchlist-card").forEach(function (card) {
      card.addEventListener("click", function (e) {
        if (e.target.closest(".remove-watchlist")) return;
        openItemDetailPage(parseInt(this.dataset.itemId));
      });
    });

    grid.querySelectorAll(".remove-watchlist").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = parseInt(this.dataset.itemId);
        state.watchlist = state.watchlist.filter(function (w) { return w.id !== id; });
        renderWatchlist();
      });
    });
  }

  function initWatchlist() {
    var modal = document.getElementById("watchlistModal");
    document.getElementById("addWatchlistBtn").addEventListener("click", function () { modal.style.display = "flex"; });
    document.getElementById("closeWatchlistModal").addEventListener("click", function () { modal.style.display = "none"; });
    document.getElementById("cancelWatchlist").addEventListener("click", function () { modal.style.display = "none"; });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.style.display = "none"; });

    var searchInput = document.getElementById("watchlistItemSearch");
    var dropdown = document.getElementById("watchlistAutocomplete");

    searchInput.addEventListener("input", function () {
      var q = this.value.toLowerCase().trim();
      if (q.length < 2) { dropdown.classList.remove("show"); return; }
      var matches = state.items.filter(function (item) {
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
          var itemId = parseInt(this.dataset.itemId);
          state.selectedWatchlistItem = itemId;
          var item = state.itemMap[itemId];
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
    var g = state.gamification;
    var s = state.stats;
    var sessionMs = Date.now() - s.sessionStart;
    var sessionMin = Math.floor(sessionMs / 60000);
    var profitPerHour = sessionMs > 0 ? Math.floor(s.totalProfit / (sessionMs / 3600000)) : 0;
    var avgROI = s.totalROI.length > 0 ? (s.totalROI.reduce(function (a, b) { return a + b; }, 0) / s.totalROI.length).toFixed(1) : "0";

    document.getElementById("statTotalProfit").textContent = formatGP(s.totalProfit) + " GP";
    document.getElementById("statAvgROI").textContent = avgROI + "%";
    document.getElementById("statFlipsDone").textContent = s.flipsCompleted;
    document.getElementById("statTaxPaid").textContent = formatGP(s.totalTax) + " GP";
    document.getElementById("statSessionTime").textContent = sessionMin + "m";
    document.getElementById("statProfitHour").textContent = formatGP(profitPerHour) + " GP";

    document.getElementById("statKarmaGold").textContent = g.karmaGold.toLocaleString();
    document.getElementById("statLevel").textContent = g.level + " \u2014 " + getLevelName(g.level);
    document.getElementById("statTotalExp").textContent = g.totalExp.toLocaleString();
    document.getElementById("statCardsCompleted").textContent = g.cardsCompleted;
    document.getElementById("statExpNext").textContent = expToNextLevel(g.totalExp);
    document.getElementById("statExpFill").style.width = expProgress(g.totalExp) + "%";

    renderProfitChart();
  }

  function renderProfitChart() {
    var canvas = document.getElementById("profitChart");
    if (state.profitChart) { state.profitChart.destroy(); }

    var history = state.stats.profitHistory;
    if (history.length === 0) {
      state.profitChart = new Chart(canvas, {
        type: "bar",
        data: { labels: ["No data"], datasets: [{ label: "Profit", data: [0], backgroundColor: "rgba(255,152,31,0.3)", borderColor: "#ff981f", borderWidth: 1 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#666" }, grid: { color: "rgba(255,255,255,0.04)" } }, y: { ticks: { color: "#888" }, grid: { color: "rgba(255,255,255,0.04)" } } } }
      });
      return;
    }

    var labels = history.map(function (h) { return h.item; });
    var data = history.map(function (h) { return h.profit; });
    var colors = data.map(function (v) { return v >= 0 ? "rgba(0,255,0,0.5)" : "rgba(255,68,68,0.5)"; });
    var borders = data.map(function (v) { return v >= 0 ? "#00ff00" : "#ff4444"; });

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
  var GUIDES = {
    "101": {
      title: "Flipping 101",
      content: "<h2>What is Flipping?</h2><p>Flipping is the act of buying items on the Grand Exchange at a low price and selling them at a higher price for profit. It's one of the most reliable money-making methods in OSRS.</p><h2>How the GE Works</h2><p>The Grand Exchange matches buyers and sellers. When you place a buy offer at a certain price, you'll get the item if someone sells at or below your price. The difference between what people buy and sell at is the <strong>margin</strong>.</p><h2>The GE Tax</h2><p>Jagex introduced a 1% tax on all GE sales, capped at 5M GP. This means: <code>Tax = min(sellPrice \u00d7 0.01, 5,000,000)</code>. You need to account for this in your profit calculations.</p><h2>Key Terms</h2><ul><li><strong>Margin</strong> \u2014 The difference between buy and sell price</li><li><strong>Spread</strong> \u2014 Same as margin</li><li><strong>ROI</strong> \u2014 Return on Investment (profit / buy price \u00d7 100)</li><li><strong>Buy Limit</strong> \u2014 Max items you can buy per 4 hours</li><li><strong>Margin Check</strong> \u2014 Buying and selling 1 item to find current prices</li></ul>"
    },
    "first": {
      title: "Your First Flip",
      content: "<h2>Step 1: Pick an Item</h2><p>Use the Scanner to find items with good margins. Start with commonly traded items like <strong>runes</strong>, <strong>food</strong>, or <strong>potions</strong>. These have high volume and stable prices.</p><h2>Step 2: Margin Check</h2><p>Buy 1 of the item at a very high price (instant buy) and sell 1 at a very low price (instant sell). The prices you get show the current margin.</p><h2>Step 3: Place Your Offers</h2><p>Now place a buy offer at the instant sell price and a sell offer at the instant buy price. Wait for them to complete.</p><h2>Step 4: Calculate Profit</h2><p>Your profit per item is: <code>Sell Price - Buy Price - Tax</code>. Use the Calculator page to compute this precisely.</p><h2>Tips for Beginners</h2><ul><li>Start with low-value items to minimize risk</li><li>Always account for the 1% GE tax</li><li>Don't invest all your gold in one item</li><li>Check buy limits \u2014 you can only buy so many per 4 hours</li></ul>"
    },
    "limits": {
      title: "Buy Limits",
      content: "<h2>What are Buy Limits?</h2><p>Every item on the GE has a buy limit \u2014 the maximum number you can purchase every 4 hours. This prevents market manipulation and ensures everyone has fair access.</p><h2>Common Buy Limits</h2><ul><li><strong>Runes</strong> \u2014 13,000-25,000</li><li><strong>Food</strong> \u2014 6,000-13,000</li><li><strong>Potions</strong> \u2014 2,000-10,000</li><li><strong>Weapons/Armor</strong> \u2014 8-125</li><li><strong>Rare items</strong> \u2014 2-8</li></ul><h2>4-Hour Timer</h2><p>Your buy limit resets exactly 4 hours after your first purchase. Use the Alarm feature on Task Cards to get notified when you can buy again.</p><h2>Strategy</h2><p>To maximize profit, calculate the max profit at buy limit: <code>Net Profit Per Item \u00d7 Buy Limit</code>. Items with higher limits can generate more total profit even with smaller margins.</p>"
    },
    "advanced": {
      title: "Advanced Tips",
      content: "<h2>Volume Analysis</h2><p>High-volume items flip faster but usually have smaller margins. Low-volume items can have huge margins but may take hours to sell. Balance is key.</p><h2>Time of Day</h2><p>Prices fluctuate throughout the day. Peak hours (evening EU/US) have the most volume. Off-peak hours often have wider margins but fewer trades.</p><h2>Update Days</h2><p>OSRS updates happen on Wednesdays. Items mentioned in updates can see huge price swings. Plan your flips accordingly.</p><h2>Multiple Flips</h2><p>Run 8 GE slots simultaneously. Diversify across item types to reduce risk. Use Task Cards to track all active flips.</p><h2>Margin Monitoring</h2><p>Margins change constantly. Re-check margins every 15-30 minutes for active items. The Scanner auto-refreshes every 60 seconds.</p><h2>Risk Management</h2><ul><li>Never invest more than 20% of your total gold in one item</li><li>Set stop-losses mentally \u2014 if an item drops 5%, cut your losses</li><li>Avoid items with recent price spikes \u2014 they often crash back</li><li>Keep a cash reserve for opportunities</li></ul>"
    }
  };

  function renderGuides(tab) {
    var guide = GUIDES[tab || "101"];
    if (!guide) return;
    document.getElementById("guideContent").innerHTML = guide.content;

    document.querySelectorAll("#page-guides .filter-pill").forEach(function (p) {
      p.classList.toggle("active", p.dataset.guide === tab);
    });
  }

  function initGuides() {
    document.querySelector("#page-guides .guides-tabs").addEventListener("click", function (e) {
      var pill = e.target.closest(".filter-pill");
      if (!pill) return;
      renderGuides(pill.dataset.guide);
    });
  }

  // ========== BLOG ==========
  function renderBlog() {
    var list = document.getElementById("blogList");
    var empty = document.getElementById("blogEmpty");
    var postView = document.getElementById("blogPostView");

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
      var excerpt = post.content.replace(/[#*`\[\]()]/g, "").substring(0, 150) + "...";
      return '<div class="blog-card" data-post-id="' + post.id + '">' +
        '<div class="blog-card-title">' + escapeHtml(post.title) + '</div>' +
        '<div class="blog-card-date">' + post.date + '</div>' +
        '<div class="blog-card-excerpt">' + escapeHtml(excerpt) + '</div>' +
      '</div>';
    }).join("");

    list.querySelectorAll(".blog-card").forEach(function (card) {
      card.addEventListener("click", function () {
        var postId = this.dataset.postId;
        showBlogPost(postId);
      });
    });
  }

  function showBlogPost(postId) {
    var post = state.blogPosts.find(function (p) { return p.id === postId; });
    if (!post) return;

    document.getElementById("blogList").style.display = "none";
    var postView = document.getElementById("blogPostView");
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
      // Sync free tier config inputs
      var dl = document.getElementById("adminDailyLimit");
      var rp = document.getElementById("adminRefreshesPerWindow");
      var rw = document.getElementById("adminRefreshWindowHours");
      if (dl) dl.value = state.freeConfig.dailyLimit;
      if (rp) rp.value = state.freeConfig.refreshesPerWindow;
      if (rw) rw.value = state.freeConfig.refreshWindowHours;
    }
  }

  function renderAdminPosts() {
    var list = document.getElementById("adminPostsList");
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
        var post = state.blogPosts.find(function (p) { return p.id === btn.dataset.postId; });
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
    var content = document.getElementById("adminPostContent").value;
    document.getElementById("adminPreview").innerHTML = renderMarkdown(content);
  }

  function initAdmin() {
    document.getElementById("adminLoginBtn").addEventListener("click", function () {
      var pw = document.getElementById("adminPassword").value;
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
      var title = document.getElementById("adminPostTitle").value.trim();
      var content = document.getElementById("adminPostContent").value.trim();
      if (!title || !content) { showToast("Title and content required", "red"); return; }

      if (state.editingPostId) {
        var post = state.blogPosts.find(function (p) { return p.id === state.editingPostId; });
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

    // Free tier config save
    var saveFreeTier = document.getElementById("adminSaveFreeTierBtn");
    if (saveFreeTier) {
      saveFreeTier.addEventListener("click", function () {
        var dl = parseInt(document.getElementById("adminDailyLimit").value) || 20;
        var rp = parseInt(document.getElementById("adminRefreshesPerWindow").value) || 2;
        var rw = parseInt(document.getElementById("adminRefreshWindowHours").value) || 4;
        state.freeConfig.dailyLimit = dl;
        state.freeConfig.refreshesPerWindow = rp;
        state.freeConfig.refreshWindowHours = rw;
        showToast("Free tier config saved!", "gold", 2000);
      });
    }
  }

  // ========== SETTINGS ==========
  function renderSettings() {
    var g = state.gamification;
    document.getElementById("settingsKarma").textContent = g.karmaGold.toLocaleString();
    document.getElementById("settingsExp").textContent = g.totalExp.toLocaleString();
    document.getElementById("settingsLevel").textContent = g.level + " \u2014 " + getLevelName(g.level);
    document.getElementById("settingsName").value = state.auth.username;
  }

  function initSettings() {
    document.getElementById("settingsName").addEventListener("change", function () {
      state.auth.username = this.value || "Guest";
    });

    document.getElementById("generateApiKey").addEventListener("click", function () {
      var key = "flt2_" + uid() + uid();
      document.getElementById("settingsApiKey").value = key;
      showToast("API Key generated", "gold");
    });

    document.getElementById("exportJsonBtn").addEventListener("click", function () {
      var data = JSON.stringify({
        taskCards: state.taskCards,
        gamification: state.gamification,
        stats: state.stats,
        watchlist: state.watchlist,
        blogPosts: state.blogPosts,
        flipHistory: state.flipHistory
      }, null, 2);
      downloadFile("flipit2-export.json", data, "application/json");
    });

    document.getElementById("exportCsvBtn").addEventListener("click", function () {
      var csv = "Item,Buy,Sell,Quantity,Status,Profit\n";
      for (var i = 0; i < state.taskCards.length; i++) {
        var card = state.taskCards[i];
        var tax = geTax(card.sellPrice);
        var profit = (card.sellPrice - card.buyPrice - tax) * card.quantity;
        csv += [card.itemName, card.buyPrice, card.sellPrice, card.quantity, card.status, profit].join(",") + "\n";
      }
      downloadFile("flipit2-export.csv", csv, "text/csv");
    });

    document.getElementById("importBtn").addEventListener("click", function () {
      document.getElementById("importFileInput").click();
    });

    document.getElementById("importFileInput").addEventListener("change", function () {
      var file = this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var data = JSON.parse(e.target.result);
          if (data.taskCards) state.taskCards = data.taskCards;
          if (data.gamification) Object.assign(state.gamification, data.gamification);
          if (data.stats) Object.assign(state.stats, data.stats);
          if (data.watchlist) state.watchlist = data.watchlist;
          if (data.blogPosts) state.blogPosts = data.blogPosts;
          if (data.flipHistory) state.flipHistory = data.flipHistory;
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
      state.flipHistory = [];
      state.gamification = { karmaGold: 0, totalExp: 0, level: 1, cardsCompleted: 0 };
      state.stats = { totalProfit: 0, totalTax: 0, totalROI: [], flipsCompleted: 0, profitHistory: [], sessionStart: Date.now() };
      updateGamificationUI();
      updateActiveTabCount();
      showToast("All data cleared", "", 2000);
    });
  }

  function downloadFile(name, content, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ========== AUTH ==========
  function openAuthModal(tab) {
    var modal = document.getElementById("authModal");
    modal.style.display = "flex";
    if (tab === "register") {
      document.getElementById("authRegisterTab").click();
    } else {
      document.getElementById("authLoginTab").click();
    }
  }

  function initAuth() {
    var modal = document.getElementById("authModal");
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
      var u = document.getElementById("loginUsername").value.trim();
      var p = document.getElementById("loginPassword").value;
      var user = state.auth.users.find(function (usr) { return usr.username === u && usr.password === p; });
      if (user) {
        state.auth.loggedIn = true;
        state.auth.username = u;
        state.auth.isPro = user.isPro || false;
        modal.style.display = "none";
        updateTierBadge();
        showToast("Welcome back, " + u + "!", "gold");
        // Re-render feed if on cards page (removes gate)
        if (state.currentPage === "cards") renderFeedPage();
      } else {
        showToast("Invalid credentials", "red");
      }
    });

    document.getElementById("registerBtn").addEventListener("click", function () {
      var u = document.getElementById("registerUsername").value.trim();
      var p = document.getElementById("registerPassword").value;
      if (!u || !p) { showToast("Fill in all fields", "red"); return; }
      if (state.auth.users.find(function (usr) { return usr.username === u; })) {
        showToast("Username taken", "red"); return;
      }
      state.auth.users.push({ username: u, password: p, isPro: false });
      state.auth.loggedIn = true;
      state.auth.username = u;
      state.auth.isPro = false;
      modal.style.display = "none";
      updateTierBadge();
      showToast("Account created! Welcome, " + u + "!", "gold");
      if (state.currentPage === "cards") renderFeedPage();
    });

    document.getElementById("guestBtn").addEventListener("click", function () {
      state.auth.loggedIn = true;
      state.auth.username = "Guest";
      state.auth.isPro = false;
      modal.style.display = "none";
      updateTierBadge();
      showToast("Continuing as Guest", "");
      if (state.currentPage === "cards") renderFeedPage();
    });
  }

  // ========== GAMIFICATION UI ==========
  function updateGamificationUI() {
    var g = state.gamification;
    g.level = calcLevel(g.totalExp);

    document.getElementById("headerKarmaGold").textContent = g.karmaGold.toLocaleString();
    document.getElementById("headerLevel").textContent = g.level;
    document.getElementById("headerExpFill").style.width = expProgress(g.totalExp) + "%";
  }

  // ========== CARD FILTER ==========
  function initCardFilters() {
    document.getElementById("cardsFilterBar").addEventListener("click", function (e) {
      var pill = e.target.closest(".filter-pill");
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
      if (state.currentPage === "cards" && state.cardsTab === "active") {
        var now = Date.now();
        document.querySelectorAll(".task-card[data-card-id]").forEach(function (el) {
          var cardId = el.dataset.cardId;
          var card = state.taskCards.find(function (c) { return c.id === cardId; });
          if (!card || card.status !== "active") return;
          var remaining = Math.max(0, card.endTime - now);
          var total = card.endTime - card.startTime;
          var progress = Math.min(100, ((now - card.startTime) / total) * 100);
          var timerVal = el.querySelector(".task-card-timer-value");
          var progressFill = el.querySelector(".task-card-progress-fill");
          if (timerVal) timerVal.textContent = formatTimeShort(remaining);
          if (progressFill) {
            progressFill.style.width = progress + "%";
            if (progress > 80) progressFill.classList.add("low");
          }
          if (remaining <= 0 && card.status === "active") {
            card.status = "expired";
            updateActiveTabCount();
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
  function init() {
    initRouting();
    initSidebar();
    initNewCardModal();
    initScanner();
    initCalculator();
    initAlarms();
    initWatchlist();
    initGuides();
    initBlog();
    initAdmin();
    initSettings();
    initAuth();
    initCardFilters();
    initFeedTabs();
    updateGamificationUI();
    updateTierBadge();

    // Initialize Lucide icons
    lucide.createIcons();

    // Load data
    initData().then(function () {
      startTimers();
      showToast("OSRS Flipit2 loaded \u2014 Prices updated!", "gold", 3000);
    });
  }

  // Start
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
