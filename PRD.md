# OSRS Flip Tracker — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-03-01  
**Author:** designedbygotti@gmail.com  
**Status:** Draft

---

## Table of Contents

1. [Overview & Vision](#1-overview--vision)
2. [Problem Statement](#2-problem-statement)
3. [Target Users](#3-target-users)
4. [Goals & Non-Goals](#4-goals--non-goals)
5. [User Stories](#5-user-stories)
6. [Feature Specification](#6-feature-specification)
7. [Technical Architecture](#7-technical-architecture)
8. [Data Model](#8-data-model)
9. [API Design](#9-api-design)
10. [Success Metrics](#10-success-metrics)
11. [Open Questions](#11-open-questions)
12. [Timeline & Phasing](#12-timeline--phasing)

---

## 1. Overview & Vision

### Project Name
**OSRS Flip Tracker**

### Tagline
> *"From market scan to completed flip — all in one place."*

### Elevator Pitch
OSRS Flip Tracker is a web-based Grand Exchange flipping tool that combines real-time market data with structured flip workflow management. Unlike existing tools that only show you *what* to flip, OSRS Flip Tracker guides you *through* every flip — from identifying an opportunity to booking the final profit — using **Flip Task Cards** as its central feature.

**Flip Task Cards are the heart of the product.** Every other feature (scanner, calculator, watchlist, RuneLite plugin) exists to feed into and enhance the Task Card workflow. The entire UX is designed so that any interaction naturally leads to creating, updating, or completing a Task Card.

### Unified Auth System
A single account works across **both** the web app and the RuneLite plugin. Users register once (email, Google OAuth, or Discord OAuth) and can:
- Use the web app standalone (manual Task Cards without RuneLite)
- Connect the RuneLite plugin for automatic trade syncing
- Or use both simultaneously

The auth flow:
1. User registers at `osrs-flip-tracker.gg/register`
2. Gets full access to web app features immediately
3. Optionally generates a Plugin API Key in account settings
4. Enters the key in the RuneLite plugin config panel
5. Plugin authenticates against the same user account
6. All data (Task Cards, sessions, stats) is unified under one identity

This means: **the web app is fully functional without RuneLite** — the plugin is an enhancement, not a requirement.

### What Makes This Different

| Feature | 07.gg Exchange Pro | prices.osrs.cloud | **OSRS Flip Tracker** |
|---|---|---|---|
| Real-time price scanner | ✅ | ✅ | ✅ |
| GE tax calculator | Partial | ✅ | ✅ Full (integrated into Task Cards) |
| Favorites / Watchlist | ✅ | ✅ | ✅ Multi-list → feeds Task Cards |
| **Flip Task Cards (kanban workflow)** | ❌ | ❌ | ✅ **CORE FEATURE** |
| Auto-status via RuneLite plugin | ✅ (own ecosystem) | ❌ | ✅ (syncs to Task Cards) |
| Session stats panel | Partial | ❌ | ✅ Full (from completed Task Cards) |
| OSRS Guides & tutorials | ❌ | ❌ | ✅ |
| Price history charts | ✅ | ✅ | ✅ |
| Unified Auth (Web + Plugin) | ❌ (plugin-only) | ❌ | ✅ **Single Account** |
| Standalone without plugin | N/A (plugin-focused) | Web-only | ✅ **Both modes** |
| Community / sharing | Partial | Partial | 🔜 Phase 3 |

The core differentiator is **Flip Task Cards**: a kanban-style board where each flip becomes a managed task, moving from "Planning" → "Buying" → "Bought" → "Selling" → "Sold" → "Completed". This turns ad-hoc flipping into a repeatable, trackable workflow.

**Feature hierarchy — everything feeds the Task Card:**
```
                    ┌─────────────────┐
                    │  FLIP TASK CARD  │  ← THE PRODUCT
                    │  (Kanban Board)  │
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │  Scanner   │  │ Calculator │  │  Watchlist  │
     │ "Find it"  │  │ "Price it" │  │ "Track it"  │
     └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
           │               │               │
           └───────── Create Task Card ────┘
                           │
              ┌────────────┼────────────┐
              ▼                         ▼
     ┌────────────────┐       ┌────────────────┐
     │  Manual Mode   │       │  RuneLite Sync │
     │  (Web Only)    │       │  (Auto-update)  │
     │  Log prices    │       │  GE events →    │
     │  manually      │       │  advance cards  │
     └────────────────┘       └────────────────┘
```

---

## 2. Problem Statement

### The Gap in Existing Tools

Current OSRS flipping tools (07.gg, prices.osrs.cloud) are excellent *market data dashboards* but treat flipping as a passive, read-only activity. They answer "what item can I flip right now?" but provide no structured way to manage the execution of a flip.

**Concrete problems today:**

1. **No flip lifecycle tracking.** When a player identifies a good flip and goes in-game to execute it, there is no tool to record their buy target, track when they placed the GE offer, or note actual vs expected margins. Players use paper, spreadsheets, or memory.

2. **Manual tax math.** Every experienced flipper needs to mentally subtract 1% GE tax (capped at 5M GP) from sell proceeds. None of the free tools present this as a first-class, always-visible calculation.

3. **No workflow state.** "I bought 500 nature runes at 145gp each and now I'm waiting to sell" has no digital home. When a player has 3-5 active flips at once, tracking their state becomes error-prone.

4. **No onboarding path.** New players have nowhere to start. Market scanners are overwhelming without context explaining margins, GE buy limits, and timing.

5. **RuneLite data is siloed.** The Flipping Utilities RuneLite plugin tracks trades locally but its data does not sync to a web dashboard, making cross-device access and historical analysis impossible.

### Why This Matters
A flipper doing 5–10 flips per session with 100k–500k GP margins each can earn 2–5M GP/hr. Even a 10% improvement in execution accuracy (knowing exact break-even prices, not underselling) is worth real in-game money. Structured task management directly translates to higher profit.

---

## 3. Target Users

### Persona A — "The Rookie Flipper" (New Player)
- **Profile:** Player level 50–1000 total, owns 100k–5M GP, just learned GE flipping exists
- **Pain:** Doesn't know which items to flip, confused by margins and tax, afraid of losing money
- **Need:** Guided scanner with beginner-friendly presets, a calculator that shows net profit clearly, and tutorials
- **Success looks like:** Completes their first profitable flip with the app's help, understands what they earned and why

### Persona B — "The Active Flipper" (Experienced)
- **Profile:** Player with 10M–500M GP, flips 30–100 items/week, uses RuneLite with GE price overlay
- **Pain:** Tracks multiple simultaneous flips mentally or in a spreadsheet, forgets buy prices after going AFK, wants to optimize which items to rotate through
- **Need:** Flip Task Cards to manage 5–10 concurrent flips, real-time scanner for margin opportunities, session stats (profit/hr, ROI) that match RuneLite data
- **Success looks like:** Replaces their spreadsheet with OSRS Flip Tracker, reduces the cognitive overhead of managing multiple flips

### Persona C — "The Ironman Crafter"
- **Profile:** Ironman account tracking production costs, e.g., fletching bows, crafting runes
- **Pain:** Needs to know buy costs for materials vs sell value of finished items, net GP/hr for their skilling method
- **Need:** Tax calculator integrated with market prices, recipe profit calculation (Phase 3), saved watchlists for their material sets
- **Success looks like:** Can verify in under 30 seconds whether their current skilling method is more or less profitable than buying the finished product

---

## 4. Goals & Non-Goals

### Goals

#### User Goals
| ID | Goal | How Measured |
|---|---|---|
| UG-1 | A new player can find a profitable flip to execute in < 2 minutes | Task completion time in analytics |
| UG-2 | An active flipper can track all their in-progress flips without a spreadsheet | Flip Task Cards created per user/session |
| UG-3 | Any player can calculate exact net profit after GE tax in < 30 seconds | Calculator engagement rate |
| UG-4 | An experienced flipper's RuneLite plugin data auto-populates their task cards | Flip cards updated via plugin / total cards |

#### Product Goals
| ID | Goal | How Measured |
|---|---|---|
| PG-1 | Achieve 500 weekly active users within 3 months of launch | Google Analytics / Supabase auth |
| PG-2 | Flip Task Card feature used by > 40% of registered users | Feature usage tracking |
| PG-3 | Average session duration > 8 minutes (vs ~3 min on competitor read-only tools) | Analytics |
| PG-4 | OSRS community mentions in Reddit (r/2007scape, r/OSRSflipping) within 60 days | Manual tracking |

### Non-Goals (v1)

| Non-Goal | Rationale |
|---|---|
| Mobile-native app (iOS/Android) | Build web-first, PWA in Phase 3 |
| Real-time price alerts via email/SMS | WebSocket alerts in-browser suffice for MVP; external notifications are infrastructure cost |
| Social / community flip sharing | Requires moderation, privacy design — Phase 3 |
| AI / ML flip recommendations | Needs historical dataset first; premature for v1 |
| Merching / bulk buy tracking | Different use case from GE flipping, out of scope |
| OSRS mobile app API integration | RuneLite is desktop-only; mobile trades tracked manually |
| Payment / premium tier | Ship free, validate usage before monetizing |
| Separate login for plugin vs web | One account everywhere — unified auth is a core requirement |

---

## 5. User Stories

### 5.1 Market Scanner

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-101 | Rookie flipper | See a table of items sorted by highest margin | I can quickly identify what items are profitable to flip right now |
| US-102 | Active flipper | Filter items by trade volume in the last hour | I only see items with enough liquidity to complete my flip quickly |
| US-103 | Any user | Search for a specific item by name with autocomplete | I can check an item I already have in mind without scrolling |
| US-104 | Any user | Apply preset filters ("Best Margins", "High Volume", "F2P Only") | I can narrow the scanner to my playstyle in one click |
| US-105 | Active flipper | See both buy (insta-buy) and sell (insta-sell) prices per item | I understand the real spread I will actually get, not theoretical highs/lows |
| US-106 | Any user | See when price data was last updated (timestamp) | I know if I am looking at stale data |
| US-107 | Active flipper | Click an item in the scanner and immediately add it to a Flip Task Card | I don't have to switch context to start tracking a flip I found |
| US-108 | Any user | See the High Alch value for an item | I can compare flipping profit vs alching profit |

### 5.2 GE Tax Calculator

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-201 | Any user | Enter a buy price, sell price, and quantity | I get a clear breakdown of my expected profit |
| US-202 | Any user | See the exact GE tax deducted (1% of sell, capped at 5M GP) | I know my real take-home, not the gross margin |
| US-203 | Any user | See the break-even sell price (minimum sell to not lose money) | I know how much I can lower my sell offer if the market moves against me |
| US-204 | Any user | See ROI % after tax | I can compare this flip vs others at a glance |
| US-205 | Active flipper | Auto-populate the calculator when clicking an item in the scanner | I don't have to manually re-enter prices I can already see |
| US-206 | Any user | See "Profit After Tax" displayed prominently in green/red | I instantly understand if the flip is worthwhile |

### 5.3 Flip Task Cards

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-301 | Active flipper | Create a Flip Task Card for an item I plan to flip | I have a dedicated place to track this specific trade |
| US-302 | Active flipper | Set a buy target price and sell target price on a card | I know exactly what prices I am aiming for |
| US-303 | Active flipper | Move a card through states: Planning → Buying → Bought → Selling → Sold → Completed | My flip's current status is always visible at a glance |
| US-304 | Active flipper | Enter the actual buy price achieved (may differ from target) | The card recalculates expected profit based on reality, not plan |
| US-305 | Active flipper | See all my in-progress flips in a kanban board view | I get a visual overview of where each flip stands |
| US-306 | Active flipper | See all my completed flips in a list/history view | I can review my past performance |
| US-307 | Active flipper | See session stats: total profit, ROI, number of completed flips, total tax paid | I know how my session is going without running calculations mentally |
| US-308 | Active flipper | Add a note to a Flip Task Card (e.g., "bought at 4am, low volume") | I can annotate context I might forget later |
| US-309 | Rookie flipper | See a "suggested" buy and sell price on a new card auto-filled from current market data | I don't have to research prices separately to set my targets |
| US-310 | Active flipper | Delete or archive a flip task card | I can remove mistakes or cancelled flips from my active board |
| US-311 | Active flipper | See actual profit vs expected profit per card after completion | I understand my execution accuracy |

### 5.4 Favorites / Watchlist

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-401 | Any user | Star an item to add it to a favorites list | I can quickly re-check my favorite items without searching each time |
| US-402 | Active flipper | Create multiple named watchlists (e.g., "Daily Flips", "High Risk", "Potions") | I can organize items by strategy or category |
| US-403 | Any user | See live prices for all items in my watchlist on one page | I can monitor my tracked items in real time |
| US-404 | Any user | Reorder items within a watchlist | I can put my highest-priority items at the top |
| US-405 | Active flipper | Add a note or target price to a watchlist item | I can annotate why I am watching a specific item |

### 5.5 RuneLite Plugin Integration (P1)

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-501 | Active flipper | Install a RuneLite plugin that links my in-game GE trades to the web app | My Flip Task Cards update automatically when I buy or sell in game |
| US-502 | Active flipper | Connect the plugin to my account with a unique API key | My data stays private and separate from other users |
| US-503 | Active flipper | See a live notification when my in-game GE offer completes | I know without alt-tabbing when to move to the next flip step |
| US-504 | Active flipper | See the plugin automatically move a card to "Bought" when I buy in-game | My kanban board reflects reality without manual updates |

### 5.6 OSRS Guides (P1)

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-601 | Rookie flipper | Read a "Flipping 101" guide explaining GE mechanics, margins, and tax | I understand the fundamentals before risking my GP |
| US-602 | Rookie flipper | Follow an interactive "First Flip" tutorial within the app | I complete my first flip with guidance, not guesswork |
| US-603 | Any user | Browse item category guides (runes, supplies, gear, herbs) | I can specialize my flipping strategy |
| US-604 | Active flipper | Learn about GE buy limits and reset timers | I plan my flip quantities correctly |

---

## 6. Feature Specification

### Priority Framework
- **P0 — Must ship for MVP launch.** Without these, the product does not solve the core problem.
- **P1 — Ship in Phase 2.** Significantly enhances the product; the core is usable without them.
- **P2 — Future consideration.** Design Phase 1/2 to not preclude these, but do not build yet.

---

### P0 — MVP Features

#### F-001: Market Scanner Dashboard
**Priority:** P0  
**User Stories:** US-101 through US-108

**Description:**  
A real-time item price table powered by the OSRS Wiki Prices API. The primary entry point for all users. Refreshes automatically every 60 seconds.

**Requirements:**

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| F-001-1 | Display all tradeable items with buy/sell prices | Given the app loads, all items from `/latest` endpoint are displayed within 3 seconds |
| F-001-2 | Show margin column: `sell_price - buy_price` | Margin calculated per item, shown in GP; negative margins shown in red |
| F-001-3 | Show ROI% column: `(margin / buy_price) * 100` | ROI% rounded to 2 decimal places |
| F-001-4 | Show 1h trade volume per item | Volume pulled from `/1h` endpoint and matched to items |
| F-001-5 | Show High Alch value | From `/mapping` endpoint `highalch` field |
| F-001-6 | Show GE tax per unit | `min(sell_price * 0.01, 5_000_000)`, shown in gold text |
| F-001-7 | Show net margin after tax | `margin - tax`, shown prominently |
| F-001-8 | Show last price update timestamp | Relative time (e.g., "Updated 45s ago") next to each row or globally |
| F-001-9 | Sort any column ascending/descending | Click column header to sort; default sort: net margin descending |
| F-001-10 | Filter by item name search with autocomplete | Debounced 300ms, shows top 10 matches, supports fuzzy matching |
| F-001-11 | Preset filter: "Best Margins" | Sort by net margin desc, volume > 100/hr, hide items with margin < 500 GP |
| F-001-12 | Preset filter: "High Volume" | Sort by 1h volume desc |
| F-001-13 | Preset filter: "F2P Items" | Filter to `members: false` items from `/mapping` |
| F-001-14 | Preset filter: "Members Items" | Filter to `members: true` items |
| F-001-15 | "Add to Flip Card" button per row | Opens a pre-filled Flip Task Card creation modal |
| F-001-16 | "Add to Watchlist" button per row | Adds item to default or selected watchlist |
| F-001-17 | Click row to open item detail page | Shows full item info + price history chart |

**Technical Notes:**
- Fetch `/mapping` once at app start and cache for 24 hours (item metadata changes rarely)
- Fetch `/latest` every 60 seconds; use `Cache-Control: max-age=60` on the internal API route
- Fetch `/1h` and `/5m` every 5 minutes for volume data
- Join on `item_id` in-memory on the client (Next.js)
- Set `User-Agent: OSRS-Flip-Tracker/1.0 (contact: designedbygotti@gmail.com)` on all Wiki API requests

---

#### F-002: GE Tax Calculator
**Priority:** P0  
**User Stories:** US-201 through US-206

**Description:**  
A prominent calculator widget, accessible from both the main nav and the item detail page. Computes exact profit after GE tax.

**Tax Formula:**
```
tax_per_unit     = min(sell_price * 0.01, 5_000_000)
gross_margin     = sell_price - buy_price
net_profit_unit  = gross_margin - tax_per_unit
net_profit_total = net_profit_unit * quantity
total_tax        = tax_per_unit * quantity
roi_pct          = (net_profit_unit / buy_price) * 100
breakeven_sell   = buy_price + tax_per_unit + 1
                 = ceil(buy_price / 0.99)  [when well below tax cap]
```

**Requirements:**

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| F-002-1 | Input fields: Buy Price, Sell Price, Quantity | All inputs accept integer values; commas accepted and auto-formatted |
| F-002-2 | Output: Tax per unit | Correctly calculates and displays `min(sell * 0.01, 5_000_000)` |
| F-002-3 | Output: Net profit per unit | Shows in green if positive, red if negative |
| F-002-4 | Output: Total net profit (qty * net unit) | Formatted with K/M suffix (e.g., 1.2M) |
| F-002-5 | Output: Total tax paid | Shows how much GP goes to the GE |
| F-002-6 | Output: ROI% | Shown after tax |
| F-002-7 | Output: Break-even sell price | Labeled clearly: "Min sell price to break even" |
| F-002-8 | Output: "Profit After Tax" shown in large font | Primary call-out, green/red colored |
| F-002-9 | Auto-populate from item selection in scanner | When user clicks item → calculator, prices pre-filled; user only sets quantity |
| F-002-10 | Calculator updates in real-time as user types | No submit button needed; reactive |
| F-002-11 | GE buy limit shown next to item (from `/mapping`) | Labeled "GE Buy Limit: X per 4 hours" |
| F-002-12 | "Max profit at GE limit" shown | `net_profit_unit * buy_limit` |

---

#### F-003: Flip Task Cards
**Priority:** P0  
**User Stories:** US-301 through US-311

**Description:**  
The core unique feature of OSRS Flip Tracker. Each flip is a "card" that progresses through a defined lifecycle, turning unstructured flipping into a managed workflow.

**Card Lifecycle States:**
```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────────────┐
│ Planning │ →  │  Buying  │ →  │  Bought  │ →  │ Selling  │ →  │   Sold   │ →  │ Completed  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘    └────────────┘
  Set targets   GE offer        Offer filled    GE offer         Offer filled    Stats locked
  Calculate     placed          Log actual      placed           Log actual      in history
  expected P&L                  buy price                        sell price
```

**Card Data Fields:**

| Field | Type | Description |
|---|---|---|
| `item_id` | int | OSRS item ID |
| `item_name` | string | Display name |
| `item_icon_url` | string | Item sprite from Wiki |
| `status` | enum | `planning \| buying \| bought \| selling \| sold \| completed` |
| `target_buy_price` | int | GP — the price you plan to buy at |
| `actual_buy_price` | int \| null | GP — what you actually paid |
| `target_sell_price` | int | GP — the price you plan to sell at |
| `actual_sell_price` | int \| null | GP — what you actually received |
| `quantity` | int | Number of items |
| `expected_profit` | int (computed) | Based on targets, after tax |
| `actual_profit` | int \| null (computed) | Based on actuals, after tax |
| `note` | string \| null | Free-text annotation |
| `created_at` | timestamp | When card was created |
| `bought_at` | timestamp \| null | When status moved to "Bought" |
| `sold_at` | timestamp \| null | When status moved to "Sold" |
| `completed_at` | timestamp \| null | When card was completed |
| `session_id` | uuid | Session this card belongs to |
| `user_id` | uuid | Owner |

**Requirements:**

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| F-003-1 | Create a Flip Task Card from item scanner, calculator, or watchlist | Modal opens pre-filled with item name, current market prices as suggested targets |
| F-003-2 | Kanban board view: columns per status | Horizontal scroll or column wrap; cards are draggable between adjacent columns |
| F-003-3 | List view: all cards in a sortable table | Toggle between Kanban and List view; preference persisted to localStorage |
| F-003-4 | Drag-and-drop card to next status | Only forward movement allowed via drag; backward requires explicit "Edit" action |
| F-003-5 | "Log actual buy" prompt when moving to "Bought" | Modal asks: "What price did you actually buy at?" — sets `actual_buy_price` |
| F-003-6 | "Log actual sell" prompt when moving to "Sold" | Modal asks: "What price did you actually sell at?" — sets `actual_sell_price` |
| F-003-7 | Card shows expected vs actual profit delta | After completion: shows `actual_profit - expected_profit` with label "vs plan" |
| F-003-8 | Cards persist across sessions (authenticated user) | Stored in database; anonymous users get localStorage fallback |
| F-003-9 | Card shows current market price vs target | Fetches live price for item; shows arrow if market moved against target |
| F-003-10 | Session stats panel | Shows: Total Profit (completed cards), ROI %, Flips Completed, Tax Paid, Session Time, Profit/hr — mirrors RuneLite panel from reference screenshot |
| F-003-11 | Archive completed cards | "Archive" button; moves to history tab, clears from active board |
| F-003-12 | Delete card | Confirmation dialog; removes card permanently |
| F-003-13 | Note field on each card | Expandable text area; shown collapsed on card, expanded on card detail |
| F-003-14 | "Quick flip" shortcut | From scanner row, one click creates a card in "Buying" state with current prices as targets |

**Session Stats Panel** (modeled on RuneLite Flipping Utilities):
```
┌─────────────────────────────┐
│  Session: 05:40:30          │
├─────────────────────────────┤
│  Total Profit    1,209,000  │
│  ROI                  1.23% │
│  Tax Paid        1,820,000  │
│  Flips Completed        31  │
│  Profit/hr        214k/hr   │
├─────────────────────────────┤
│  Item              Profit   │
│  ─────────────────────────  │
│  Nature rune       +42,500  │
│  Sharks            +88,200  │
│  ...                        │
└─────────────────────────────┘
```

---

#### F-004: Favorites / Watchlist
**Priority:** P0  
**User Stories:** US-401 through US-405

**Requirements:**

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| F-004-1 | Star icon on every item row to add to default watchlist | Toggle; filled star = in watchlist |
| F-004-2 | Dedicated "Watchlist" page showing all starred items with live prices | Refreshes every 60s same as scanner |
| F-004-3 | Create named watchlists (max 10 in MVP) | Modal: enter list name; appears in sidebar nav |
| F-004-4 | Add item to specific watchlist | Dropdown from star icon: "Add to..." shows all lists |
| F-004-5 | Watchlist page shows all items from selected list | List selector in page header |
| F-004-6 | Delete a watchlist (with confirmation) | Items are not deleted — they just lose the watchlist tag |
| F-004-7 | Items sortable within watchlist by drag-and-drop | Order persisted to DB |
| F-004-8 | Price delta indicator on watchlist items | Green/red arrow showing % change from when item was added |

---

### P1 — Enhanced Features

#### F-005: RuneLite Plugin Integration
**Priority:** P1  
**User Stories:** US-501 through US-504

**Description:**  
A custom RuneLite plugin (Java 11, Gradle) that reads GE transaction events from the client and POSTs them to the OSRS Flip Tracker backend API. Users authenticate the plugin with an API key from their account settings.

**Integration Flow:**
```
RuneLite Client         OSRS Flip Tracker Backend
──────────────          ─────────────────────────
GE Offer Placed   →     POST /api/plugin/trade
GE Offer Updated  →     POST /api/plugin/trade
GE Offer Complete →     POST /api/plugin/trade
                        ↓
                        Match to open FlipTaskCard
                        ↓
                        Update card status + actual price
                        ↓
                        Broadcast via WebSocket
                        ↓
Web App ← WebSocket ─── Update UI in real time
```

**Plugin Capabilities:**
- Reads `GrandExchangeOfferChanged` RuneLite event
- Extracts: `itemId`, `price`, `quantity`, `state` (BUYING/BOUGHT/SELLING/SOLD/CANCELLED)
- Posts to OSRS Flip Tracker API with auth header (`X-Plugin-Key: <api_key>`)
- Config panel in RuneLite: API Key input, enable/disable sync toggle, connection status indicator

**Requirements:**

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| F-005-1 | Plugin published to RuneLite Plugin Hub | PR submitted per hub guidelines; plugin passes code review |
| F-005-2 | User can generate an API key in account settings | "Plugin API Key" section; shows key with copy button; revoke button |
| F-005-3 | Plugin POSTs on every GE state change | Within 2 seconds of in-game event |
| F-005-4 | Backend matches trade to open Flip Task Card | Match by `itemId` + nearest quantity; surface ambiguity to user |
| F-005-5 | Card status auto-advances on match | BOUGHT → card moves to "Bought" with actual price; SOLD → "Sold" |
| F-005-6 | Web app receives update within 3 seconds | Via WebSocket push; no page refresh required |
| F-005-7 | In-browser notification: "Your [item] GE offer completed" | Browser Notification API; dismissable |

---

#### F-006: OSRS Guides Section
**Priority:** P1  
**User Stories:** US-601 through US-604

**Content Plan (v1):**

| Guide | Description | Target Persona |
|---|---|---|
| Flipping 101 | How the GE works, buy/sell prices, margins, GE tax explained | Rookie |
| Your First Flip | Step-by-step walkthrough using the app to execute a 100k GP flip | Rookie |
| Understanding GE Buy Limits | What buy limits are, 4-hour reset, how to plan around them | Rookie + Active |
| High Volume vs High Margin | Trade-offs, when to prioritize each | Active |
| F2P Flipping Guide | Best item categories for free-to-play accounts | Rookie (F2P) |
| Members Money Making Methods | Overview of profitable members-only flip categories | Active |
| Reading Price History Charts | How to spot trends, avoid pump-and-dump items | Active |
| GE Market Update Cycles | Wednesday updates, seasonal events, demand spikes | Active |

**Requirements:**

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| F-006-1 | Guides section accessible from main nav | Link in nav labeled "Guides" |
| F-006-2 | Guides rendered from Markdown (MDX) | Content editable without code deploy |
| F-006-3 | Guides have a table of contents with anchor links | Auto-generated from headings |
| F-006-4 | "Interactive First Flip" tutorial mode | Step-by-step overlay that walks user through scanner → calculator → task card |
| F-006-5 | Guides link to live data where relevant | E.g., "Flipping 101" links to scanner; "First Flip" tutorial launches the app workflow |

---

#### F-007: Advanced Price Charts
**Priority:** P1  
**User Stories:** (Supporting US-101, US-301, US-401)

**Requirements:**

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| F-007-1 | Line chart: price over time for any item | Uses `/timeseries?id={id}&timestep=5m\|1h\|6h\|24h` |
| F-007-2 | Timeframe selector: 1h, 6h, 24h, 7d, 30d | Maps to API `timestep` and `start` params |
| F-007-3 | Chart shows buy price and sell price as separate lines | High price (insta-buy) vs low price (insta-sell) |
| F-007-4 | Volume bars below price chart | Overlay histogram on chart canvas |
| F-007-5 | Chart accessible from item row click | Opens in item detail page or modal |
| F-007-6 | Zoom and pan on chart | Via chart library native interaction |

**Technology:** Recharts or lightweight-charts (TradingView library)

---

### P2 — Future Features

| Feature | Description | Why Not Now |
|---|---|---|
| **Portfolio Tracker** | Track total wealth across all in-progress flip items | Requires complete buy price history; needs more data first |
| **Recipe / Crafting Calculator** | Multi-step: input materials + costs, output: finished item value and profit | Complex UX; separate feature scope |
| **Community Flip Lists** | Share watchlists/flip setups with other users | Requires moderation, spam prevention, user reporting |
| **Mobile PWA** | Service worker, offline mode, home screen icon | Web-first validation before mobile investment |
| **Discord Bot** | Price alerts, flip completion notifications via Discord | Infrastructure and bot hosting cost; separate service |
| **AI Flip Suggestions** | ML model trained on price history to suggest flip opportunities | Needs 6+ months of internal price history data |
| **Flip Leaderboard** | Anonymous community profit/ROI leaderboard | Privacy design complexity |

---

## 7. Technical Architecture

### Stack Overview

| Layer | Technology | Rationale |
|---|---|---|
| Frontend Framework | Next.js 14+ (App Router) | SSR + RSC for SEO, fast initial load, API routes in same project |
| Language | TypeScript | Type safety critical for financial calculations |
| Styling | Tailwind CSS + shadcn/ui | Rapid UI development, consistent design system |
| Charts | Recharts or lightweight-charts | Recharts for simplicity; lightweight-charts if TradingView-style needed |
| State Management | Zustand + React Query (TanStack Query) | React Query for server state/caching; Zustand for UI state (active filters, session) |
| Auth | Supabase Auth (or NextAuth.js) | Free tier, row-level security, built-in OAuth |
| Database | Supabase (PostgreSQL) | Real-time subscriptions, free tier, row-level security |
| Caching | Next.js fetch cache + Redis (optional) | In-memory first; Redis only if rate-limiting becomes an issue |
| Real-time | Supabase Realtime or native WebSockets | For RuneLite plugin → web app push events |
| Deployment | Vercel (frontend + API routes) | Zero-config Next.js, edge functions if needed |
| RuneLite Plugin | Java 11, Gradle | Required by RuneLite Plugin Hub |

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT BROWSER                                 │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Market       │  │  Flip Task   │  │  Watchlist   │  │  Guides      │   │
│  │  Scanner      │  │  Cards       │  │              │  │  (MDX)       │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────────────┘   │
│         │                 │                  │                              │
│         └─────────────────┴──────────────────┘                             │
│                           │  React Query / fetch                            │
└───────────────────────────┼─────────────────────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────────────────────────┐
│                        NEXT.JS APP (Vercel)                                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        API Routes (/api/*)                          │   │
│  │                                                                     │   │
│  │  /api/prices/latest    →  Proxy + cache OSRS Wiki /latest           │   │
│  │  /api/prices/mapping   →  Proxy + cache OSRS Wiki /mapping (24h)    │   │
│  │  /api/prices/timeseries→  Proxy + cache OSRS Wiki /timeseries       │   │
│  │  /api/flip-tasks       →  CRUD for FlipTaskCards                    │   │
│  │  /api/watchlists       →  CRUD for Watchlists                       │   │
│  │  /api/plugin/trade     →  Receive RuneLite plugin trade events      │   │
│  │  /api/auth/[...next]   →  NextAuth or Supabase Auth handler         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────┬───────────────────────────────┬───────────────────────────┘
                  │ SQL queries                    │ HTTPS
┌─────────────────▼───────────────────┐  ┌────────▼────────────────────────────┐
│         SUPABASE (PostgreSQL)       │  │     OSRS WIKI PRICES API            │
│                                     │  │   prices.runescape.wiki/api/v1/osrs │
│  Tables:                            │  │                                     │
│  • items (cache)                    │  │  GET /latest                        │
│  • price_snapshots                  │  │  GET /mapping                       │
│  • flip_tasks                       │  │  GET /5m                            │
│  • watchlists                       │  │  GET /1h                            │
│  • watchlist_items                  │  │  GET /timeseries?id=&timestep=      │
│  • user_sessions                    │  └─────────────────────────────────────┘
│  • users (via Supabase Auth)        │
│                                     │
│  Realtime: flip_tasks table         │
│  (broadcasts updates to browser)    │
└─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         RUNELITE CLIENT (Java)                              │
│                                                                             │
│  ┌──────────────────────────────────────────┐                               │
│  │   OSRS Flip Tracker RuneLite Plugin      │                               │
│  │                                          │                               │
│  │   Listens: GrandExchangeOfferChanged     │                               │
│  │   Extracts: itemId, price, qty, state    │                               │
│  │   Auth: X-Plugin-Key header              │                               │
│  │                                          │                               │
│  │   POST https://osrs-flip-tracker.vercel  │                               │
│  │        .app/api/plugin/trade             │                               │
│  └──────────────────────────────────────────┘                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow: Real-Time Price Updates

```
OSRS Wiki API ──(every 60s)──► Next.js API Route
                                      │
                                      ▼
                              In-memory LRU Cache
                              (keyed by endpoint)
                                      │
                                      ▼
                              Client (React Query)
                              polls /api/prices/latest
                              every 60 seconds
                                      │
                                      ▼
                              Scanner Table re-renders
                              with stale-while-revalidate
```

### Data Flow: RuneLite Plugin → Flip Task Card Update

```
In-game GE action
      │
      ▼ (within ~1s)
GrandExchangeOfferChanged event (RuneLite)
      │
      ▼
OSRS Flip Tracker Plugin
      │ POST /api/plugin/trade
      │ { itemId, price, qty, state, apiKey }
      ▼
Next.js API Route
      │  Verify apiKey → resolve userId
      │  Find matching flip_task (by itemId, qty)
      │  Update status + actual price
      ▼
Supabase UPDATE flip_tasks
      │
      ▼ (Supabase Realtime)
Browser WebSocket subscription
      │
      ▼
React Query cache invalidated
      │
      ▼
Flip Task Card updates on screen
```

### Security Considerations

| Concern | Mitigation |
|---|---|
| OSRS Wiki API rate limiting | Proxy via Next.js API routes with server-side cache; never call from browser |
| Plugin API key exposure | Keys stored as hashed values; display only once on creation |
| User data isolation | Supabase Row Level Security policies: `user_id = auth.uid()` on all tables |
| CORS for plugin POST | Restrict `/api/plugin/trade` to `POST` only; validate `apiKey` server-side |
| XSS | Next.js sanitizes JSX by default; avoid `dangerouslySetInnerHTML` in user content |
| SQL injection | Supabase uses parameterized queries via its client SDK |

---

## 8. Data Model

### Entity Relationship Overview

```
users
  │
  ├──< flip_tasks (many per user)
  │      └── belongs to user_session
  │
  ├──< user_sessions (many per user)
  │
  ├──< watchlists (many per user)
  │      └──< watchlist_items (many per list)
  │             └── references items
  │
  └── plugin_api_keys (one or more per user)

items (global cache, not user-owned)
  └──< price_snapshots (many per item, timestamped)
```

### Table Definitions

#### `items`
Cached from OSRS Wiki `/mapping`. Refreshed every 24 hours.

| Column | Type | Notes |
|---|---|---|
| `id` | integer (PK) | OSRS item ID |
| `name` | text | e.g., "Nature rune" |
| `examine` | text | In-game examine text |
| `members` | boolean | Members-only item |
| `lowalch` | integer | Low alchemy value (GP) |
| `highalch` | integer | High alchemy value (GP) |
| `limit` | integer | GE buy limit per 4 hours |
| `icon` | text | Icon filename from Wiki |
| `icon_url` | text | Computed CDN URL |
| `updated_at` | timestamptz | Last cache refresh |

#### `price_snapshots`
Rolling window of price data. One row per (item, timestamp, source).

| Column | Type | Notes |
|---|---|---|
| `id` | bigserial (PK) | |
| `item_id` | integer (FK → items) | |
| `source` | enum | `latest \| 5m \| 1h` |
| `high_price` | integer | Insta-buy price (GP) |
| `low_price` | integer | Insta-sell price (GP) |
| `high_time` | integer | Unix timestamp of high trade |
| `low_time` | integer | Unix timestamp of low trade |
| `avg_high_price` | integer | Null for `latest`, set for `5m`/`1h` |
| `avg_low_price` | integer | Null for `latest`, set for `5m`/`1h` |
| `high_price_volume` | integer | Null for `latest` |
| `low_price_volume` | integer | Null for `latest` |
| `recorded_at` | timestamptz | When this row was written |

*Note: Only store `latest` snapshots in DB for persistence. `5m`/`1h` cached in-memory or Redis. Purge snapshots older than 7 days.*

#### `flip_tasks`
Core table for the Flip Task Card feature.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → auth.users) | Row Level Security |
| `session_id` | uuid (FK → user_sessions, nullable) | Null for orphaned tasks |
| `item_id` | integer (FK → items) | |
| `status` | enum | `planning\|buying\|bought\|selling\|sold\|completed\|cancelled` |
| `target_buy_price` | integer | GP |
| `target_sell_price` | integer | GP |
| `actual_buy_price` | integer (nullable) | Set when status → bought |
| `actual_sell_price` | integer (nullable) | Set when status → sold |
| `quantity` | integer | |
| `note` | text (nullable) | Free text |
| `board_position` | integer | For kanban column ordering |
| `created_at` | timestamptz | |
| `buying_at` | timestamptz (nullable) | When moved to "buying" |
| `bought_at` | timestamptz (nullable) | When moved to "bought" |
| `selling_at` | timestamptz (nullable) | When moved to "selling" |
| `sold_at` | timestamptz (nullable) | When moved to "sold" |
| `completed_at` | timestamptz (nullable) | |

*Computed columns (via DB functions or app-layer):*
- `expected_profit` = `(target_sell - target_buy - tax(target_sell)) * quantity`
- `actual_profit` = `(actual_sell - actual_buy - tax(actual_sell)) * quantity` (if both set)

#### `user_sessions`
Groups flip tasks into a timed session for stats aggregation.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK) | |
| `started_at` | timestamptz | |
| `ended_at` | timestamptz (nullable) | Null = active session |
| `total_profit` | bigint (nullable) | Computed on session end |
| `total_tax_paid` | bigint (nullable) | |
| `flips_completed` | integer | Count of completed tasks |

#### `watchlists`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK) | |
| `name` | text | e.g., "Daily Flips" |
| `is_default` | boolean | One default per user |
| `created_at` | timestamptz | |

#### `watchlist_items`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `watchlist_id` | uuid (FK → watchlists) | |
| `item_id` | integer (FK → items) | |
| `note` | text (nullable) | Optional annotation |
| `target_price` | integer (nullable) | Price alert threshold |
| `sort_order` | integer | Drag-and-drop order |
| `added_at` | timestamptz | For "price delta since added" calc |
| `price_at_add` | integer (nullable) | Snapshot of price when added |

#### `plugin_api_keys`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK) | |
| `key_hash` | text | bcrypt hash of the key |
| `key_prefix` | text | First 8 chars for display (e.g., "osft_abc") |
| `created_at` | timestamptz | |
| `last_used_at` | timestamptz (nullable) | |
| `revoked_at` | timestamptz (nullable) | Null = active |

---

## 9. API Design

### Internal REST Endpoints

All endpoints require authentication unless marked `[public]`.

#### Prices (Proxy to OSRS Wiki API)

```
GET  /api/prices/latest           [public]  All items, current high/low prices
GET  /api/prices/mapping          [public]  Item metadata (name, limit, alch, icon)
GET  /api/prices/5m               [public]  5-min averages with volume
GET  /api/prices/1h               [public]  1-hour averages with volume
GET  /api/prices/timeseries       [public]  ?id={itemId}&timestep={5m|1h|6h|24h}
```

**Response format (prices/latest):**
```json
{
  "data": {
    "4151": {
      "high": 2850000,
      "highTime": 1709295600,
      "low": 2830000,
      "lowTime": 1709295580
    }
  },
  "cachedAt": "2026-03-01T12:00:00Z",
  "nextRefresh": "2026-03-01T12:01:00Z"
}
```

#### Flip Tasks

```
GET    /api/flip-tasks              List tasks for authenticated user
                                    ?status=active|completed|all
                                    ?session_id={uuid}
POST   /api/flip-tasks              Create new flip task
PUT    /api/flip-tasks/:id          Update task (status, prices, note)
DELETE /api/flip-tasks/:id          Delete task
POST   /api/flip-tasks/:id/advance  Advance to next status (with optional actual price)
```

**POST /api/flip-tasks body:**
```json
{
  "item_id": 4151,
  "target_buy_price": 2820000,
  "target_sell_price": 2850000,
  "quantity": 3,
  "note": "Weekend price dip",
  "session_id": "uuid-optional"
}
```

**POST /api/flip-tasks/:id/advance body:**
```json
{
  "to_status": "bought",
  "actual_price": 2815000
}
```

#### Watchlists

```
GET    /api/watchlists                 List user's watchlists
POST   /api/watchlists                 Create watchlist { name }
DELETE /api/watchlists/:id             Delete watchlist
GET    /api/watchlists/:id/items       Get items in list
POST   /api/watchlists/:id/items       Add item { item_id, note, target_price }
DELETE /api/watchlists/:id/items/:itemId  Remove item
PUT    /api/watchlists/:id/items/reorder  Reorder { ordered_ids: [itemId, ...] }
```

#### Sessions

```
GET    /api/sessions                   List user's sessions
POST   /api/sessions                   Start a new session
PUT    /api/sessions/:id/end           End session (computes aggregate stats)
GET    /api/sessions/:id/stats         Get session stats (profit, ROI, etc.)
```

#### Plugin Integration

```
POST   /api/plugin/trade               Receive GE trade event from RuneLite plugin
```

**Authentication:** `X-Plugin-Key: osft_<key>` header (not Bearer token)

**Request body:**
```json
{
  "item_id": 4151,
  "quantity_traded": 3,
  "price_per_item": 2815000,
  "total_quantity": 3,
  "ge_slot": 1,
  "state": "BOUGHT",
  "timestamp": 1709295600
}
```

**State values (from RuneLite `GrandExchangeOfferState`):**

| RuneLite State | Maps to Card Status |
|---|---|
| `BUYING` | `buying` |
| `BOUGHT` | `bought` |
| `SELLING` | `selling` |
| `SOLD` | `sold` |
| `CANCELLED_BUY` | `cancelled` |
| `CANCELLED_SELL` | `cancelled` |

#### Account / API Keys

```
GET    /api/account/plugin-keys        List user's plugin API keys
POST   /api/account/plugin-keys        Generate new key (returns plaintext once)
DELETE /api/account/plugin-keys/:id    Revoke key
```

### WebSocket (Supabase Realtime)

Use Supabase's realtime broadcast feature on the `flip_tasks` table. Client subscribes on login.

```typescript
// Client subscription example
const channel = supabase
  .channel(`flip_tasks:user_id=eq.${userId}`)
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'flip_tasks' },
    (payload) => {
      // Invalidate React Query cache for flip tasks
      queryClient.invalidateQueries(['flip-tasks'])
    }
  )
  .subscribe()
```

### OSRS Wiki API Rate Limit Compliance

```
Rule 1:  Always set User-Agent: "OSRS-Flip-Tracker/1.0 (contact: designedbygotti@gmail.com)"
Rule 2:  Cache /mapping for 24 hours (changes at most once per week)
Rule 3:  Cache /latest for 60 seconds server-side (data refreshes every ~60s anyway)
Rule 4:  Never loop per-item; always use bulk endpoints
Rule 5:  Cache /1h and /5m for 5 minutes
Rule 6:  /timeseries requests are per-item; limit to 10 concurrent max
```

---

## 10. Success Metrics

### North Star Metric
**Weekly Flip Tasks Created** — measures the core workflow adoption, not just passive browsing.

### Phase 1 (MVP) Metrics — Measure at 30 days post-launch

| Metric | Target | Stretch | Tool |
|---|---|---|---|
| Weekly Active Users | 200 | 500 | Vercel Analytics / Supabase |
| Flip Task Cards created | 500 total | 2,000 total | DB query |
| Cards reaching "Completed" | > 30% of created | > 50% | DB query |
| Calculator uses per session | ≥ 2 per visit | ≥ 5 | Event tracking |
| Average session duration | > 6 min | > 10 min | Vercel / GA |
| Returning users (week 2) | > 25% | > 40% | Analytics |
| Bounce rate (scanner page) | < 60% | < 40% | Analytics |

### Phase 2 (Plugin) Metrics — Measure at 30 days post-plugin launch

| Metric | Target | Stretch |
|---|---|---|
| Plugin installs | 100 | 500 |
| Cards auto-updated by plugin | > 20% of all card updates | > 50% |
| Session duration for plugin users vs non-plugin | Plugin users: +30% longer | |

### Phase 3 (Analytics/Community) Metrics

| Metric | Target |
|---|---|
| Users with 10+ completed flip cards | 100 |
| Guide page views | 5,000/month |
| Reddit mentions (r/2007scape, r/OSRSflipping) | ≥ 5 organic posts |

### Anti-Metrics (Things We Do NOT Want)
- **OSRS Wiki API rate limit violations** — zero tolerance; kills the product
- **User data leaks** — Supabase RLS tested before any auth-gated data is stored
- **Flip Task Cards with 0 completions** — indicates UX confusion in the lifecycle flow

---

## 11. Open Questions

| ID | Question | Owner | Blocking? | Notes |
|---|---|---|---|---|
| OQ-1 | Should anonymous users be able to create Flip Task Cards? | PM/Dev | Yes (MVP scope) | If yes: localStorage + session ID. Complexity: migration to DB on signup |
| OQ-2 | What happens when the RuneLite plugin can't match a trade to an open card? | Dev | No | Options: create a new card automatically, or add to "unmatched trades" inbox |
| OQ-3 | Should the scanner table be paginated or virtualized? | Dev | No | Virtualizing ~5,000 rows (react-virtual) vs paginating 50 rows at a time |
| OQ-4 | What is the pricing/subscription model, if any? | PM | No | Ship free first; possible premium tier (portfolio tracker, advanced analytics) post-validation |
| OQ-5 | Should we use Supabase or a separate Redis cache for API proxying? | Dev | No | Supabase is simpler; Redis only if >100 concurrent users causes Wiki API rate issues |
| OQ-6 | How do we handle GE price manipulation / artificially spiked items in the scanner? | PM/Dev | No | Possible: flag items where `high_time` or `low_time` is >10 min old |
| OQ-7 | Will RuneLite Plugin Hub accept a plugin that POSTs to an external API? | Dev | Yes (Phase 2) | Need to review Plugin Hub policy; some external-API plugins have been accepted (07.gg did it) |
| OQ-8 | Do we need server-side rendering for the scanner, or is client-side sufficient? | Dev | No | CSR with React Query is fine; SSR only needed for SEO pages (landing, guides) |
| OQ-9 | What should happen to open Flip Task Cards when a user logs out? | Dev | No | Option A: orphan in DB. Option B: warn "3 open tasks" on logout |
| OQ-10 | Should completed flip history be exportable (CSV)? | PM | No | Nice-to-have; add as P1 item if users ask |

---

## 12. Timeline & Phasing

### Phase 1 — MVP (Weeks 1–8)
**Goal:** Launch with Market Scanner, GE Tax Calculator, Flip Task Cards, and Watchlist. Core value proposition is usable and shippable.

```
Week 1–2: Foundation
  ├── Project setup: Next.js 14, TypeScript, Tailwind, shadcn/ui
  ├── Supabase project: DB schema (items, price_snapshots, flip_tasks, watchlists)
  ├── OSRS Wiki API proxy routes (/api/prices/*)
  ├── Item mapping cache (24h TTL)
  └── Auth: Supabase Auth (email + Google OAuth)

Week 3–4: Market Scanner
  ├── Scanner table component (virtualized, sortable, filterable)
  ├── Real-time price polling (60s via React Query)
  ├── Preset filters: Best Margins, High Volume, F2P, Members
  ├── Item name search with autocomplete
  └── Item detail page (basic info + price stats)

Week 5: GE Tax Calculator
  ├── Calculator widget (standalone page + embedded panel)
  ├── Tax formula implementation + tests
  ├── Break-even price calculation
  ├── Auto-populate from scanner item selection
  └── GE buy limit display

Week 6–7: Flip Task Cards
  ├── Kanban board component (per-status columns)
  ├── Card create/edit/delete CRUD
  ├── Status advance flow with actual price logging
  ├── Session stats panel (profit, ROI, tax, flips/hr)
  ├── Card ↔ scanner integration (quick add)
  └── List view toggle

Week 8: Watchlist + Polish + Launch
  ├── Watchlist: create, add/remove items, live prices
  ├── Multiple lists support
  ├── Responsive layout (desktop primary, tablet functional)
  ├── Error states, empty states, loading skeletons
  ├── Performance audit (Lighthouse ≥ 90)
  └── Deploy to Vercel + custom domain
```

**Phase 1 Deliverables:**
- Live web app at `osrs-flip-tracker.gg` (or similar)
- All P0 features shipped
- < 3-second initial load time
- Basic analytics instrumented

---

### Phase 2 — RuneLite Plugin + Guides (Weeks 9–16)
**Goal:** Close the loop between in-game GE activity and the web dashboard. Add educational content for acquisition.

```
Week 9–10: Price Charts
  ├── /timeseries API route
  ├── Chart component (Recharts)
  ├── Timeframe selector
  └── Volume histogram overlay

Week 11–12: OSRS Guides
  ├── MDX setup + guide layout
  ├── Write 4 core guides (Flipping 101, First Flip, Buy Limits, High Vol vs Margin)
  └── Interactive First Flip tutorial overlay

Week 13–15: RuneLite Plugin
  ├── Java plugin skeleton (Gradle, RuneLite API)
  ├── GrandExchangeOfferChanged listener
  ├── POST to /api/plugin/trade
  ├── Config panel: API key input, connection status
  ├── Backend: API key auth + trade-to-card matching logic
  ├── Supabase Realtime subscription on web app
  └── In-browser notification on trade completion

Week 16: Plugin Hub Submission + Phase 2 Polish
  ├── Plugin Hub PR submission
  ├── Plugin Hub review iteration
  ├── Write 4 more guides
  └── User feedback integration from Phase 1 users
```

**Phase 2 Deliverables:**
- RuneLite plugin published on Plugin Hub
- 8 guides live
- WebSocket-powered real-time card updates
- Plugin connection flow documented in app

---

### Phase 3 — Analytics & Community (Weeks 17–24)
**Goal:** Deepen engagement with historical analytics, personal performance tracking, and community features.

```
Week 17–18: Advanced Analytics
  ├── Personal flip history page (all completed flips)
  ├── Performance graphs (profit over time, ROI trends)
  └── Hourly/daily profit heatmap

Week 19–20: Portfolio Tracker
  ├── Mark items "in portfolio" with quantity and cost basis
  └── Total portfolio value vs cost (using live prices)

Week 21–22: Recipe / Crafting Calculator
  ├── Multi-ingredient input
  └── Output: finished item value, net GP, GP/hr estimate

Week 23–24: Community MVP
  ├── Share watchlists via URL
  ├── Public flip leaderboard (anonymous, opt-in)
  └── Discord bot: flip completion + price alert notifications
```

---

### Milestone Summary

| Milestone | Target Date | Success Criteria |
|---|---|---|
| Phase 1 MVP Live | Week 8 | All P0 features shipped; 50 users in first week |
| Phase 2 Plugin Approved | Week 16 | RuneLite Plugin Hub PR merged |
| Phase 3 Analytics Live | Week 24 | 100 users with 10+ completed flip cards |

---

## Appendix A: OSRS Wiki API Reference

**Base URL:** `https://prices.runescape.wiki/api/v1/osrs`

| Endpoint | Method | Cache TTL | Notes |
|---|---|---|---|
| `/latest` | GET | 60s | Returns `{ data: { [itemId]: { high, highTime, low, lowTime } } }` |
| `/mapping` | GET | 24h | Returns array of `{ id, name, examine, members, lowalch, highalch, limit, icon }` |
| `/5m` | GET | 5m | Returns 5-min VWAP + volume per item |
| `/1h` | GET | 5m | Returns 1-hr VWAP + volume per item |
| `/timeseries` | GET | 15m | Query params: `id` (required), `timestep` (5m/1h/6h/24h) |

**Required Header:**
```
User-Agent: OSRS-Flip-Tracker/1.0 (contact: designedbygotti@gmail.com)
```

---

## Appendix B: GE Tax Reference

| Scenario | Formula | Example |
|---|---|---|
| Standard item | `tax = sell_price * 0.01` | Sell 500gp → tax = 5gp |
| Tax cap hit | `tax = 5,000,000` | Sell 600,000,000gp → tax = 5,000,000gp |
| Net profit/unit | `sell - buy - tax` | Buy 490, sell 510, tax 5 → net = +15gp |
| Total profit | `net_per_unit * quantity` | 15gp × 100 = 1,500gp |
| Break-even sell | `ceil(buy_price / 0.99)` (standard) | Buy at 1000gp → min sell = 1011gp |
| ROI% | `(net_per_unit / buy_price) * 100` | 15/490 × 100 = 3.06% |
| Max profit at GE limit | `net_per_unit * item_buy_limit` | 15gp × 10,000 = 150,000gp |

*Note: The tax cap of 5M GP applies per individual item in a GE trade, not per slot. Selling 100 Twisted Bows each worth 1.6B GP would incur 5M tax per bow.*

---

## Appendix C: RuneLite Plugin Development Notes

**References:**
- Example plugin: https://github.com/runelite/example-plugin
- Plugin Hub submission: https://github.com/runelite/plugin-hub
- Relevant API: `net.runelite.api.events.GrandExchangeOfferChanged`
- Relevant API: `net.runelite.client.plugins.grandexchange.GrandExchangePlugin`

**Key Java classes:**
```java
// Event listener
@Subscribe
public void onGrandExchangeOfferChanged(GrandExchangeOfferChanged event) {
    GrandExchangeOffer offer = event.getOffer();
    int itemId = offer.getItemId();
    int quantity = offer.getTotalQuantity();
    int price = offer.getPrice();
    GrandExchangeOfferState state = offer.getState();
    int slot = event.getSlot();
    // POST to OSRS Flip Tracker API
}
```

**Config panel fields:**
```java
@ConfigItem(
    keyName = "apiKey",
    name = "OSRS Flip Tracker API Key",
    description = "Your API key from osrs-flip-tracker.gg/settings"
)
String apiKey();

@ConfigItem(
    keyName = "syncEnabled",
    name = "Enable Sync",
    description = "Automatically sync GE trades to OSRS Flip Tracker"
)
boolean syncEnabled();
```

---

*End of PRD v1.0*

*Next step: Review open questions, finalize tech stack choices (OQ-1, OQ-3, OQ-5), and set up the Next.js project scaffold.*
