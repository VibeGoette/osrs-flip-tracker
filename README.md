# OSRS Flip Tracker

> **From market scan to completed flip — all in one place.**

A web-based Grand Exchange flipping tool for Old School RuneScape that turns chaotic flipping into a structured, trackable workflow.

## Core Feature: Flip Task Cards

Unlike tools that only show you *what* to flip, OSRS Flip Tracker guides you *through* every flip using **Flip Task Cards** — a Kanban-style board where each flip is a managed task:

```
Planning → Buying → Bought → Selling → Sold → Completed
```

Every other feature (scanner, calculator, watchlist, RuneLite plugin) feeds into the Task Card workflow.

## Features

### MVP (Phase 1)
- **Market Scanner** — Real-time GE prices from the OSRS Wiki API with 60+ filter/sort options
- **Flip Task Cards** — Kanban board to manage active flips with status tracking, actual vs target prices, and session stats
- **GE Tax Calculator** — Exact profit after 1% tax (capped at 5M GP), break-even price, ROI%, volume profit
- **Watchlist** — Multiple named watchlists with live price updates

### Enhanced (Phase 2)
- **RuneLite Plugin** — Auto-sync GE trades to Task Cards via a custom RuneLite plugin
- **OSRS Guides** — Flipping tutorials for beginners and advanced players
- **Price Charts** — Historical price/volume visualization

### Future (Phase 3)
- Portfolio Tracker, Recipe Calculator, Community Features, Discord Bot

## Unified Auth System

One account works across both the web app and RuneLite plugin:
1. Register at the web app (Email, Google, or Discord OAuth)
2. Use all features standalone (manual Task Cards)
3. Optionally generate a Plugin API Key in account settings
4. Connect the RuneLite plugin for automatic trade syncing

**The web app is fully functional without RuneLite.**

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 6 |
| Auth | NextAuth.js v5 |
| State | TanStack Query + Zustand |
| Charts | Recharts |
| RuneLite Plugin | Java 11, Gradle |

## Data Source

All price data comes from the [OSRS Wiki Real-time Prices API](https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices) — a partnership between the OSRS Wiki and RuneLite that provides crowdsourced GE transaction data updated every few seconds.

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm (recommended) or npm
- Supabase account (free tier works)

### Setup
```bash
# Clone the repo
git clone https://github.com/VibeGoette/osrs-flip-tracker.git
cd osrs-flip-tracker

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Set up database
npx prisma generate
npx prisma db push

# Start dev server
pnpm dev
```

## Project Documentation

| Document | Description |
|---|---|
| [`PRD.md`](./PRD.md) | Full Product Requirements Document — features, user stories, data model, API design, timeline |
| [`CLAUDE_CODE_MASTER_PROMPT.md`](./CLAUDE_CODE_MASTER_PROMPT.md) | Master prompt for Claude Code — rename to `CLAUDE.md` for auto-loading |
| [`RUNELITE_PLUGIN_GUIDE.md`](./RUNELITE_PLUGIN_GUIDE.md) | Step-by-step guide to building the RuneLite plugin (Java, for JS/TS devs) |

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Web Browser    │     │  RuneLite Client │     │  OSRS Wiki API   │
│                  │     │                  │     │                  │
│  Task Cards      │     │  GE Trade Events │     │  /latest         │
│  Scanner         │◄────┤  → Auto-sync     │     │  /mapping        │
│  Calculator      │     │    Task Cards    │     │  /timeseries     │
│  Watchlist       │     └────────┬─────────┘     └────────┬─────────┘
└────────┬─────────┘              │                        │
         │                        │                        │
         └────────────┬───────────┘                        │
                      ▼                                    │
         ┌──────────────────────┐                          │
         │  Next.js API Routes  │◄─────────────────────────┘
         │  (Vercel)            │
         └────────┬─────────────┘
                  │
                  ▼
         ┌──────────────────┐
         │  Supabase (PG)   │
         │  + Realtime       │
         └──────────────────┘
```

## Contributing

This project is in early development. Feel free to open issues for feature requests or bug reports.

## License

MIT

---

*Built by [@VibeGoette](https://github.com/VibeGoette)*
