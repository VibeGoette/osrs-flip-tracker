# OSRS Flip Tracker — Claude Code Master Prompt

> **Usage:** Place this file as `CLAUDE.md` in the project root. Claude Code will automatically load it as persistent project context. Reference sections by name when working on specific features.

---

## 1. Project Identity

| Field | Value |
|---|---|
| **Name** | OSRS Flip Tracker |
| **Repo** | https://github.com/VibeGoette/osrs-flip-tracker |
| **Owner** | VibeGoette |
| **Runtime** | Node.js 20+ |
| **Deployment** | Vercel (frontend + API routes) + Supabase (PostgreSQL) |
| **Language** | TypeScript (strict mode throughout) |

**What it is:** A web application for Old School RuneScape players who flip items on the Grand Exchange. The **core feature is Flip Task Cards** — a Kanban-style workflow that tracks every flip from opportunity to profit. Supporting features (market scanner, GE tax calculator, watchlist, RuneLite plugin, guides) all feed into the Task Card system.

**Key architectural principle:** The web app is fully functional standalone. The RuneLite plugin is an optional enhancement that auto-syncs trades to Task Cards. Both share a **unified auth system** — one account, one registration, works everywhere.

**Two usage modes:**
1. **Web-only mode** — User creates Task Cards manually, logs actual prices by hand when trades complete
2. **RuneLite-connected mode** — Plugin detects GE trades and auto-advances Task Card states + fills actual prices

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, `app/` directory) |
| Language | TypeScript 5+ with `strict: true` |
| Styling | Tailwind CSS v4 + shadcn/ui |
| ORM | Prisma 6 |
| Database | PostgreSQL via Supabase |
| Auth | NextAuth.js v5 (Auth.js) |
| Server state | TanStack Query v5 |
| Client state | Zustand v5 |
| Charts | Recharts v2 |
| Real-time | Socket.io (WebSocket for RuneLite sync) |
| Validation | Zod v3 |
| Testing | Vitest + Testing Library + Playwright |
| RuneLite plugin | Java 11, Gradle |

**Install commands for new dependencies:**
```bash
npx shadcn@latest init                        # shadcn/ui setup
npx shadcn@latest add [component]             # add individual component
npx prisma generate                           # regenerate client after schema changes
npx prisma db push                            # sync schema to Supabase
npx prisma studio                             # GUI for database
npm run dev                                   # start dev server (port 3000)
```

---

## 3. Project Structure

```
osrs-flip-tracker/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                # Sidebar + navbar wrapper
│   │   ├── page.tsx                  # Dashboard home / quick stats
│   │   ├── scanner/page.tsx          # Market Scanner
│   │   ├── calculator/page.tsx       # GE Tax Calculator
│   │   ├── flips/
│   │   │   ├── page.tsx              # Kanban board view
│   │   │   └── [id]/page.tsx         # Individual flip detail
│   │   ├── watchlist/page.tsx        # Favorites / Watchlist
│   │   ├── analytics/page.tsx        # Charts & historical stats
│   │   └── guides/
│   │       ├── page.tsx              # Guide index
│   │       └── [slug]/page.tsx       # Individual guide (MDX)
│   ├── api/
│   │   ├── items/
│   │   │   ├── route.ts              # GET all items (from DB cache)
│   │   │   └── [id]/route.ts         # GET single item
│   │   ├── prices/
│   │   │   ├── latest/route.ts       # Proxy OSRS Wiki /latest
│   │   │   ├── 5m/route.ts           # Proxy OSRS Wiki /5m
│   │   │   ├── 1h/route.ts           # Proxy OSRS Wiki /1h
│   │   │   └── timeseries/route.ts   # Proxy OSRS Wiki /timeseries
│   │   ├── flips/
│   │   │   ├── route.ts              # GET list, POST create
│   │   │   └── [id]/route.ts         # GET, PATCH, DELETE single flip
│   │   ├── watchlist/
│   │   │   ├── route.ts              # GET, POST
│   │   │   └── [id]/route.ts         # DELETE
│   │   ├── auth/[...nextauth]/route.ts
│   │   └── ws/route.ts               # WebSocket upgrade endpoint
│   ├── globals.css
│   ├── layout.tsx                    # Root layout (providers, fonts)
│   └── page.tsx                      # Landing / redirect to dashboard
├── components/
│   ├── ui/                           # shadcn/ui generated components (DO NOT edit manually)
│   ├── scanner/
│   │   ├── scanner-table.tsx
│   │   ├── scanner-filters.tsx
│   │   └── item-row.tsx
│   ├── calculator/
│   │   ├── flip-calculator.tsx
│   │   └── tax-breakdown.tsx
│   ├── flips/
│   │   ├── kanban-board.tsx
│   │   ├── flip-card.tsx
│   │   ├── flip-form.tsx
│   │   └── state-badge.tsx
│   ├── watchlist/
│   │   ├── watchlist-grid.tsx
│   │   └── watchlist-item-card.tsx
│   ├── charts/
│   │   ├── price-history-chart.tsx
│   │   ├── profit-chart.tsx
│   │   └── volume-chart.tsx
│   ├── guides/
│   │   └── guide-renderer.tsx
│   └── shared/
│       ├── item-icon.tsx             # Item icon from wiki CDN
│       ├── gp-value.tsx              # Formatted GP number (e.g. 1.2M)
│       ├── nav-sidebar.tsx
│       └── providers.tsx             # TanStack Query + Zustand providers
├── lib/
│   ├── osrs-api/
│   │   ├── client.ts                 # Base fetch with User-Agent header
│   │   ├── prices.ts                 # Price endpoint functions
│   │   ├── mapping.ts                # Item mapping + in-memory cache
│   │   └── types.ts                  # API response types
│   ├── prisma/
│   │   └── client.ts                 # Singleton Prisma client
│   ├── auth/
│   │   └── config.ts                 # NextAuth config
│   ├── calculator/
│   │   └── ge-tax.ts                 # GE tax logic (pure functions)
│   ├── hooks/
│   │   ├── use-prices.ts             # TanStack Query hooks for prices
│   │   ├── use-flips.ts              # TanStack Query hooks for flips
│   │   └── use-watchlist.ts
│   ├── store/
│   │   └── scanner-store.ts          # Zustand: filter/sort state for scanner
│   └── utils/
│       ├── format.ts                 # formatGP, formatTime, formatPercent
│       └── cn.ts                     # clsx + tailwind-merge utility
├── prisma/
│   └── schema.prisma
├── content/
│   └── guides/                       # .mdx files for guide content
│       ├── beginners-guide.mdx
│       ├── high-volume-flipping.mdx
│       └── members-items.mdx
├── runelite-plugin/
│   ├── src/main/java/com/osrsfliptracker/
│   │   ├── FlipTrackerPlugin.java
│   │   ├── FlipTrackerConfig.java
│   │   ├── FlipTrackerPanel.java
│   │   └── WebSocketClient.java
│   ├── build.gradle
│   └── runelite-plugin.properties
├── public/
│   └── items/                        # Cached item icon PNGs
├── .env.example
├── .env.local                        # NOT committed
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

**Key conventions:**
- Files: `kebab-case.tsx`
- Components: `PascalCase` named exports
- API route handlers: always export named `GET`, `POST`, `PATCH`, `DELETE`
- All pages are Server Components by default; add `"use client"` only for interactivity

---

## 4. Environment Variables

```bash
# .env.example — copy to .env.local and fill in

# Database
DATABASE_URL="postgresql://..."          # Supabase connection string (pooler)
DIRECT_URL="postgresql://..."            # Supabase direct URL (for migrations)

# Auth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# OSRS API (no key needed, just for reference)
OSRS_API_BASE="https://prices.runescape.wiki/api/v1/osrs"
OSRS_USER_AGENT="osrs-flip-tracker - @VibeGoette on GitHub"

# Optional: Discord OAuth (for login with Discord)
DISCORD_CLIENT_ID=""
DISCORD_CLIENT_SECRET=""
```

---

## 5. OSRS Wiki API Integration

**Base URL:** `https://prices.runescape.wiki/api/v1/osrs`

### CRITICAL: User-Agent Header

Every request to the OSRS Wiki API **must** include this header. The API actively blocks generic user agents (`python-requests`, `Java/{version}`, etc.).

```typescript
// lib/osrs-api/client.ts
const OSRS_API_BASE = 'https://prices.runescape.wiki/api/v1/osrs';

async function osrsApiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${OSRS_API_BASE}${path}`, {
    headers: {
      'User-Agent': 'osrs-flip-tracker - @VibeGoette on GitHub',
    },
    next: { revalidate: 60 }, // Next.js cache: revalidate every 60s
  });
  if (!res.ok) throw new Error(`OSRS API error: ${res.status} ${path}`);
  return res.json() as Promise<T>;
}
```

### Endpoints

#### 1. Latest prices (all items)
```
GET /latest
GET /latest?id={itemId}   ← only use for a single item lookup
```
Response shape:
```typescript
type LatestResponse = {
  data: Record<string, {
    high: number | null;        // Instant-buy price (GP)
    highTime: number | null;    // Unix timestamp of last high trade
    low: number | null;         // Instant-sell price (GP)
    lowTime: number | null;     // Unix timestamp of last low trade
  }>;
};
```
> **IMPORTANT:** Never loop over all items calling `/latest?id=X`. Fetch `/latest` once to get all ~3700 items in a single request.

#### 2. Item mapping (metadata)
```
GET /mapping
```
Response shape:
```typescript
type MappingItem = {
  id: number;
  name: string;
  examine: string;
  members: boolean;
  lowalch: number;
  highalch: number;
  limit: number;        // GE buy limit per 4 hours
  value: number;        // Store value
  icon: string;         // e.g. "Abyssal whip.png"
};
```
Cache this in memory on server startup and in the DB. It changes infrequently.

#### 3. 5-minute averages
```
GET /5m
GET /5m?timestamp={unix}
```
Response: `{ data: Record<string, { avgHighPrice, highPriceVolume, avgLowPrice, lowPriceVolume }> }`

#### 4. 1-hour averages
```
GET /1h
GET /1h?timestamp={unix}
```
Same structure as `/5m`.

#### 5. Time-series (price history)
```
GET /timeseries?id={itemId}&timestep={5m|1h|6h|24h}
```
Returns up to 365 data points:
```typescript
type TimeseriesResponse = {
  data: Array<{
    timestamp: number;
    avgHighPrice: number | null;
    avgLowPrice: number | null;
    highPriceVolume: number;
    lowPriceVolume: number;
  }>;
};
```

### Item icons

Icon URLs follow this pattern:
```
https://oldschool.runescape.wiki/images/{icon_filename_url_encoded}
// Example:
https://oldschool.runescape.wiki/images/Abyssal_whip.png
```
Replace spaces with underscores, then `encodeURIComponent`.

---

## 6. GE Tax Calculator Logic

The Grand Exchange charges a **1% tax on sell price, capped at 5,000,000 GP per item**.

```typescript
// lib/calculator/ge-tax.ts

/** Tax on a single item at a given sell price */
export function calculateGETax(sellPrice: number): number {
  return Math.min(Math.floor(sellPrice * 0.01), 5_000_000);
}

export interface FlipResult {
  taxPerItem: number;
  totalTax: number;
  profitPerItem: number;
  totalProfit: number;
  totalInvestment: number;
  roi: number;               // percentage
  breakEvenSellPrice: number;
}

/**
 * Calculate full flip profitability after GE tax.
 * breakEvenSellPrice: lowest sell price where profit >= 0
 */
export function calculateFlipProfit(
  buyPrice: number,
  sellPrice: number,
  quantity: number
): FlipResult {
  const taxPerItem = calculateGETax(sellPrice);
  const profitPerItem = sellPrice - buyPrice - taxPerItem;
  const totalProfit = profitPerItem * quantity;
  const totalInvestment = buyPrice * quantity;
  const roi = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
  // At breakeven: sellPrice - buyPrice - floor(sellPrice * 0.01) = 0
  // Approximation (exact when tax < cap): ceil(buyPrice / 0.99)
  const breakEvenSellPrice = Math.ceil(buyPrice / 0.99);

  return {
    taxPerItem,
    totalTax: taxPerItem * quantity,
    profitPerItem,
    totalProfit,
    totalInvestment,
    roi,
    breakEvenSellPrice,
  };
}
```

**Tax-exempt items:** A small number of items (bonds, certain quest items) are tax-exempt. Maintain an exclusion list:
```typescript
export const TAX_EXEMPT_ITEM_IDS = new Set([13190]); // Bond ID
```

---

## 7. Database Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  accounts      Account[]
  sessions      Session[]
  flips         FlipTask[]
  watchlist     Watchlist?
  flipSessions  FlipSession[]
  pluginApiKeys PluginApiKey[]  // RuneLite plugin auth
}

// NextAuth required models
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}

// OSRS Items (seeded from /mapping, updated periodically)
model Item {
  id            Int      @id         // OSRS item ID
  name          String
  examine       String?
  members       Boolean  @default(false)
  lowalch       Int?
  highalch      Int?
  limit         Int?                 // GE buy limit per 4h
  value         Int?                 // Store value
  icon          String?              // filename on wiki CDN
  isTaxExempt   Boolean  @default(false)
  updatedAt     DateTime @updatedAt

  priceSnapshots PriceSnapshot[]
  flips          FlipTask[]
  watchlistItems WatchlistItem[]
}

// Cached price data (to avoid hammering the API)
model PriceSnapshot {
  id          String   @id @default(cuid())
  itemId      Int
  high        Int?
  highTime    DateTime?
  low         Int?
  lowTime     DateTime?
  avgHigh5m   Int?
  avgLow5m    Int?
  volume5m    Int?
  fetchedAt   DateTime @default(now())
  item        Item     @relation(fields: [itemId], references: [id])
  @@index([itemId, fetchedAt])
}

// Flip Task (core entity)
enum FlipState {
  PLANNING
  BUYING
  BOUGHT
  SELLING
  SOLD
  COMPLETED
  CANCELLED
}

model FlipTask {
  id             String    @id @default(cuid())
  userId         String
  itemId         Int
  state          FlipState @default(PLANNING)
  targetBuyPrice Int?
  actualBuyPrice Int?
  targetSellPrice Int?
  actualSellPrice Int?
  quantity       Int       @default(1)
  notes          String?   @db.Text
  // Computed & stored for query performance
  totalProfit    Int?
  roi            Float?
  // Timestamps per state
  createdAt      DateTime  @default(now())
  boughtAt       DateTime?
  soldAt         DateTime?
  completedAt    DateTime?
  updatedAt      DateTime  @updatedAt
  // RuneLite sync
  runeliteSynced Boolean   @default(false)

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  item     Item     @relation(fields: [itemId], references: [id])
  session  FlipSession? @relation(fields: [sessionId], references: [id])
  sessionId String?

  @@index([userId, state])
  @@index([userId, createdAt])
}

// Flip Session (group flips done in one play session)
model FlipSession {
  id          String   @id @default(cuid())
  userId      String
  name        String?
  startedAt   DateTime @default(now())
  endedAt     DateTime?
  totalProfit Int?
  flipCount   Int      @default(0)
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  flips       FlipTask[]
}

// Watchlist
model Watchlist {
  id        String          @id @default(cuid())
  userId    String          @unique
  user      User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  items     WatchlistItem[]
  createdAt DateTime        @default(now())
}

model WatchlistItem {
  id          String    @id @default(cuid())
  watchlistId String
  itemId      Int
  notes       String?
  alertHigh   Int?      // Price alert: notify if high >= this
  alertLow    Int?      // Price alert: notify if low <= this
  addedAt     DateTime  @default(now())
  watchlist   Watchlist @relation(fields: [watchlistId], references: [id], onDelete: Cascade)
  item        Item      @relation(fields: [itemId], references: [id])
  @@unique([watchlistId, itemId])
}

// Unified Auth: Plugin API Keys
// Generated in web app account settings, used by RuneLite plugin to authenticate
model PluginApiKey {
  id        String    @id @default(cuid())
  userId    String
  keyHash   String                    // bcrypt hash of the key
  keyPrefix String                    // First 8 chars for display (e.g. "osft_abc1")
  name      String?                   // User-given label (e.g. "Main account")
  lastUsedAt DateTime?
  revokedAt DateTime?
  createdAt DateTime  @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([keyHash])
}
```

### Unified Auth Architecture

One registration, two access methods:

```
┌────────────────────┐           ┌────────────────────┐
│   Web Browser       │           │  RuneLite Client   │
│                    │           │                    │
│  NextAuth session  │           │  X-Plugin-Key hdr  │
│  (cookie-based)    │           │  (API key-based)   │
└─────────┬──────────┘           └─────────┬──────────┘
          │                               │
          └────────────┬─────────────┘
                       ▼
         ┌──────────────────────┐
         │    Same User Account    │
         │    Same FlipTask data   │
         │    Same sessions/stats  │
         └──────────────────────┘
```

**Plugin key auth middleware pattern:**
```typescript
// lib/auth/plugin-auth.ts
import { prisma } from '@/lib/prisma/client';
import bcrypt from 'bcryptjs';

export async function authenticatePlugin(apiKey: string): Promise<string | null> {
  // Key format: osft_<32-char-random>
  const keys = await prisma.pluginApiKey.findMany({
    where: { revokedAt: null },
  });
  for (const key of keys) {
    if (await bcrypt.compare(apiKey, key.keyHash)) {
      await prisma.pluginApiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      });
      return key.userId; // Return the unified user ID
    }
  }
  return null;
}
```

---

## 8. Flip Task State Machine

States flow in one direction (with one exception):

```
PLANNING → BUYING → BOUGHT → SELLING → SOLD → COMPLETED
                                              ↑
                                         CANCELLED (from any state)
```

**State semantics:**
| State | Meaning |
|---|---|
| `PLANNING` | User has identified an item to flip, not yet placed buy offer |
| `BUYING` | Buy offer placed in GE |
| `BOUGHT` | Buy offer fully filled — item in inventory |
| `SELLING` | Sell offer placed in GE |
| `SOLD` | Sell offer fully filled — GP received |
| `COMPLETED` | User has confirmed and reviewed the flip |
| `CANCELLED` | Abandoned at any point |

**Automatic transitions via RuneLite plugin:**
- Trade detected for item at target buy price → `BUYING` → `BOUGHT`
- Trade detected for item at target sell price → `SELLING` → `SOLD`

---

## 9. Design System

### Color Palette

```typescript
// tailwind.config.ts — extend theme.colors
colors: {
  background: '#0d0d1a',   // Deepest background (page bg)
  surface:    '#1a1a2e',   // Cards, panels
  surfaceAlt: '#16213e',   // Slightly lighter surface
  border:     '#2a2a4a',   // Subtle borders
  primary:    '#e2b714',   // OSRS gold — CTAs, active states
  primaryDim: '#b8950f',   // Hover state for primary
  success:    '#00b300',   // Profit / buy price
  danger:     '#cc0000',   // Loss / sell price
  warning:    '#ff8c00',   // Alerts
  muted:      '#6b7280',   // Secondary text
  text:       '#e0e0e0',   // Primary text
  textDim:    '#9ca3af',   // Secondary text
}
```

### Typography
- Body: `Inter` (system-ui fallback)
- Numbers/GP values: `JetBrains Mono` — always use monospace for GP amounts
- OSRS-style headers: bold, slightly tracked, gold color

### Component Conventions
- Cards: `bg-surface border border-border rounded-lg`
- Primary button: `bg-primary text-background hover:bg-primaryDim`
- GP values always displayed with `JetBrains Mono` and formatted (see `formatGP` below)
- Item icons: 32×32 or 24×24, always from wiki CDN with fallback placeholder

### Utility Functions

```typescript
// lib/utils/format.ts

/** Format GP value: 1234567 → "1.23M gp" */
export function formatGP(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B gp`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M gp`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K gp`;
  return `${value.toLocaleString()} gp`;
}

/** Format profit with sign: "+12,345 gp" or "-1,200 gp" */
export function formatProfit(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatGP(value)}`;
}

/** ROI percentage with color hint */
export function formatROI(roi: number): string {
  return `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`;
}
```

---

## 10. API Route Patterns

All route handlers follow this structure:

```typescript
// app/api/flips/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma/client';
import { z } from 'zod';

const CreateFlipSchema = z.object({
  itemId: z.number().int().positive(),
  targetBuyPrice: z.number().int().positive().optional(),
  targetSellPrice: z.number().int().positive().optional(),
  quantity: z.number().int().positive().default(1),
  notes: z.string().max(500).optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const flips = await prisma.flipTask.findMany({
      where: { userId: session.user.id },
      include: { item: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(flips);
  } catch (error) {
    console.error('[GET /api/flips]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    const parsed = CreateFlipSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const flip = await prisma.flipTask.create({
      data: { ...parsed.data, userId: session.user.id },
      include: { item: true },
    });
    return NextResponse.json(flip, { status: 201 });
  } catch (error) {
    console.error('[POST /api/flips]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Rules:**
1. Always authenticate first — return 401 before any DB query
2. Always validate input with Zod — return 400 with flattened errors
3. Wrap everything in try/catch — return 500 with logged error
4. Never expose raw Prisma errors to the client

---

## 11. TanStack Query Hooks

```typescript
// lib/hooks/use-prices.ts
import { useQuery } from '@tanstack/react-query';

export const priceKeys = {
  all: ['prices'] as const,
  latest: () => [...priceKeys.all, 'latest'] as const,
  timeseries: (id: number, timestep: string) =>
    [...priceKeys.all, 'timeseries', id, timestep] as const,
};

export function useLatestPrices() {
  return useQuery({
    queryKey: priceKeys.latest(),
    queryFn: () => fetch('/api/prices/latest').then(r => r.json()),
    refetchInterval: 60_000,   // Auto-refresh every 60 seconds
    staleTime: 30_000,
  });
}

export function usePriceTimeseries(itemId: number, timestep: '5m' | '1h' | '6h' | '24h') {
  return useQuery({
    queryKey: priceKeys.timeseries(itemId, timestep),
    queryFn: () =>
      fetch(`/api/prices/timeseries?id=${itemId}&timestep=${timestep}`).then(r => r.json()),
    staleTime: 5 * 60_000,
    enabled: !!itemId,
  });
}
```

---

## 12. Market Scanner Logic

The scanner is the main feature. It should display all tradeable OSRS items with real-time buy/sell spreads and calculated profit margins.

**Core calculation per item:**
```typescript
interface ScannerRow {
  itemId: number;
  name: string;
  icon: string;
  instaBuy: number | null;   // /latest high — price buyers are paying
  instaSell: number | null;  // /latest low — price sellers are accepting
  spread: number | null;     // instaBuy - instaSell (raw margin before tax)
  profitPerItem: number | null; // spread - tax (actual profit)
  roi: number | null;
  limit: number | null;      // GE buy limit
  maxProfit4h: number | null; // profitPerItem * limit
  volume5m: number | null;
  members: boolean;
}
```

**Filters the scanner should support:**
- Min/max ROI (%)
- Min/max profit per item (GP)
- Min/max insta-buy price (GP)
- Members / F2P toggle
- Search by name
- Min volume (5m volume)

**Sorting:** Default by `maxProfit4h` descending. All columns sortable.

---

## 13. RuneLite Plugin

The plugin is a separate Java project in `/runelite-plugin/`. It connects to our WebSocket endpoint to sync trades.

**Plugin responsibilities:**
1. Detect Grand Exchange trade completions (buy/sell offers filled)
2. Send trade data to `/api/ws` via WebSocket
3. Display a small panel in RuneLite showing active flips from the web app

**WebSocket message format (plugin → server):**
```json
{
  "type": "TRADE_COMPLETED",
  "payload": {
    "itemId": 4151,
    "itemName": "Abyssal whip",
    "price": 1850000,
    "quantity": 1,
    "tradeType": "BUY",
    "timestamp": 1709300000
  }
}
```

**WebSocket message format (server → plugin):**
```json
{
  "type": "ACTIVE_FLIPS",
  "payload": [
    {
      "flipId": "clx...",
      "itemId": 4151,
      "state": "BUYING",
      "targetBuyPrice": 1850000,
      "quantity": 1
    }
  ]
}
```

**Critical note for RuneLite plugin:** The Java plugin **must not** use `Java/{version}` as its HTTP User-Agent. Use `okhttp3` with a custom User-Agent if making direct API calls from Java.

---

## 14. Implementation Phases

Work through phases sequentially. Each phase should result in a deployable state.

### Phase 1 — Foundation & Market Scanner (Week 1–2)

**Goal:** App is live on Vercel, market scanner works with real data.

- [ ] Init Next.js 15, configure TypeScript strict mode
- [ ] Install and configure Tailwind v4 + shadcn/ui (`npx shadcn@latest init`)
- [ ] Set up Supabase project, configure `.env.local`
- [ ] Define Prisma schema (all models), run `prisma db push`
- [ ] Seed `Item` table from OSRS Wiki `/mapping` endpoint (write a seed script: `prisma/seed.ts`)
- [ ] Build OSRS API client (`lib/osrs-api/`) with proper User-Agent
- [ ] Proxy price endpoints through `/api/prices/` (prevents CORS + hides user-agent logic from client)
- [ ] Build Market Scanner page: table with live prices, spread, profit, ROI
- [ ] Build GE Tax Calculator page (standalone calculator with real-time item search)
- [ ] Wire up TanStack Query for price data (60s auto-refresh)
- [ ] Set up NextAuth with email/password (+ optional Discord OAuth)
- [ ] Basic responsive layout: sidebar nav, dark theme

### Phase 2 — Flip Task Cards & Watchlist (Week 3–4)

**Goal:** Users can track their flips end-to-end in the app.

- [ ] Kanban board UI for FlipTask (columns = states)
- [ ] Create/edit/delete flip tasks
- [ ] Manual state transitions with timestamps
- [ ] Flip session management (group flips by session)
- [ ] Watchlist: add/remove items, price alerts display
- [ ] Price history charts for individual items (Recharts + timeseries API)
- [ ] Session stats: total profit, ROI, best flip, worst flip

### Phase 3 — RuneLite Plugin & Guides (Week 5–6)

**Goal:** Auto-sync from in-game trades.

- [ ] WebSocket server setup (Socket.io on `/api/ws`)
- [ ] Plugin skeleton: Java project in `/runelite-plugin/`
- [ ] Trade detection in plugin → WebSocket → auto-update FlipTask state
- [ ] Guides section: MDX-based, static pages, OSRS-relevant content
- [ ] First 3 guide articles (beginner flipping, members items, high-volume)

### Phase 4 — Analytics & Polish (Week 7–8)

**Goal:** Production-ready, deployed to Vercel + Supabase.

- [ ] Analytics dashboard: cumulative profit chart, top items by profit, session history
- [ ] Price caching layer (store PriceSnapshot in DB to reduce API calls)
- [ ] Performance: image optimization, route prefetching, React Suspense boundaries
- [ ] PWA manifest + service worker (offline support for calculator)
- [ ] SEO: metadata API, OpenGraph tags
- [ ] Final Vercel deployment, configure domain, env vars in Vercel dashboard

---

## 15. Coding Standards

### TypeScript
```typescript
// Always use named exports (not default exports for components)
export function FlipCard({ flip }: { flip: FlipTask }) { ... }

// Define prop types inline or with interface — not type aliases for objects
interface FlipCardProps {
  flip: FlipTask;
  onStateChange: (id: string, state: FlipState) => void;
}

// Prefer const assertions for static data
const FLIP_STATES = ['PLANNING', 'BUYING', 'BOUGHT', 'SELLING', 'SOLD', 'COMPLETED'] as const;
type FlipState = typeof FLIP_STATES[number];
```

### Server vs. Client Components
```typescript
// DEFAULT: Server Component (no directive needed)
// Fetch data directly, no useState/useEffect
export default async function ScannerPage() {
  const items = await prisma.item.findMany();
  return <ScannerTable items={items} />;
}

// CLIENT: Add "use client" only for:
// - useState, useEffect, useRef
// - Event handlers (onClick, onChange)
// - Browser APIs
// - TanStack Query hooks (useQuery)
"use client";
export function ScannerFilters({ onFilter }: ...) { ... }
```

### Error Handling
```typescript
// Use error.tsx for route-level error boundaries
// app/(dashboard)/scanner/error.tsx
"use client";
export default function ScannerError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <p className="text-danger">Failed to load scanner: {error.message}</p>
      <button onClick={reset} className="btn-primary">Try again</button>
    </div>
  );
}
```

### Import aliases (tsconfig.json)
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```
Always use `@/` imports, never relative paths with `../../`.

---

## 16. Testing Strategy

```bash
# Run tests
npm run test          # Vitest (unit + component)
npm run test:e2e      # Playwright
npm run test:coverage # Coverage report
```

**Unit tests** (Vitest) — focus on:
- `lib/calculator/ge-tax.ts` — all tax edge cases, items at/above cap
- `lib/utils/format.ts` — number formatting
- `lib/osrs-api/` — mock fetch, verify User-Agent header is set

**Component tests** (Testing Library):
- `FlipCard` — renders correct state badge, calls onStateChange
- `FlipCalculator` — correct profit/ROI output for known inputs
- `ScannerTable` — renders rows, sorting works

**E2E tests** (Playwright):
- Auth flow: register → login → dashboard
- Create flip: add item → move through all states → complete
- Calculator: input prices → verify correct profit displayed

---

## 17. Deployment Checklist

**Vercel:**
1. Connect GitHub repo → auto-deploy on push to `main`
2. Set all environment variables in Vercel dashboard (copy from `.env.example`)
3. Set `NEXTAUTH_URL` to production URL
4. Enable Vercel Analytics

**Supabase:**
1. Create project in EU region (user is in Germany)
2. Copy connection string (use pooler URL for `DATABASE_URL`, direct URL for `DIRECT_URL`)
3. Run `npx prisma migrate deploy` for production migrations
4. Enable Row Level Security on all user-data tables
5. Set up Supabase auth webhook if using Supabase Auth (optional — we use NextAuth)

---

## 18. Quick Reference

| Task | Command |
|---|---|
| Start dev | `npm run dev` |
| Build | `npm run build` |
| Prisma: push schema | `npx prisma db push` |
| Prisma: generate client | `npx prisma generate` |
| Prisma: open studio | `npx prisma studio` |
| Prisma: seed DB | `npx prisma db seed` |
| Add shadcn component | `npx shadcn@latest add button` |
| Run unit tests | `npm run test` |
| Run E2E tests | `npm run test:e2e` |
| Format code | `npm run format` (Prettier) |
| Lint | `npm run lint` |

**OSRS Wiki API base:** `https://prices.runescape.wiki/api/v1/osrs`
**User-Agent required:** `osrs-flip-tracker - @VibeGoette on GitHub`
**Item icon CDN:** `https://oldschool.runescape.wiki/images/{Icon_Name.png}`

---

*This file is the single source of truth for project conventions. When in doubt, follow the patterns defined here. Update this file when architectural decisions change.*
