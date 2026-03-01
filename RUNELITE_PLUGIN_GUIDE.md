# RuneLite Plugin Development Guide
## OSRS Flip Tracker — From Zero to Plugin Hub

> **Audience:** VibeGoette — strong JavaScript/TypeScript background, beginner in Java.
> This guide is written accordingly: Java is explained relative to JS/TS where it differs,
> and every code file is complete and compilable.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Prerequisites](#2-prerequisites)
3. [Java Crash Course for JavaScript Developers](#3-java-crash-course-for-javascript-developers)
4. [Setting Up the Development Environment](#4-setting-up-the-development-environment)
5. [Plugin Architecture Deep Dive](#5-plugin-architecture-deep-dive)
6. [Implementing the Flip Tracker Plugin](#6-implementing-the-flip-tracker-plugin)
   - 6.1 [FlipTrackerConfig.java](#61-fliptrackerconfig-java)
   - 6.2 [FlipData.java](#62-flipdata-java)
   - 6.3 [GEOfferTracker.java](#63-geoffertracker-java)
   - 6.4 [FlipCalculator.java](#64-flipcalculator-java)
   - 6.5 [WebSyncService.java](#65-websyncservice-java)
   - 6.6 [FlipTrackerPanel.java](#66-fliptrackerpanel-java)
   - 6.7 [FlipTrackerPlugin.java](#67-fliptrackerplugin-java)
   - 6.8 [FlipTrackerPluginTest.java](#68-fliptrackerplugintestjava)
7. [GE Offer Event Deep Dive](#7-ge-offer-event-deep-dive)
8. [Build Files](#8-build-files)
9. [Building & Testing](#9-building--testing)
10. [Communication Protocol](#10-communication-protocol)
11. [Submitting to Plugin Hub](#11-submitting-to-plugin-hub)
12. [Troubleshooting & FAQ](#12-troubleshooting--faq)

---

## 1. Introduction

### What This Plugin Does

The OSRS Flip Tracker plugin runs inside the RuneLite client and does three things:

1. **Listens** to Grand Exchange events every time an offer changes state (buying, bought, selling, sold, cancelled).
2. **Calculates** flip profit: sell revenue minus buy cost minus the 2% GE tax, matched by item across GE slots.
3. **Displays** a sidebar panel showing your session stats and per-item breakdown.
4. **Syncs** completed trades to the OSRS Flip Tracker web application via HTTP POST, so your web dashboard stays up to date.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        RuneLite Client                          │
│                                                                 │
│  Game Engine ──► GrandExchangeOfferChanged event               │
│                         │                                       │
│                         ▼                                       │
│               FlipTrackerPlugin.java                            │
│               (event handler hub)                               │
│                    │          │                                  │
│                    ▼          ▼                                  │
│           GEOfferTracker   FlipCalculator                       │
│           (state machine)  (profit math)                        │
│                    │                                            │
│                    ▼                                            │
│           WebSyncService ──► HTTP POST ──► Your Web App        │
│           (HTTP client)       (JSON)       (Next.js / Vercel)   │
│                    │                                            │
│                    ▼                                            │
│           FlipTrackerPanel                                      │
│           (sidebar UI - Java Swing)                             │
└─────────────────────────────────────────────────────────────────┘
```

The web app is a **separate project** (your Next.js app). The plugin sends JSON payloads to your web app's `/api/trades` endpoint. Authentication is done via an API key stored in the plugin's config panel.

---

## 2. Prerequisites

### Required Tools

| Tool | Version | Download |
|---|---|---|
| Java JDK | 11 (Eclipse Temurin) | https://adoptium.net |
| IntelliJ IDEA | Community Edition (free) | https://www.jetbrains.com/idea/download |
| Git | Any recent | https://git-scm.com |
| RuneLite Client | Latest | https://runelite.net |
| GitHub account | — | https://github.com |

### Why Java 11?

RuneLite requires Java 11. Don't install Java 17 or 21 as your primary JDK for this project — things will break. Eclipse Temurin (formerly AdoptOpenJDK) is the recommended distribution.

### Verify Your Setup

After installing the JDK, open a terminal and run:
```bash
java -version
# Should output: openjdk version "11.x.x" ...

javac -version
# Should output: javac 11.x.x
```

---

## 3. Java Crash Course for JavaScript Developers

You know JavaScript/TypeScript well. This section maps Java concepts directly to what you already know.

### 3.1 Types and Variables

**JavaScript:**
```javascript
let name = "gotti";
const profit = 150000;
let isRunning = true;
```

**Java:**
```java
// Java is statically typed — you ALWAYS declare the type
String name = "gotti";
final int profit = 150000;  // 'final' = JS 'const'
boolean isRunning = true;

// Java 11 has 'var' for type inference (like JS 'let'), but use it sparingly
var count = 0;  // Java infers this is int
```

**Key difference:** Java types are *enforced at compile time*. If you declare `int x = "hello"` the compiler refuses to build.

**Primitive types you'll use:**
- `int` — whole numbers (like JS number for integers)
- `long` — big whole numbers (timestamps, large GP values)
- `double` — decimal numbers
- `boolean` — true/false
- `String` — text (capital S, it's a class not a primitive)

### 3.2 Classes

**JavaScript:**
```javascript
class FlipData {
  constructor(itemId, buyPrice, sellPrice) {
    this.itemId = itemId;
    this.buyPrice = buyPrice;
    this.sellPrice = sellPrice;
  }

  getProfit() {
    return this.sellPrice - this.buyPrice;
  }
}
```

**Java:**
```java
public class FlipData {
    // Fields — declared at class level, not inside constructor
    private int itemId;
    private int buyPrice;
    private int sellPrice;

    // Constructor — same name as class, no 'function' keyword
    public FlipData(int itemId, int buyPrice, int sellPrice) {
        this.itemId = itemId;
        this.buyPrice = buyPrice;
        this.sellPrice = sellPrice;
    }

    // Method — return type declared before method name
    public int getProfit() {
        return sellPrice - buyPrice;
    }
}
```

**Access modifiers:**
- `public` — accessible from anywhere (like JS default export)
- `private` — only accessible within this class
- `protected` — accessible within the class and subclasses

### 3.3 Interfaces

**TypeScript:**
```typescript
interface TradeConfig {
  apiUrl: string;
  apiKey: string;
  syncEnabled: boolean;
}
```

**Java:**
```java
// In RuneLite, Config interfaces use default methods instead of fields
// This is because RuneLite reads the interface at runtime to build the config UI
public interface FlipTrackerConfig extends Config {
    default String apiUrl() { return "https://your-app.vercel.app"; }
    default String apiKey() { return ""; }
    default boolean syncEnabled() { return true; }
}
```

### 3.4 Annotations (Java's Decorators)

Java annotations are essentially TypeScript decorators. They add metadata to classes, methods, or fields.

```java
// TypeScript decorator:
// @Injectable()
// class MyService { }

// Java equivalent:
@Singleton  // Guice DI annotation — this class is created once
public class WebSyncService {

    @Inject  // Tell Guice to inject this dependency automatically
    private Client client;

    @Subscribe  // Tell RuneLite to call this method when the event fires
    public void onGrandExchangeOfferChanged(GrandExchangeOfferChanged event) {
        // handle event
    }
}
```

The most important annotations in RuneLite:

| Annotation | Package | Purpose |
|---|---|---|
| `@PluginDescriptor` | `net.runelite.client.plugins` | Declares a class as a plugin with metadata |
| `@Inject` | `javax.inject` | Dependency injection — RuneLite will provide this object |
| `@Provides` | `com.google.inject` | Method that provides an injectable object |
| `@Subscribe` | `net.runelite.client.eventbus` | Subscribe to a RuneLite event |
| `@ConfigGroup` | `net.runelite.client.config` | Links config interface to a storage key |
| `@ConfigItem` | `net.runelite.client.config` | Declares one config field |
| `@Slf4j` | `lombok` | Adds a `log` field for logging (Lombok magic) |

### 3.5 Dependency Injection (DI)

RuneLite uses **Guice** for DI — think of it like React's Context API or Angular's DI system.

Instead of:
```javascript
// JS: manually creating dependencies
const client = new RuneLiteClient();
const tracker = new GEOfferTracker(client);
```

You do:
```java
// Java with @Inject: Guice creates and passes dependencies automatically
public class FlipTrackerPlugin extends Plugin {

    @Inject
    private Client client;  // RuneLite provides this — you never call 'new Client()'

    @Inject
    private GEOfferTracker offerTracker;  // Your class, Guice creates and injects it
}
```

**The rule:** Any class managed by RuneLite's DI system can use `@Inject` to get other managed objects. You never call `new` on injected classes.

### 3.6 Generics

**TypeScript:**
```typescript
const flips: Array<FlipData> = [];
const slotMap: Map<number, FlipData> = new Map();
```

**Java:**
```java
List<FlipData> flips = new ArrayList<>();
Map<Integer, FlipData> slotMap = new HashMap<>();
// Note: primitives can't be generic type params — use Integer, not int
```

### 3.7 Null Safety and Optional

Java doesn't have TypeScript's `?` optional chaining natively (until newer versions). Be explicit:

```java
// Checking for null before using a value
String itemName = itemManager.getItemComposition(itemId).getName();
if (itemName == null) {
    itemName = "Unknown Item";
}

// Java 8+ Optional (like TS optional chaining)
Optional<FlipData> flip = Optional.ofNullable(getFlip(itemId));
flip.ifPresent(f -> panel.addFlip(f));
```

### 3.8 Lambdas and Streams

**JavaScript array methods → Java streams:**

```javascript
// JS
const profits = flips.filter(f => f.profit > 0).map(f => f.profit);
const total = profits.reduce((sum, p) => sum + p, 0);
```

```java
// Java
List<Long> profits = flips.stream()
    .filter(f -> f.getProfit() > 0)
    .map(FlipData::getProfit)
    .collect(Collectors.toList());

long total = profits.stream().mapToLong(Long::longValue).sum();
```

### 3.9 Threading in RuneLite

**Critical concept:** RuneLite has two important threads:

- **Client thread** — the game's main thread. You *must* read game state here.
- **Event Dispatch Thread (EDT)** — Swing's UI thread. You *must* update UI here.

```java
// Reading game data: use clientThread
clientThread.invokeLater(() -> {
    String playerName = client.getLocalPlayer().getName();
    // safe to read game state here
});

// Updating the panel (Swing UI): use SwingUtilities
SwingUtilities.invokeLater(() -> {
    panel.updateStats(sessionProfit);
    // safe to update UI here
});
```

This is like React's `setState` needing to be called from the right context — cross the wrong boundary and things break or crash silently.

---

## 4. Setting Up the Development Environment

### Step 1: Install Java 11

1. Go to https://adoptium.net
2. Select **Temurin 11 (LTS)**
3. Download and install for your OS
4. Verify: `java -version` in terminal

### Step 2: Install IntelliJ IDEA Community Edition

1. Download from https://www.jetbrains.com/idea/download (scroll down for Community = free)
2. Install with default settings

### Step 3: Create Your Plugin from the Template

The RuneLite team provides an official example plugin as a GitHub template:

1. Go to https://github.com/runelite/example-plugin
2. Click the green **"Use this template"** button → **"Create a new repository"**
3. Name it `osrs-flip-tracker-plugin`
4. Set it to **Public** (required for Plugin Hub submission later)
5. Clone your new repository locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/osrs-flip-tracker-plugin.git
   cd osrs-flip-tracker-plugin
   ```

### Step 4: Open in IntelliJ IDEA

1. Open IntelliJ IDEA
2. **File → Open** → select the cloned folder
3. IntelliJ will detect the `build.gradle` and import the project automatically
4. Wait for Gradle to download dependencies (may take a few minutes on first open)

### Step 5: Configure JDK 11

1. **File → Project Structure** (Ctrl+Alt+Shift+S)
2. Under **Project SDK**, click **Add SDK → JDK**
3. Navigate to your Java 11 installation directory
   - Windows: `C:\Program Files\Eclipse Adoptium\jdk-11.x.x.x-hotspot`
   - macOS: `/Library/Java/JavaVirtualMachines/temurin-11.jdk/Contents/Home`
4. Set **Project language level** to **11**
5. Click **OK**

### Step 6: Create a Run Configuration

This lets you launch RuneLite with your plugin loaded directly from IntelliJ.

1. **Run → Edit Configurations**
2. Click **+** → **Application**
3. Fill in:
   - **Name:** `RuneLite (with plugin)`
   - **Main class:** `net.runelite.client.RuneLite`
   - **VM options:** `-ea`  ← enables assertions for debugging
   - **Program arguments:** `--developer-mode`
   - **Use classpath of module:** select your project module
4. Click **OK**

### Step 7: First Build

Press **Ctrl+F9** (Build Project). If everything is set up correctly, you'll see `BUILD SUCCESSFUL` in the Gradle console.

### Step 8: Launch RuneLite

Press **Shift+F10** (Run). RuneLite opens with your plugin available. Find it by clicking the wrench icon → search "Example".

> **Checkpoint:** If RuneLite launches and you can see the example plugin in the list, your setup is working. Now we'll replace the example code with the Flip Tracker.

---

## 5. Plugin Architecture Deep Dive

### 5.1 Plugin Lifecycle

Every RuneLite plugin has a lifecycle controlled by two methods:

```java
@Override
protected void startUp() throws Exception {
    // Called when the user enables your plugin (or client launches with it enabled)
    // Register overlays, add navigation buttons, subscribe to events
}

@Override
protected void shutDown() throws Exception {
    // Called when the user disables your plugin
    // Remove overlays, remove navigation buttons, clean up resources
}
```

Think of `startUp` as `componentDidMount` and `shutDown` as `componentWillUnmount`.

### 5.2 The Event System

RuneLite uses a publish-subscribe event system. The game engine publishes events; your plugin subscribes to them.

```java
// In your plugin class, just name the method 'on' + EventClassName
// RuneLite uses the method name convention to route events

@Subscribe
public void onGrandExchangeOfferChanged(GrandExchangeOfferChanged event) {
    // This method is called automatically whenever a GE offer changes
    // event.getSlot()  → which GE slot (0–7)
    // event.getOffer() → the GrandExchangeOffer object
}

@Subscribe
public void onGameStateChanged(GameStateChanged event) {
    // Called when player logs in, logs out, hops worlds, etc.
    if (event.getGameState() == GameState.LOGGED_IN) {
        // Player just logged in — start a new session
    }
}
```

**Note:** Method naming is not just convention for GrandExchangeOfferChanged — RuneLite's `@Subscribe` annotation routes calls by matching the method's parameter type to the event type. The `on` prefix is a strong convention but the parameter type is what actually matters.

### 5.3 Configuration System

```java
@ConfigGroup("fliptracker")         // Unique key for saving config to disk
public interface FlipTrackerConfig extends Config {

    @ConfigItem(
        keyName = "apiUrl",         // Storage key
        name = "API URL",           // Display name in UI
        description = "URL of your OSRS Flip Tracker web app"
    )
    default String apiUrl() {       // Default value
        return "https://your-app.vercel.app/api";
    }
}
```

RuneLite reads this interface at runtime and **auto-generates the config UI panel**. When a user changes a value in the panel, it's saved to disk. Your plugin reads it with `config.apiUrl()`.

### 5.4 Sidebar Panels

Panels are Java Swing components that appear in the right sidebar when the user clicks your plugin's icon.

```java
// In startUp():
panel = injector.getInstance(FlipTrackerPanel.class);  // DI creates the panel

BufferedImage icon = ImageUtil.loadImageResource(getClass(), "icon.png");

NavigationButton navButton = NavigationButton.builder()
    .tooltip("Flip Tracker")        // Hover text
    .icon(icon)                     // 16x16 PNG icon
    .priority(5)                    // Position in sidebar (lower = higher up)
    .panel(panel)                   // The panel to show when clicked
    .build();

clientToolbar.addNavigation(navButton);  // Register it

// In shutDown():
clientToolbar.removeNavigation(navButton);
```

### 5.5 The `@Provides` Method

Your plugin needs to tell Guice how to create your `FlipTrackerConfig`. You do this with `@Provides`:

```java
@Provides
FlipTrackerConfig provideConfig(ConfigManager configManager) {
    // RuneLite's ConfigManager reads the @ConfigGroup and @ConfigItem annotations
    // and creates a concrete implementation of your interface at runtime
    return configManager.getConfig(FlipTrackerConfig.class);
}
```

This is the standard boilerplate every plugin needs. You call it once and never touch it again.

---

## 6. Implementing the Flip Tracker Plugin

### File Structure

After implementation, your `src/` tree should look like this:

```
src/
└── main/
    ├── java/
    │   └── com/
    │       └── osrsfliptracker/
    │           ├── FlipTrackerPlugin.java
    │           ├── FlipTrackerConfig.java
    │           ├── FlipTrackerPanel.java
    │           ├── GEOfferTracker.java
    │           ├── FlipCalculator.java
    │           ├── WebSyncService.java
    │           └── FlipData.java
    └── resources/
        └── com/
            └── osrsfliptracker/
                └── icon.png        ← 16x16 PNG
```

Rename the existing `com.example` package to `com.osrsfliptracker` by right-clicking the package in IntelliJ → Refactor → Rename.

---

### 6.1 FlipTrackerConfig.java

```java
package com.osrsfliptracker;

import net.runelite.client.config.Config;
import net.runelite.client.config.ConfigGroup;
import net.runelite.client.config.ConfigItem;
import net.runelite.client.config.ConfigSection;

// @ConfigGroup links this interface to a storage namespace on disk.
// All config values for this plugin are saved under the key "fliptracker".
@ConfigGroup("fliptracker")
public interface FlipTrackerConfig extends Config
{
    // -----------------------------------------------------------------------
    // Config sections let you group related settings with a collapsible header
    // in the config panel UI. Define sections first, then reference them in
    // @ConfigItem via the section parameter.
    // -----------------------------------------------------------------------

    @ConfigSection(
        name = "Web Sync",
        description = "Settings for syncing trades to your web app",
        position = 0
    )
    String webSyncSection = "webSync";

    @ConfigSection(
        name = "Display",
        description = "Panel display settings",
        position = 1
    )
    String displaySection = "display";

    // -----------------------------------------------------------------------
    // Web Sync Settings
    // -----------------------------------------------------------------------

    @ConfigItem(
        keyName = "apiUrl",
        name = "API URL",
        description = "Base URL of your OSRS Flip Tracker web app (no trailing slash)",
        section = webSyncSection,
        position = 0
    )
    default String apiUrl()
    {
        return "https://your-app.vercel.app";
    }

    @ConfigItem(
        keyName = "apiKey",
        name = "API Key",
        description = "Your secret API key for authenticating with the web app",
        section = webSyncSection,
        position = 1,
        secret = true   // Hides the value in the UI (like a password field)
    )
    default String apiKey()
    {
        return "";
    }

    @ConfigItem(
        keyName = "syncEnabled",
        name = "Enable Sync",
        description = "Send completed trades to the web app automatically",
        section = webSyncSection,
        position = 2
    )
    default boolean syncEnabled()
    {
        return true;
    }

    // -----------------------------------------------------------------------
    // Display Settings
    // -----------------------------------------------------------------------

    @ConfigItem(
        keyName = "showPanel",
        name = "Show Panel",
        description = "Show the Flip Tracker sidebar panel",
        section = displaySection,
        position = 0
    )
    default boolean showPanel()
    {
        return true;
    }

    @ConfigItem(
        keyName = "showHourlyProfit",
        name = "Show Hourly Profit",
        description = "Display estimated hourly profit rate in the panel",
        section = displaySection,
        position = 1
    )
    default boolean showHourlyProfit()
    {
        return true;
    }
}
```

---

### 6.2 FlipData.java

This is your data model — the equivalent of a TypeScript interface/type that also carries behaviour.

```java
package com.osrsfliptracker;

import lombok.Data;
import lombok.Builder;

// @Data is a Lombok annotation that auto-generates:
//   - getters for all fields (getItemId(), getBuyPrice(), etc.)
//   - setters for non-final fields
//   - equals(), hashCode(), toString()
// Lombok processes annotations at compile time — it's like a code generator.
// In JS terms: it automatically writes all the boilerplate you hate writing.

// @Builder gives you a fluent builder pattern:
//   FlipData flip = FlipData.builder().itemId(554).buyPrice(5).build();
@Data
@Builder
public class FlipData
{
    // Item identification
    private int itemId;
    private String itemName;

    // Pricing (in GP)
    private long buyPrice;       // Price paid per item (actual fill price)
    private long sellPrice;      // Price received per item (actual fill price)
    private int quantity;        // Number of items in this flip

    // Calculated values (populated by FlipCalculator)
    private long totalBuyCost;   // buyPrice * quantity
    private long totalSellRevenue; // sellPrice * quantity
    private long taxPaid;        // GE tax on the sell (2% of sell value, capped at 5M)
    private long profit;         // totalSellRevenue - totalBuyCost - taxPaid

    // Session metadata
    private long buyTimestamp;   // Unix epoch milliseconds when buy completed
    private long sellTimestamp;  // Unix epoch milliseconds when sell completed
    private int buySlot;         // GE slot index (0–7) used for buying
    private int sellSlot;        // GE slot index (0–7) used for selling

    // Status tracking
    private FlipStatus status;

    // -----------------------------------------------------------------------
    // Flip status enum — lives inside the FlipData class for encapsulation.
    // An enum in Java is like a TypeScript union type with enforced values:
    //   type FlipStatus = 'PENDING_SELL' | 'COMPLETE' | 'PARTIAL';
    // -----------------------------------------------------------------------
    public enum FlipStatus
    {
        PENDING_SELL,   // Item bought, waiting for sell to complete
        COMPLETE,       // Both buy and sell filled — profit calculated
        PARTIAL,        // Partially filled (sell cancelled mid-way)
        CANCELLED       // Sell was cancelled before any fill
    }

    /**
     * Returns a short human-readable description of the profit.
     * Positive = green, negative = red in the panel.
     *
     * In JS you'd write: profit > 0 ? `+${profit}gp` : `${profit}gp`
     */
    public String getProfitFormatted()
    {
        if (profit >= 0)
        {
            return "+" + formatGp(profit);
        }
        return formatGp(profit);
    }

    /**
     * Formats GP values with k/m suffix like the game does.
     * 1500 → "1.5k", 2500000 → "2.5m"
     */
    public static String formatGp(long gp)
    {
        long abs = Math.abs(gp);
        String sign = gp < 0 ? "-" : "";

        if (abs >= 1_000_000)
        {
            // Use one decimal place for millions
            double m = abs / 1_000_000.0;
            return sign + String.format("%.1fm", m);
        }
        else if (abs >= 1_000)
        {
            double k = abs / 1_000.0;
            return sign + String.format("%.1fk", k);
        }
        return sign + abs + "gp";
    }

    /**
     * Calculates return on investment as a percentage string.
     * ROI = (profit / totalBuyCost) * 100
     */
    public String getRoiFormatted()
    {
        if (totalBuyCost <= 0) return "0.0%";
        double roi = (double) profit / totalBuyCost * 100.0;
        return String.format("%.1f%%", roi);
    }
}
```

---

### 6.3 GEOfferTracker.java

This class implements a state machine for tracking GE offers. It stores active buy offers and matches them to sell completions to form complete flip records.

```java
package com.osrsfliptracker;

import lombok.extern.slf4j.Slf4j;
import net.runelite.api.GrandExchangeOffer;
import net.runelite.api.GrandExchangeOfferState;

import javax.inject.Inject;
import javax.inject.Singleton;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Tracks GE offer state across slots and matches buy/sell pairs.
 *
 * Why a state machine?
 * The GrandExchangeOfferChanged event fires multiple times per offer:
 *  - Once when placed (BUYING / SELLING)
 *  - Once for each partial fill (BUYING / SELLING with higher quantitySold)
 *  - Once when fully filled (BOUGHT / SOLD)
 *  - Once when cancelled (CANCELLED_BUY / CANCELLED_SELL)
 *
 * We only want to record a flip when BOTH the buy AND the sell are complete.
 * This class holds the in-progress buy offers so we can match them later.
 */
@Slf4j        // Lombok: adds 'log' field — use log.debug(), log.warn(), log.error()
@Singleton    // Guice: create one instance and reuse it everywhere
public class GEOfferTracker
{
    // Stores the last known buy offer per slot.
    // Key: slot index (0-7), Value: snapshot of the offer when it was bought
    // Think of this as Map<number, BuyOffer> in TypeScript
    private final Map<Integer, ActiveBuy> activeBuys = new HashMap<>();

    // Injected by Guice — we need this to look up item names
    @Inject
    private net.runelite.client.game.ItemManager itemManager;

    /**
     * Inner class representing a pending buy that hasn't been matched to a sell yet.
     * We need to capture this because once the sell slot fires SOLD, we need the
     * original buy price — and by then, the GE slot may show different data.
     *
     * In JS: this would be an object literal or simple class
     */
    private static class ActiveBuy
    {
        final int itemId;
        final String itemName;
        final long pricePerItem;    // Actual fill price (what the GE gave us)
        final int quantityFilled;   // How many we actually received
        final long totalSpent;      // Total GP we spent (including any overbid)
        final int slot;
        final long timestamp;

        ActiveBuy(int itemId, String itemName, long pricePerItem,
                  int quantityFilled, long totalSpent, int slot)
        {
            this.itemId = itemId;
            this.itemName = itemName;
            this.pricePerItem = pricePerItem;
            this.quantityFilled = quantityFilled;
            this.totalSpent = totalSpent;
            this.slot = slot;
            this.timestamp = Instant.now().toEpochMilli();
        }
    }

    /**
     * Processes an offer event. Returns a completed FlipData if a sell completed
     * and we have a matching buy on record, otherwise returns null.
     *
     * Called from FlipTrackerPlugin.onGrandExchangeOfferChanged()
     *
     * @param slot  GE slot index (0–7)
     * @param offer The current state of the offer in that slot
     * @return Completed flip data, or null if the flip isn't done yet
     */
    public FlipData processOffer(int slot, GrandExchangeOffer offer)
    {
        GrandExchangeOfferState state = offer.getState();

        // -----------------------------------------------------------------------
        // Handle BOUGHT: a buy offer just fully completed.
        // Store it in activeBuys so we can match it when a sell completes.
        // -----------------------------------------------------------------------
        if (state == GrandExchangeOfferState.BOUGHT)
        {
            int itemId = offer.getItemId();
            // ItemManager must be called on the client thread (we're already on it
            // since event handlers run on the client thread)
            String itemName = itemManager.getItemComposition(itemId).getName();
            if (itemName == null)
            {
                itemName = "Unknown (#" + itemId + ")";
            }

            // Calculate the actual price paid per item.
            // offer.getPrice() is the offer price (what you listed).
            // offer.getSpent() / offer.getQuantitySold() is the actual fill price.
            // These differ because the GE gives you the better price when
            // someone else listed at a lower/higher price.
            long actualPricePerItem = offer.getSpent() / Math.max(1, offer.getQuantitySold());

            log.debug("Buy completed: {} x{} at {}gp/ea (slot {})",
                itemName, offer.getQuantitySold(), actualPricePerItem, slot);

            activeBuys.put(itemId, new ActiveBuy(
                itemId,
                itemName,
                actualPricePerItem,
                offer.getQuantitySold(),
                offer.getSpent(),
                slot
            ));

            return null;  // No flip complete yet — waiting for the sell
        }

        // -----------------------------------------------------------------------
        // Handle SOLD: a sell offer just fully completed.
        // Try to match it with a stored buy offer for the same item.
        // -----------------------------------------------------------------------
        if (state == GrandExchangeOfferState.SOLD)
        {
            int itemId = offer.getItemId();
            ActiveBuy buy = activeBuys.remove(itemId);  // Remove and get

            if (buy == null)
            {
                // No matching buy found — this sell isn't part of a tracked flip.
                // Could happen if the user placed the buy before the plugin was enabled,
                // or if they're selling something they didn't buy through GE.
                log.debug("Sell completed for itemId {} but no matching buy found", itemId);
                return null;
            }

            // Calculate actual sell price per item
            long actualSellPerItem = offer.getSpent() / Math.max(1, offer.getQuantitySold());

            log.debug("Sell completed: {} x{} at {}gp/ea (slot {}) — matched buy at {}gp/ea",
                buy.itemName, offer.getQuantitySold(), actualSellPerItem, slot, buy.pricePerItem);

            // Use the smaller quantity (in case buy/sell quantities differ)
            int quantity = Math.min(buy.quantityFilled, offer.getQuantitySold());

            // Build a preliminary FlipData object.
            // FlipCalculator will fill in taxPaid, profit, etc.
            return FlipData.builder()
                .itemId(itemId)
                .itemName(buy.itemName)
                .buyPrice(buy.pricePerItem)
                .sellPrice(actualSellPerItem)
                .quantity(quantity)
                .totalBuyCost(buy.totalSpent)
                .totalSellRevenue(offer.getSpent())
                .buyTimestamp(buy.timestamp)
                .sellTimestamp(Instant.now().toEpochMilli())
                .buySlot(buy.slot)
                .sellSlot(slot)
                .status(FlipData.FlipStatus.COMPLETE)
                .build();
        }

        // -----------------------------------------------------------------------
        // Handle CANCELLED_BUY: buyer cancelled before full fill.
        // Remove the partial buy if we stored it. We can't track a flip
        // without a complete buy.
        // -----------------------------------------------------------------------
        if (state == GrandExchangeOfferState.CANCELLED_BUY)
        {
            activeBuys.remove(offer.getItemId());
            log.debug("Buy cancelled for itemId {} (slot {})", offer.getItemId(), slot);
        }

        // For BUYING, SELLING, CANCELLED_SELL, EMPTY — no action needed
        return null;
    }

    /**
     * Clears all tracked offers. Call this on session reset or logout.
     */
    public void reset()
    {
        activeBuys.clear();
        log.debug("GEOfferTracker reset");
    }

    /**
     * Returns the number of pending (unmatched) buy offers being tracked.
     * Useful for debugging.
     */
    public int getPendingBuyCount()
    {
        return activeBuys.size();
    }
}
```

---

### 6.4 FlipCalculator.java

Handles all the profit math, including the OSRS GE tax.

```java
package com.osrsfliptracker;

import javax.inject.Singleton;

/**
 * Calculates flip profit, tax, and session statistics.
 *
 * OSRS GE Tax Rules (as of 2025):
 *  - Rate: 2% of total sell value
 *  - Applied to: sell side only (not the buy)
 *  - Rounding: always rounds DOWN (Math.floor)
 *  - Maximum tax: 5,000,000 gp (cap — no matter how expensive the item)
 *  - Exempt: items with sell price under 50gp per item
 *
 * Example:
 *  Sell 10 Twisted Bows at 1,400,000,000gp total:
 *  2% of 1,400,000,000 = 28,000,000 → but capped at 5,000,000gp
 */
@Singleton
public class FlipCalculator
{
    // Tax constants — defined as named constants for clarity and easy updating
    private static final double TAX_RATE = 0.02;              // 2%
    private static final long TAX_CAP = 5_000_000L;           // 5 million gp max
    private static final long TAX_EXEMPT_THRESHOLD = 50L;     // Items ≤50gp are tax-free

    /**
     * Calculates and fills in the tax and profit fields of a FlipData object.
     * Takes the raw buy/sell data from GEOfferTracker and enriches it.
     *
     * @param flip A FlipData with buyPrice, sellPrice, quantity, and total costs set
     * @return The same FlipData object with taxPaid and profit calculated
     */
    public FlipData calculate(FlipData flip)
    {
        long totalBuy = flip.getTotalBuyCost();
        long totalSell = flip.getTotalSellRevenue();

        long tax = calculateTax(flip.getSellPrice(), flip.getQuantity());
        long profit = totalSell - totalBuy - tax;

        // @Data (Lombok) generates setters — use them to update the object
        flip.setTaxPaid(tax);
        flip.setProfit(profit);

        return flip;
    }

    /**
     * Calculates GE tax for a given sell price and quantity.
     *
     * In TypeScript:
     *   const tax = (sellPrice: number, qty: number): number => {
     *     if (sellPrice <= 50) return 0;
     *     const raw = Math.floor(sellPrice * qty * 0.02);
     *     return Math.min(raw, 5_000_000);
     *   };
     *
     * @param pricePerItem  Actual sell price per item in GP
     * @param quantity      Number of items sold
     * @return Tax amount in GP
     */
    public long calculateTax(long pricePerItem, int quantity)
    {
        // Items ≤ 50gp are completely tax-exempt
        if (pricePerItem <= TAX_EXEMPT_THRESHOLD)
        {
            return 0L;
        }

        long totalSell = pricePerItem * quantity;

        // Math.floor is implicit when using integer division in Java:
        // (long)(totalSell * 0.02) truncates towards zero for positive numbers
        long rawTax = (long) (totalSell * TAX_RATE);

        // Apply the cap
        return Math.min(rawTax, TAX_CAP);
    }

    /**
     * Calculates the total profit from a list of completed flips.
     */
    public long calculateTotalProfit(java.util.List<FlipData> flips)
    {
        // Java stream equivalent of JS reduce
        return flips.stream()
            .mapToLong(FlipData::getProfit)
            .sum();
    }

    /**
     * Calculates overall ROI across all flips.
     * ROI = total profit / total investment * 100
     */
    public double calculateTotalRoi(java.util.List<FlipData> flips)
    {
        long totalInvestment = flips.stream()
            .mapToLong(FlipData::getTotalBuyCost)
            .sum();

        if (totalInvestment <= 0) return 0.0;

        long totalProfit = calculateTotalProfit(flips);
        return (double) totalProfit / totalInvestment * 100.0;
    }

    /**
     * Calculates hourly profit rate based on session duration.
     *
     * @param totalProfit     Session profit in GP
     * @param sessionStartMs  Session start time in Unix millis
     * @return Projected hourly profit in GP
     */
    public long calculateHourlyProfit(long totalProfit, long sessionStartMs)
    {
        long now = System.currentTimeMillis();
        long elapsedMs = now - sessionStartMs;

        if (elapsedMs < 60_000L)
        {
            // Less than 1 minute elapsed — hourly rate is meaningless
            return 0L;
        }

        // elapsedMs / 3_600_000.0 gives elapsed hours as a decimal
        double hoursElapsed = elapsedMs / 3_600_000.0;
        return (long) (totalProfit / hoursElapsed);
    }
}
```

---

### 6.5 WebSyncService.java

Sends trade data to your web application via HTTP POST. Uses Java's built-in `HttpURLConnection` — no third-party HTTP library needed for Plugin Hub compatibility.

```java
package com.osrsfliptracker;

import com.google.gson.Gson;
import lombok.extern.slf4j.Slf4j;
import net.runelite.api.Client;

import javax.inject.Inject;
import javax.inject.Singleton;
import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Handles HTTP communication with the OSRS Flip Tracker web application.
 *
 * All HTTP calls are made on a background thread — never on the client thread
 * or the Swing EDT — because network calls can block for seconds.
 * In JS terms: these are async operations, similar to fetch().
 */
@Slf4j
@Singleton
public class WebSyncService
{
    @Inject
    private FlipTrackerConfig config;

    @Inject
    private Client client;  // Used to get the player's RSN

    @Inject
    private Gson gson;      // JSON serialiser — RuneLite provides this via DI

    // Single-threaded executor: queues HTTP calls and runs them one at a time
    // in the background. In JS: think of it as a serial async queue.
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    /**
     * Sends a completed flip to the web app asynchronously.
     * This method returns immediately; the HTTP call happens in the background.
     *
     * @param flip The completed flip to sync
     */
    public void syncFlip(FlipData flip)
    {
        if (!config.syncEnabled())
        {
            log.debug("Sync disabled — skipping flip for {}", flip.getItemName());
            return;
        }

        if (config.apiKey().isEmpty())
        {
            log.warn("API key not set — cannot sync flip. Configure it in the plugin settings.");
            return;
        }

        // Submit the HTTP call to run on the background thread
        // () -> { ... } is a lambda — like an arrow function in JS
        executor.submit(() -> {
            try
            {
                sendFlipToApi(flip);
            }
            catch (Exception e)
            {
                // Log but don't crash — sync failing shouldn't affect gameplay
                log.error("Failed to sync flip for {}: {}", flip.getItemName(), e.getMessage());
            }
        });
    }

    /**
     * The actual HTTP POST logic. Runs on the background executor thread.
     * In JS terms: this is the body of a fetch() call.
     */
    private void sendFlipToApi(FlipData flip) throws IOException
    {
        // Build the API endpoint URL
        String apiUrl = config.apiUrl();
        if (!apiUrl.endsWith("/"))
        {
            apiUrl = apiUrl + "/";
        }
        URL url = new URL(apiUrl + "api/trades");

        // Build the JSON payload
        TradePayload payload = buildPayload(flip);
        String json = gson.toJson(payload);
        byte[] jsonBytes = json.getBytes(StandardCharsets.UTF_8);

        log.debug("Sending flip to {}: {}", url, json);

        // Open connection
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        try
        {
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + config.apiKey());
            conn.setRequestProperty("Content-Length", String.valueOf(jsonBytes.length));
            conn.setConnectTimeout(5000);   // 5 second connection timeout
            conn.setReadTimeout(10000);     // 10 second read timeout
            conn.setDoOutput(true);         // Allow sending a request body

            // Write JSON body
            try (OutputStream os = conn.getOutputStream())
            {
                os.write(jsonBytes);
                os.flush();
            }

            int responseCode = conn.getResponseCode();

            if (responseCode == 200 || responseCode == 201)
            {
                log.debug("Flip synced successfully: {} ({})", flip.getItemName(), responseCode);
            }
            else if (responseCode == 401)
            {
                log.warn("Sync failed: unauthorised (401). Check your API key in plugin settings.");
            }
            else
            {
                log.warn("Sync failed: server returned HTTP {}", responseCode);
            }
        }
        finally
        {
            conn.disconnect();  // Always release the connection
        }
    }

    /**
     * Builds the JSON payload object that gets serialised and sent to the API.
     * Keep this in sync with your Next.js API route's expected body shape.
     */
    private TradePayload buildPayload(FlipData flip)
    {
        // Try to get the player's RSN; fall back gracefully if not available
        String playerName = "unknown";
        if (client.getLocalPlayer() != null)
        {
            playerName = client.getLocalPlayer().getName();
        }

        TradePayload payload = new TradePayload();
        payload.playerName = playerName;
        payload.itemId = flip.getItemId();
        payload.itemName = flip.getItemName();
        payload.buyPrice = flip.getBuyPrice();
        payload.sellPrice = flip.getSellPrice();
        payload.quantity = flip.getQuantity();
        payload.totalBuyCost = flip.getTotalBuyCost();
        payload.totalSellRevenue = flip.getTotalSellRevenue();
        payload.taxPaid = flip.getTaxPaid();
        payload.profit = flip.getProfit();
        payload.buyTimestamp = flip.getBuyTimestamp();
        payload.sellTimestamp = flip.getSellTimestamp();
        payload.buySlot = flip.getBuySlot();
        payload.sellSlot = flip.getSellSlot();
        payload.syncedAt = Instant.now().toEpochMilli();

        return payload;
    }

    /**
     * Shuts down the executor cleanly when the plugin is disabled.
     * Without this, the background thread would keep running after shutDown().
     */
    public void shutdown()
    {
        executor.shutdown();
    }

    // -----------------------------------------------------------------------
    // Inner class for the JSON payload.
    // Gson will serialise this into JSON using the field names as keys.
    // Note: field names are camelCase here — they map to your API's expected keys.
    //
    // In TypeScript this would be:
    //   interface TradePayload { playerName: string; itemId: number; ... }
    // -----------------------------------------------------------------------
    private static class TradePayload
    {
        String playerName;
        int itemId;
        String itemName;
        long buyPrice;
        long sellPrice;
        int quantity;
        long totalBuyCost;
        long totalSellRevenue;
        long taxPaid;
        long profit;
        long buyTimestamp;
        long sellTimestamp;
        int buySlot;
        int sellSlot;
        long syncedAt;
    }
}
```

---

### 6.6 FlipTrackerPanel.java

The sidebar UI. All UI code in RuneLite is Java Swing. The key rule: **only modify Swing components from the EDT (Event Dispatch Thread)** — always wrap UI updates in `SwingUtilities.invokeLater()`.

```java
package com.osrsfliptracker;

import lombok.extern.slf4j.Slf4j;
import net.runelite.client.ui.ColorScheme;
import net.runelite.client.ui.FontManager;
import net.runelite.client.ui.PluginPanel;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;
import java.util.ArrayList;
import java.util.List;

/**
 * The sidebar panel displayed when the user clicks the Flip Tracker nav button.
 *
 * Extends PluginPanel — RuneLite's base class for sidebar panels.
 *
 * Swing primer for JS devs:
 *   JPanel  = <div>
 *   JLabel  = <span> or <p>
 *   JButton = <button>
 *   BoxLayout (Y_AXIS) = CSS flexbox with flex-direction: column
 *   BorderLayout = CSS grid with named areas (NORTH, CENTER, SOUTH, EAST, WEST)
 *   GridLayout(2, 3) = CSS grid with 2 rows, 3 columns
 */
@Slf4j
@Singleton
public class FlipTrackerPanel extends PluginPanel
{
    // -----------------------------------------------------------------------
    // RuneLite's ColorScheme provides the standard dark theme colours.
    // Using these keeps your panel consistent with other RuneLite panels.
    // -----------------------------------------------------------------------
    private static final Color COLOR_PROFIT_POSITIVE = new Color(0x2ECC40);  // Green
    private static final Color COLOR_PROFIT_NEGATIVE = new Color(0xFF4136);  // Red
    private static final Color COLOR_GOLD = new Color(0xFFD700);             // Gold
    private static final Color COLOR_LABEL = new Color(0xAAAAAA);            // Muted text

    // -----------------------------------------------------------------------
    // Label references — we store these so we can update them later when
    // new flip data arrives. Like keeping a ref to a DOM element.
    // -----------------------------------------------------------------------
    private JLabel totalProfitLabel;
    private JLabel roiLabel;
    private JLabel flipsCountLabel;
    private JLabel taxPaidLabel;
    private JLabel sessionTimeLabel;
    private JLabel hourlyProfitLabel;
    private JPanel flipsListPanel;

    // Session state cached for display
    private long sessionStartMs = System.currentTimeMillis();
    private final List<FlipData> completedFlips = new ArrayList<>();

    @Inject
    private FlipTrackerConfig config;

    // -----------------------------------------------------------------------
    // Constructor — called by Guice when the panel is first instantiated.
    // Build the entire UI here.
    // -----------------------------------------------------------------------
    public FlipTrackerPanel()
    {
        super();

        // PluginPanel uses BorderLayout by default.
        // We set the overall layout of this panel.
        setLayout(new BorderLayout(0, 5));
        setBorder(new EmptyBorder(10, 10, 10, 10));
        setBackground(ColorScheme.DARK_GRAY_COLOR);

        // Build each section
        add(buildHeaderPanel(), BorderLayout.NORTH);
        add(buildStatsPanel(), BorderLayout.CENTER);
        // The flip list goes in a scrollable area in CENTER — but we use a
        // wrapper to stack stats + list vertically
        JPanel content = new JPanel();
        content.setLayout(new BoxLayout(content, BoxLayout.Y_AXIS));
        content.setBackground(ColorScheme.DARK_GRAY_COLOR);
        content.add(buildStatsPanel());
        content.add(Box.createVerticalStrut(8));  // 8px gap
        content.add(buildFlipsListSection());

        add(content, BorderLayout.CENTER);
    }

    // -----------------------------------------------------------------------
    // Header
    // -----------------------------------------------------------------------

    private JPanel buildHeaderPanel()
    {
        JPanel header = new JPanel(new BorderLayout());
        header.setBackground(ColorScheme.DARKER_GRAY_COLOR);
        header.setBorder(new EmptyBorder(6, 8, 6, 8));

        JLabel title = new JLabel("FLIP TRACKER");
        title.setFont(FontManager.getRunescapeBoldFont());
        title.setForeground(COLOR_GOLD);

        JButton resetButton = new JButton("Reset");
        resetButton.setFont(FontManager.getRunescapeSmallFont());
        resetButton.setForeground(Color.WHITE);
        resetButton.setBackground(ColorScheme.MEDIUM_GRAY_COLOR);
        resetButton.setBorderPainted(false);
        resetButton.setFocusPainted(false);
        resetButton.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        resetButton.addActionListener(e -> resetSession());

        header.add(title, BorderLayout.WEST);
        header.add(resetButton, BorderLayout.EAST);

        return header;
    }

    // -----------------------------------------------------------------------
    // Stats Grid — Total Profit, ROI, Flips, Tax, Time, Hourly
    // -----------------------------------------------------------------------

    private JPanel buildStatsPanel()
    {
        JPanel wrapper = new JPanel();
        wrapper.setLayout(new BoxLayout(wrapper, BoxLayout.Y_AXIS));
        wrapper.setBackground(ColorScheme.DARKER_GRAY_COLOR);
        wrapper.setBorder(new EmptyBorder(8, 8, 8, 8));

        // 3 columns, 4 rows for 6 stats (+ labels)
        JPanel grid = new JPanel(new GridLayout(4, 3, 6, 2));
        grid.setBackground(ColorScheme.DARKER_GRAY_COLOR);

        // Row 1 labels
        grid.add(makeStatLabel("Total Profit"));
        grid.add(makeStatLabel("ROI"));
        grid.add(makeStatLabel("Flips"));

        // Row 2 values
        totalProfitLabel = makeValueLabel("0gp", COLOR_LABEL);
        roiLabel = makeValueLabel("0.0%", COLOR_LABEL);
        flipsCountLabel = makeValueLabel("0", COLOR_LABEL);
        grid.add(totalProfitLabel);
        grid.add(roiLabel);
        grid.add(flipsCountLabel);

        // Row 3 labels
        grid.add(makeStatLabel("Tax Paid"));
        grid.add(makeStatLabel("Session"));
        grid.add(makeStatLabel("Per Hour"));

        // Row 4 values
        taxPaidLabel = makeValueLabel("0gp", COLOR_LABEL);
        sessionTimeLabel = makeValueLabel("0:00", COLOR_LABEL);
        hourlyProfitLabel = makeValueLabel("—", COLOR_LABEL);
        grid.add(taxPaidLabel);
        grid.add(sessionTimeLabel);
        grid.add(hourlyProfitLabel);

        wrapper.add(grid);
        return wrapper;
    }

    private JLabel makeStatLabel(String text)
    {
        JLabel label = new JLabel(text);
        label.setFont(FontManager.getRunescapeSmallFont());
        label.setForeground(COLOR_LABEL);
        return label;
    }

    private JLabel makeValueLabel(String text, Color color)
    {
        JLabel label = new JLabel(text);
        label.setFont(FontManager.getRunescapeSmallFont());
        label.setForeground(color);
        return label;
    }

    // -----------------------------------------------------------------------
    // Per-item Flips List
    // -----------------------------------------------------------------------

    private JPanel buildFlipsListSection()
    {
        JPanel section = new JPanel(new BorderLayout(0, 4));
        section.setBackground(ColorScheme.DARK_GRAY_COLOR);

        JLabel header = new JLabel("Recent Flips");
        header.setFont(FontManager.getRunescapeSmallFont());
        header.setForeground(COLOR_GOLD);
        header.setBorder(new EmptyBorder(0, 0, 4, 0));

        flipsListPanel = new JPanel();
        flipsListPanel.setLayout(new BoxLayout(flipsListPanel, BoxLayout.Y_AXIS));
        flipsListPanel.setBackground(ColorScheme.DARK_GRAY_COLOR);

        section.add(header, BorderLayout.NORTH);
        section.add(flipsListPanel, BorderLayout.CENTER);
        return section;
    }

    /**
     * Creates one row in the flips list for a completed flip.
     * Shows: item name | profit | ROI
     */
    private JPanel buildFlipRow(FlipData flip)
    {
        JPanel row = new JPanel(new BorderLayout(4, 0));
        row.setBackground(ColorScheme.DARKER_GRAY_COLOR);
        row.setBorder(new EmptyBorder(4, 6, 4, 6));
        row.setMaximumSize(new Dimension(Integer.MAX_VALUE, 28));

        JLabel nameLabel = new JLabel(flip.getItemName());
        nameLabel.setFont(FontManager.getRunescapeSmallFont());
        nameLabel.setForeground(Color.WHITE);

        // Right side: profit + ROI
        JPanel rightPanel = new JPanel(new GridLayout(1, 2, 4, 0));
        rightPanel.setOpaque(false);

        Color profitColor = flip.getProfit() >= 0 ? COLOR_PROFIT_POSITIVE : COLOR_PROFIT_NEGATIVE;
        JLabel profitLabel = new JLabel(flip.getProfitFormatted(), SwingConstants.RIGHT);
        profitLabel.setFont(FontManager.getRunescapeSmallFont());
        profitLabel.setForeground(profitColor);

        JLabel roiLabel = new JLabel(flip.getRoiFormatted(), SwingConstants.RIGHT);
        roiLabel.setFont(FontManager.getRunescapeSmallFont());
        roiLabel.setForeground(COLOR_LABEL);

        rightPanel.add(profitLabel);
        rightPanel.add(roiLabel);

        row.add(nameLabel, BorderLayout.WEST);
        row.add(rightPanel, BorderLayout.EAST);

        return row;
    }

    // -----------------------------------------------------------------------
    // Public update methods — called from the plugin on the client thread,
    // but all Swing updates are wrapped in SwingUtilities.invokeLater()
    // -----------------------------------------------------------------------

    /**
     * Called when a new flip is completed. Adds it to the list and refreshes stats.
     *
     * ALWAYS call this from the client thread; it internally switches to EDT.
     */
    public void addFlip(FlipData flip)
    {
        completedFlips.add(0, flip);  // Add to front (newest first)
        // Limit display to last 50 flips
        if (completedFlips.size() > 50)
        {
            completedFlips.remove(completedFlips.size() - 1);
        }
        refreshPanel();
    }

    /**
     * Updates all labels and the flip list. Must be called from the EDT.
     * Use SwingUtilities.invokeLater(() -> panel.refreshPanel()) from other threads.
     */
    public void refreshPanel()
    {
        // This ensures we're on the EDT even if called from another thread
        SwingUtilities.invokeLater(() -> {
            // Calculate aggregated stats
            long totalProfit = completedFlips.stream()
                .mapToLong(FlipData::getProfit).sum();

            long totalInvestment = completedFlips.stream()
                .mapToLong(FlipData::getTotalBuyCost).sum();

            long totalTax = completedFlips.stream()
                .mapToLong(FlipData::getTaxPaid).sum();

            double roi = totalInvestment > 0
                ? (double) totalProfit / totalInvestment * 100.0 : 0.0;

            long elapsedMs = System.currentTimeMillis() - sessionStartMs;
            double hoursElapsed = elapsedMs / 3_600_000.0;
            long hourlyProfit = hoursElapsed > 0 ? (long)(totalProfit / hoursElapsed) : 0L;

            // Update labels
            Color profitColor = totalProfit >= 0 ? COLOR_PROFIT_POSITIVE : COLOR_PROFIT_NEGATIVE;
            totalProfitLabel.setText(FlipData.formatGp(totalProfit));
            totalProfitLabel.setForeground(profitColor);

            roiLabel.setText(String.format("%.1f%%", roi));
            roiLabel.setForeground(roi >= 0 ? COLOR_PROFIT_POSITIVE : COLOR_PROFIT_NEGATIVE);

            flipsCountLabel.setText(String.valueOf(completedFlips.size()));
            flipsCountLabel.setForeground(Color.WHITE);

            taxPaidLabel.setText(FlipData.formatGp(totalTax));
            taxPaidLabel.setForeground(COLOR_LABEL);

            sessionTimeLabel.setText(formatDuration(elapsedMs));
            sessionTimeLabel.setForeground(COLOR_LABEL);

            if (completedFlips.size() >= 1 && hoursElapsed > 1.0 / 60)
            {
                hourlyProfitLabel.setText(FlipData.formatGp(hourlyProfit) + "/hr");
                hourlyProfitLabel.setForeground(hourlyProfit >= 0 ? COLOR_PROFIT_POSITIVE : COLOR_PROFIT_NEGATIVE);
            }
            else
            {
                hourlyProfitLabel.setText("—");
                hourlyProfitLabel.setForeground(COLOR_LABEL);
            }

            // Rebuild the flips list
            flipsListPanel.removeAll();
            for (FlipData flip : completedFlips)
            {
                flipsListPanel.add(buildFlipRow(flip));
                flipsListPanel.add(Box.createVerticalStrut(2));
            }

            if (completedFlips.isEmpty())
            {
                JLabel empty = new JLabel("No flips yet this session");
                empty.setFont(FontManager.getRunescapeSmallFont());
                empty.setForeground(COLOR_LABEL);
                empty.setAlignmentX(CENTER_ALIGNMENT);
                flipsListPanel.add(empty);
            }

            // Tell Swing to repaint this panel
            revalidate();
            repaint();
        });
    }

    /**
     * Resets the session — clears all flips and restarts the timer.
     */
    public void resetSession()
    {
        completedFlips.clear();
        sessionStartMs = System.currentTimeMillis();
        refreshPanel();
        log.debug("Flip Tracker session reset");
    }

    /**
     * Formats milliseconds into "1:23:45" or "5:30" format.
     */
    private String formatDuration(long ms)
    {
        long seconds = ms / 1000;
        long hours = seconds / 3600;
        long minutes = (seconds % 3600) / 60;
        long secs = seconds % 60;

        if (hours > 0)
        {
            return String.format("%d:%02d:%02d", hours, minutes, secs);
        }
        return String.format("%d:%02d", minutes, secs);
    }
}
```

---

### 6.7 FlipTrackerPlugin.java

The main plugin class. This is the entry point that RuneLite loads.

```java
package com.osrsfliptracker;

import com.google.inject.Provides;
import lombok.extern.slf4j.Slf4j;
import net.runelite.api.Client;
import net.runelite.api.GameState;
import net.runelite.api.GrandExchangeOffer;
import net.runelite.api.GrandExchangeOfferState;
import net.runelite.api.events.GameStateChanged;
import net.runelite.api.events.GrandExchangeOfferChanged;
import net.runelite.client.config.ConfigManager;
import net.runelite.client.eventbus.Subscribe;
import net.runelite.client.plugins.Plugin;
import net.runelite.client.plugins.PluginDescriptor;
import net.runelite.client.ui.ClientToolbar;
import net.runelite.client.ui.NavigationButton;
import net.runelite.client.util.ImageUtil;

import javax.inject.Inject;
import javax.swing.*;
import java.awt.image.BufferedImage;

/**
 * Main plugin class for the OSRS Flip Tracker.
 *
 * This class is the entry point — RuneLite instantiates it and calls
 * startUp() when enabled. Everything else is wired through DI.
 *
 * Think of it as the root component in a React app.
 */
@Slf4j
@PluginDescriptor(
    name = "Flip Tracker",                          // Name shown in plugin list
    description = "Tracks GE flips and syncs to your Flip Tracker web app",
    tags = {"grand exchange", "flip", "profit", "merch", "trade"}
    // loadWhenOutdated = false   // Remove this if you want it to load on outdated clients
)
public class FlipTrackerPlugin extends Plugin
{
    // -----------------------------------------------------------------------
    // Injected dependencies — Guice provides all of these automatically.
    // You never call 'new' on any of these.
    // -----------------------------------------------------------------------

    @Inject
    private Client client;

    @Inject
    private ClientToolbar clientToolbar;

    @Inject
    private FlipTrackerConfig config;

    @Inject
    private GEOfferTracker offerTracker;

    @Inject
    private FlipCalculator flipCalculator;

    @Inject
    private WebSyncService webSyncService;

    @Inject
    private FlipTrackerPanel panel;

    // The navigation button in the sidebar (we need to hold a reference to
    // remove it in shutDown)
    private NavigationButton navButton;

    // -----------------------------------------------------------------------
    // Plugin Lifecycle
    // -----------------------------------------------------------------------

    @Override
    protected void startUp() throws Exception
    {
        log.info("Flip Tracker plugin started");

        // Load the sidebar icon from resources.
        // ImageUtil.loadImageResource looks in src/main/resources/com/osrsfliptracker/
        final BufferedImage icon = ImageUtil.loadImageResource(getClass(), "icon.png");

        // Build the navigation button that appears in the sidebar icon bar
        navButton = NavigationButton.builder()
            .tooltip("Flip Tracker")
            .icon(icon)
            .priority(7)        // Higher number = lower position in sidebar
            .panel(panel)       // Click this button → show this panel
            .build();

        clientToolbar.addNavigation(navButton);

        log.debug("Flip Tracker panel added to sidebar");
    }

    @Override
    protected void shutDown() throws Exception
    {
        log.info("Flip Tracker plugin stopped");

        // Remove the navigation button from the sidebar
        clientToolbar.removeNavigation(navButton);

        // Shut down the background HTTP executor in WebSyncService
        webSyncService.shutdown();

        // Clear tracked state
        offerTracker.reset();

        log.debug("Flip Tracker cleaned up");
    }

    // -----------------------------------------------------------------------
    // Event Handlers
    // These methods are called by RuneLite's event bus automatically.
    // The method must be public, annotated with @Subscribe, and accept
    // exactly one parameter matching the event type.
    // -----------------------------------------------------------------------

    /**
     * The core event handler. Called every time a GE offer changes state.
     *
     * This fires for ALL GE slots, even ones we don't care about.
     * GEOfferTracker handles the state machine logic and returns null
     * until a complete flip is detected.
     */
    @Subscribe
    public void onGrandExchangeOfferChanged(GrandExchangeOfferChanged offerEvent)
    {
        final int slot = offerEvent.getSlot();
        final GrandExchangeOffer offer = offerEvent.getOffer();

        // Guard: ignore EMPTY state events that fire on login/world hop
        // (they represent slots being "cleared" by the client, not real trades)
        if (offer.getState() == GrandExchangeOfferState.EMPTY
            && client.getGameState() != GameState.LOGGED_IN)
        {
            return;
        }

        log.debug("GE event: slot={}, state={}, item={}, qty={}/{}",
            slot,
            offer.getState(),
            offer.getItemId(),
            offer.getQuantitySold(),
            offer.getTotalQuantity());

        // Pass the event to the state machine.
        // Returns non-null only when a complete buy+sell pair is detected.
        FlipData completedFlip = offerTracker.processOffer(slot, offer);

        if (completedFlip != null)
        {
            // Calculate profit, tax etc.
            flipCalculator.calculate(completedFlip);

            log.info("Flip complete: {} x{} | profit={} | tax={}",
                completedFlip.getItemName(),
                completedFlip.getQuantity(),
                FlipData.formatGp(completedFlip.getProfit()),
                FlipData.formatGp(completedFlip.getTaxPaid()));

            // Update the panel (must happen on the EDT)
            SwingUtilities.invokeLater(() -> panel.addFlip(completedFlip));

            // Send to web app (happens on background thread inside WebSyncService)
            webSyncService.syncFlip(completedFlip);
        }
    }

    /**
     * Handles login/logout/world hop events.
     * Reset the GE tracker on logout to avoid carrying stale state
     * across sessions.
     */
    @Subscribe
    public void onGameStateChanged(GameStateChanged event)
    {
        switch (event.getGameState())
        {
            case LOGGING_IN:
            case HOPPING:
                // Clear stale GE offer tracking when changing sessions
                offerTracker.reset();
                log.debug("GE tracker reset due to state: {}", event.getGameState());
                break;

            case LOGGED_IN:
                // Player just logged in — could refresh panel here if needed
                log.debug("Player logged in — Flip Tracker ready");
                break;

            default:
                break;
        }
    }

    // -----------------------------------------------------------------------
    // Config Provider
    // This is REQUIRED boilerplate. It tells Guice how to create the config.
    // -----------------------------------------------------------------------

    /**
     * Provides the config instance to the DI container.
     * Guice calls this once and caches the result.
     */
    @Provides
    FlipTrackerConfig provideConfig(ConfigManager configManager)
    {
        return configManager.getConfig(FlipTrackerConfig.class);
    }
}
```

---

### 6.8 FlipTrackerPluginTest.java

The test runner that lets you launch the plugin in developer mode directly from IntelliJ.

```java
package com.osrsfliptracker;

import net.runelite.client.RuneLite;
import net.runelite.client.externalplugins.ExternalPluginManager;

/**
 * Launches RuneLite with your plugin pre-loaded for testing.
 * This is the main class for your run configuration in IntelliJ.
 *
 * Run this class (Shift+F10) and RuneLite will open with Flip Tracker enabled.
 * Set your IntelliJ run config's main class to this.
 */
public class FlipTrackerPluginTest
{
    public static void main(String[] args) throws Exception
    {
        // Tell ExternalPluginManager to load your plugin class on startup
        ExternalPluginManager.loadBuiltin(FlipTrackerPlugin.class);

        // Launch RuneLite
        RuneLite.main(args);
    }
}
```

---

## 7. GE Offer Event Deep Dive

### How Events Fire

The `GrandExchangeOfferChanged` event fires in these situations:

| Situation | State | Notes |
|---|---|---|
| New buy order placed | `BUYING` | `quantitySold = 0` |
| Buy partially filled | `BUYING` | `quantitySold > 0` but `< totalQuantity` |
| Buy fully filled | `BOUGHT` | `quantitySold == totalQuantity` |
| New sell order placed | `SELLING` | `quantitySold = 0` |
| Sell partially filled | `SELLING` | `quantitySold > 0` |
| Sell fully filled | `SOLD` | `quantitySold == totalQuantity` |
| Buy cancelled | `CANCELLED_BUY` | May have partial fill |
| Sell cancelled | `CANCELLED_SELL` | May have partial fill |
| Slot cleared on login | `EMPTY` | Fires for all slots on login — **ignore these** |

### The Login Burst Problem

When a player logs in, RuneLite fires `GrandExchangeOfferChanged` with `EMPTY` for all 8 slots. Then it fires the actual current offer states. If you process the `EMPTY` events, you'll clear your tracked offers.

**Solution:** Check if the game state is `LOGGED_IN` before processing `EMPTY` events:

```java
if (offer.getState() == GrandExchangeOfferState.EMPTY
    && client.getGameState() != GameState.LOGGED_IN)
{
    return;  // This is a login-clearing event, ignore it
}
```

### Reading the Offer Object

```java
@Subscribe
public void onGrandExchangeOfferChanged(GrandExchangeOfferChanged event)
{
    // Which GE slot (0–7). OSRS has 8 GE slots.
    int slot = event.getSlot();

    GrandExchangeOffer offer = event.getOffer();

    // The current state of this offer
    GrandExchangeOfferState state = offer.getState();
    // Values: EMPTY, BUYING, BOUGHT, SELLING, SOLD, CANCELLED_BUY, CANCELLED_SELL

    // The item being traded
    int itemId = offer.getItemId();

    // How many units have been filled so far
    int quantitySold = offer.getQuantitySold();

    // Total quantity in the order
    int totalQuantity = offer.getTotalQuantity();

    // The price YOU listed the order at (your offer price)
    int offerPrice = offer.getPrice();

    // Total GP that has been spent/received so far on this offer.
    // For buys: total GP paid out. For sells: total GP received.
    // NOTE: This is the ACTUAL amount, not offer price * quantity.
    //       The GE may give you a better deal than you listed.
    int totalSpent = offer.getSpent();

    // Derive the actual price per item:
    // For a complete buy: totalSpent / quantitySold = actual cost per item
    long actualPricePerItem = (long) offer.getSpent() / Math.max(1, offer.getQuantitySold());
}
```

### Price vs. Spent — The Key Distinction

When you place a buy offer at 100gp/ea for 1000 items, and someone is selling at 95gp/ea, the GE matches you at **95gp/ea** — the lower price. So:

- `offer.getPrice()` = 100 (your offer)
- `offer.getSpent()` = 95,000 (what you actually paid: 95 × 1000)
- Actual cost per item = 95,000 / 1000 = **95**

Always use `getSpent() / getQuantitySold()` for the true price, not `getPrice()`.

---

## 8. Build Files

### build.gradle

Replace the content of `build.gradle` with:

```groovy
plugins {
    id 'java'
}

repositories {
    mavenLocal()
    maven {
        url = 'https://repo.runelite.net'
        content {
            includeGroupByRegex("net\\.runelite.*")
        }
    }
    mavenCentral()
}

// Use 'latest.release' to always build against the most recent RuneLite version.
// This is standard for Plugin Hub plugins.
def runeLiteVersion = 'latest.release'

dependencies {
    // RuneLite client — compileOnly means it's available at compile time
    // but NOT bundled in your JAR (RuneLite provides it at runtime)
    compileOnly group: 'net.runelite', name: 'client', version: runeLiteVersion

    // Lombok — generates boilerplate (@Data, @Slf4j, @Builder, etc.)
    compileOnly 'org.projectlombok:lombok:1.18.30'
    annotationProcessor 'org.projectlombok:lombok:1.18.30'

    // Test dependencies — these ARE bundled in the test JAR
    testImplementation 'junit:junit:4.13.2'
    testImplementation group: 'net.runelite', name: 'client', version: runeLiteVersion
    testImplementation group: 'net.runelite', name: 'jshell', version: runeLiteVersion
}

group = 'com.osrsfliptracker'
version = '1.0-SNAPSHOT'

// Enforce Java 11 for both compilation and output bytecode
tasks.withType(JavaCompile).configureEach {
    options.encoding = 'UTF-8'
    options.release.set(11)
}

// The shadowJar task creates a fat JAR containing all dependencies,
// used for running the plugin in developer mode.
tasks.register('shadowJar', Jar) {
    dependsOn configurations.testRuntimeClasspath
    manifest {
        // Main-Class: the test runner class that launches RuneLite
        attributes(
            'Main-Class': 'com.osrsfliptracker.FlipTrackerPluginTest',
            'Multi-Release': true
        )
    }

    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    from sourceSets.main.output
    from sourceSets.test.output
    from {
        configurations.testRuntimeClasspath.collect { file ->
            file.isDirectory() ? file : zipTree(file)
        }
    }

    // Exclude signature files that cause verification errors when bundled
    exclude 'META-INF/INDEX.LIST'
    exclude 'META-INF/*.SF'
    exclude 'META-INF/*.DSA'
    exclude 'META-INF/*.RSA'
    exclude '**/module-info.class'

    group = BasePlugin.BUILD_GROUP
    archiveClassifier.set('shadow')
    archiveFileName.set("${rootProject.name}-${project.version}-all.jar")
}
```

### settings.gradle

```groovy
// The project name — this becomes part of your JAR filename
rootProject.name = 'osrs-flip-tracker-plugin'
```

### runelite-plugin.properties

This file sits at the project root and describes your plugin to the Plugin Hub.

```properties
# Display name in the Plugin Hub
displayName=Flip Tracker

# One-line description
description=Track Grand Exchange flips and sync profit data to the OSRS Flip Tracker web app

# Plugin Hub tags (comma separated, used for search)
tags=grand exchange,flip,profit,merch,trade,money making

# Your GitHub username
author=VibeGoette

# Link to your project (will be shown in Plugin Hub)
support=https://github.com/VibeGoette/osrs-flip-tracker-plugin
```

---

## 9. Building & Testing

### Build the Plugin

```bash
# From the project root directory:
./gradlew build

# Or on Windows:
gradlew.bat build
```

**Successful output:**
```
BUILD SUCCESSFUL in 8s
3 actionable tasks: 3 executed
```

### Build the Fat JAR (for running)

```bash
./gradlew shadowJar
```

This creates `build/libs/osrs-flip-tracker-plugin-1.0-SNAPSHOT-all.jar`.

### Run in Developer Mode

**Option A — From IntelliJ:**

1. Open your run configuration (see Section 4, Step 6)
2. Verify Main class is set to `com.osrsfliptracker.FlipTrackerPluginTest`
3. Press **Shift+F10**

**Option B — From terminal:**

```bash
java -ea -jar build/libs/osrs-flip-tracker-plugin-1.0-SNAPSHOT-all.jar --developer-mode
```

### Testing Your Plugin

1. Launch RuneLite with your plugin loaded
2. Click the wrench icon and find "Flip Tracker" — enable it
3. Log into OSRS
4. Go to the Grand Exchange and place a buy order
5. Watch IntelliJ's console for log output — you should see `GE event: slot=0, state=BUYING...`
6. When the buy fills: `Buy completed: Fire rune x10000 at 5gp/ea (slot 0)`
7. Place a sell order for the same item
8. When the sell fills: `Flip complete: Fire rune x10000 | profit=+5.0k | tax=500gp`
9. Check the sidebar panel — it should show your flip

### Enabling Verbose Logging

Add to your IntelliJ run configuration's VM options:
```
-ea -Drunelite.log.level=DEBUG
```

This shows all `log.debug()` messages in the console.

### Common Build Errors and Fixes

| Error | Cause | Fix |
|---|---|---|
| `error: package net.runelite.api does not exist` | Wrong JDK or Gradle didn't download deps | Run `./gradlew build --refresh-dependencies` |
| `error: incompatible types: int cannot be converted to long` | Type mismatch | Cast: `(long) intValue` |
| `NullPointerException` on `client.getLocalPlayer()` | Called before player is logged in | Check `client.getGameState() == GameState.LOGGED_IN` first |
| `Cannot find symbol: method invokeLater` | Missing import | Add `import javax.swing.SwingUtilities;` |
| Plugin doesn't appear in list | Class not found | Verify `FlipTrackerPluginTest` has `ExternalPluginManager.loadBuiltin(FlipTrackerPlugin.class)` |

---

## 10. Communication Protocol

### REST API Contract

Your plugin sends an HTTP POST to `{config.apiUrl}/api/trades` for each completed flip.

#### Request

```
POST /api/trades
Content-Type: application/json
Authorization: Bearer <api-key>
```

#### Request Body

```json
{
  "playerName": "gotti892",
  "itemId": 554,
  "itemName": "Fire rune",
  "buyPrice": 5,
  "sellPrice": 6,
  "quantity": 10000,
  "totalBuyCost": 50000,
  "totalSellRevenue": 60000,
  "taxPaid": 1200,
  "profit": 8800,
  "buyTimestamp": 1709312400000,
  "sellTimestamp": 1709312460000,
  "buySlot": 0,
  "sellSlot": 1,
  "syncedAt": 1709312461000
}
```

All timestamps are Unix milliseconds. All money values are in GP (integers).

#### Expected Responses

| Status | Meaning |
|---|---|
| `200 OK` or `201 Created` | Flip recorded successfully |
| `401 Unauthorized` | API key missing or invalid |
| `400 Bad Request` | Malformed JSON payload |
| `500 Internal Server Error` | Server error (plugin logs warning and moves on) |

### Next.js API Route (Reference)

Your web app needs a route at `pages/api/trades.js` (Pages Router) or `app/api/trades/route.js` (App Router) that handles this:

```javascript
// app/api/trades/route.js (Next.js App Router)
import { NextResponse } from 'next/server';

export async function POST(request) {
  // Verify API key
  const authHeader = request.headers.get('Authorization');
  const expectedKey = process.env.FLIP_TRACKER_API_KEY;

  if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const trade = await request.json();

  // Validate required fields
  if (!trade.itemId || !trade.playerName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Save to your database (e.g., Prisma, Supabase, etc.)
  // await db.trade.create({ data: trade });

  return NextResponse.json({ success: true }, { status: 201 });
}
```

### Authentication

Set your API key as an environment variable in Vercel:
- Variable name: `FLIP_TRACKER_API_KEY`
- Value: a random secret string (generate with `openssl rand -hex 32`)

In the plugin, the user enters this same value in **Plugin Settings → Web Sync → API Key**.

---

## 11. Submitting to Plugin Hub

The [RuneLite Plugin Hub](https://github.com/runelite/plugin-hub) is the official distribution channel for external plugins. Plugins are reviewed by the RuneLite team before being listed.

### Requirements Checklist

- [x] Plugin repository is **public** on GitHub
- [x] Plugin does not violate [Jagex's rules](https://support.runescape.com/hc/en-gb/articles/17887227347473)
- [x] Plugin does not automate gameplay
- [x] README.md is present and informative
- [x] `runelite-plugin.properties` is filled in
- [x] `icon.png` added to `src/main/resources/com/osrsfliptracker/` (16×16 or 32×32 PNG)
- [x] Plugin builds cleanly with `./gradlew build`
- [x] Plugin Hub root-level `icon.png` is ≤ 48×72 pixels

### Step-by-Step Submission

**1. Finalize your plugin repository**

Make sure all code is committed and pushed:
```bash
git add .
git commit -m "Initial release: Flip Tracker v1.0"
git push origin main
```

Note the full commit hash of this commit — you'll need it:
```bash
git rev-parse HEAD
# Example output: 9db374fc205c5aae1f99bd5fd127266076f40ec8
```

**2. Fork the plugin-hub repository**

1. Go to https://github.com/runelite/plugin-hub
2. Click **Fork** → **Create fork** (keep it public)
3. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/plugin-hub.git
   cd plugin-hub
   ```

**3. Create your plugin manifest**

Create a new file `plugins/osrs-flip-tracker-plugin` (no extension):

```
repository=https://github.com/YOUR_USERNAME/osrs-flip-tracker-plugin.git
commit=9db374fc205c5aae1f99bd5fd127266076f40ec8
```

The `commit` value must be the exact 40-character hash. This pins the Plugin Hub to a specific version of your code.

**4. Submit the pull request**

```bash
git checkout -b add-flip-tracker-plugin
git add plugins/osrs-flip-tracker-plugin
git commit -m "Add Flip Tracker plugin"
git push origin add-flip-tracker-plugin
```

Then on GitHub:
1. Go to https://github.com/runelite/plugin-hub
2. Click **New pull request** → **Compare across forks**
3. Set **head repository** to your fork / `add-flip-tracker-plugin` branch
4. Write a short description: what the plugin does and why it's useful

**5. Wait for CI and review**

The PR will trigger automated checks:
- **Build check** — verifies your plugin compiles
- **Plugin Hub checks** — verifies manifest format and policy compliance

If checks fail, read the CI output, fix the issues, update the `commit=` hash in your manifest file to point to the fix, and push.

Reviews typically take days to a few weeks. The RuneLite team may leave feedback comments.

**6. Updating your plugin after release**

For future updates:
1. Make changes in your plugin repository
2. Commit and push
3. Get the new commit hash: `git rev-parse HEAD`
4. Update `plugins/osrs-flip-tracker-plugin` in your plugin-hub fork with the new hash
5. Open a new PR to plugin-hub

---

## 12. Troubleshooting & FAQ

### Q: My plugin doesn't appear in the RuneLite plugin list

**A:** Check that `FlipTrackerPluginTest.java` has:
```java
ExternalPluginManager.loadBuiltin(FlipTrackerPlugin.class);
```
Without this line, RuneLite won't know to load your plugin.

---

### Q: I get a `NullPointerException` when accessing `client.getLocalPlayer()`

**A:** The player object is only available when `GameState == LOGGED_IN`. Add a check:
```java
if (client.getGameState() != GameState.LOGGED_IN || client.getLocalPlayer() == null) {
    return;
}
```

---

### Q: The GE event fires but `offerTracker.processOffer()` always returns null

**A:** This is expected until a complete buy+sell cycle happens. Check the log output:
- If you see `Buy completed: ...` — the buy was tracked
- If you see `Sell completed for itemId X but no matching buy found` — either the buy happened before the plugin was enabled, or the item IDs don't match

---

### Q: The sidebar panel doesn't update after a flip

**A:** UI updates must happen on the EDT. Make sure you're calling:
```java
SwingUtilities.invokeLater(() -> panel.addFlip(completedFlip));
```
Not just `panel.addFlip(completedFlip)` directly from the client thread.

---

### Q: The web app isn't receiving trades

**A:** Debug in this order:
1. Check the IntelliJ console for log output from `WebSyncService`
2. Look for `Sync disabled` or `API key not set` warnings
3. Verify the API URL in plugin settings doesn't have a trailing slash
4. Test your endpoint manually with `curl`:
   ```bash
   curl -X POST https://your-app.vercel.app/api/trades \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -d '{"playerName":"test","itemId":554,"itemName":"Fire rune","buyPrice":5,"sellPrice":6,"quantity":100,"totalBuyCost":500,"totalSellRevenue":600,"taxPaid":12,"profit":88,"buyTimestamp":1709312400000,"sellTimestamp":1709312460000,"buySlot":0,"sellSlot":1,"syncedAt":1709312461000}'
   ```
5. If you get `401` — wrong API key. If you get `404` — wrong URL path.

---

### Q: How do I debug with breakpoints?

1. In IntelliJ, click the gutter (left of line numbers) to set a breakpoint
2. Run your run configuration in **Debug mode** (Shift+F9 or the bug icon)
3. When the breakpoint hits, IntelliJ will pause execution and show variable values
4. Use the **Debug** panel to step through code (F8 = step over, F7 = step into)

---

### Q: The GE tax calculation seems wrong

**A:** Verify the formula:
```java
// Tax = floor(sellPrice * quantity * 0.02), capped at 5,000,000
// Items ≤ 50gp per item are tax-exempt
long tax = (long)(sellPrice * quantity * 0.02);
tax = Math.min(tax, 5_000_000L);
if (sellPrice <= 50) tax = 0;
```

Note: the cap is **5,000,000gp total per trade**, not per item.

---

### Q: Can I test without logging into OSRS?

**A:** For UI testing you can call `panel.addFlip(...)` directly from a test:

```java
// In FlipTrackerPluginTest.main() or a separate unit test:
FlipData testFlip = FlipData.builder()
    .itemId(554)
    .itemName("Fire rune")
    .buyPrice(5L)
    .sellPrice(6L)
    .quantity(10000)
    .totalBuyCost(50000L)
    .totalSellRevenue(60000L)
    .taxPaid(1200L)
    .profit(8800L)
    .buyTimestamp(System.currentTimeMillis() - 60000)
    .sellTimestamp(System.currentTimeMillis())
    .status(FlipData.FlipStatus.COMPLETE)
    .build();

// Then inject it into the panel for visual testing
```

---

### Q: My plugin was rejected from Plugin Hub — what are common reasons?

Common rejection reasons (based on Plugin Hub review history):

1. **Automates gameplay** — any interaction that plays the game for the user is rejected
2. **Reads data beyond what's shown to the player** — accessing hidden game data is not allowed
3. **Violates the [Jagex ToS](https://support.runescape.com/hc/en-gb/articles/17887227347473)** — anything that gives an unfair advantage
4. **Doesn't compile cleanly** — CI must pass
5. **Uses disallowed dependencies** — only RuneLite-approved libraries can be used
6. **No README** — write a clear README explaining what your plugin does

The Flip Tracker plugin (displaying stats and syncing data you generate yourself) is firmly within the allowed category — similar to the Loot Tracker and existing Flipping Utilities plugin.

---

### Useful Resources

| Resource | URL |
|---|---|
| RuneLite Developer Guide | https://github.com/runelite/runelite/wiki/Developer-Guide |
| RuneLite API Javadoc | https://static.runelite.net/runelite-api/apidocs/ |
| RuneLite Client Javadoc | https://static.runelite.net/runelite-client/apidocs/ |
| Example Plugin (template) | https://github.com/runelite/example-plugin |
| Plugin Hub repository | https://github.com/runelite/plugin-hub |
| Flipping Utilities (reference) | https://github.com/Flipping-Utilities/rl-plugin |
| RuneLite Discord (#development) | https://discord.gg/runelite |
| OSRS GE Tax rules | https://ge.watch/calculators/ge-tax |

---

*Guide written for the OSRS Flip Tracker project — VibeGoette, 2026.*
*All Java code is written against RuneLite `latest.release` using Java 11.*
