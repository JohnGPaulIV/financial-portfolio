/* watchlist.js
   Handles fetching and displaying the user's watchlist.
*/

import { onLoad, viewCurrency, viewMovementStyle } from "../initPage.js";
import { moneyAttrs, setMoneyEl } from "../utils/formatting.js";
import { AppState } from "../state/astate.js";
import { showToast } from "../search.js";
import { saveUserData } from "../storage/userStorage.js";
import { CONFIG } from "../../config.js";

let stockSocket = null;
let socketLoggedIn = false;

const subscribedSymbols = new Set();

function formatPrice(value) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function getFinnhubStreamSymbol(symbol, type = "stock") {
  const clean = String(symbol ?? "")
    .toUpperCase()
    .replace(/[-_/]/g, "");

  if (!clean) return "";

  if (type === "currency_pair") {
    const base = clean.slice(0, 3);
    const quote = clean.slice(3, 6);

    if (!base || !quote) return "";

    return `OANDA:${base}_${quote}`;
  }

  if (type === "crypto") {
    const base = clean
      .replace("USDT", "")
      .replace("USD", "");

    if (!base) return "";

    return `BINANCE:${base}USDT`;
  }

  return clean;
}

function persistUser() {
  const state = AppState.current;

  if (!state?.user) return;

  saveUserData(
    state.user.username,
    state.getPersistedUserData()
  );
}

function getUser() {
  return AppState.current?.user ?? null;
}

function getWatchlistItems() {
  return getUser()?.watchlist?.all() ?? [];
}

async function initWatchlist() {
  if (!document.getElementById("toast")) {
    const toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
  }

  await displayWatchlist();
}

async function displayWatchlist() {
  const watchlistGrid = document.getElementById("watchlist-grid");

  if (!watchlistGrid) return;

  const watchlistItems = getWatchlistItems();

  if (!watchlistItems.length) {
    cleanupSocket();

    watchlistGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>

        <p class="empty-state__title">
          Your watchlist is empty
        </p>

        <p class="empty-state__msg">
          Search for a stock and add it to start watching!
        </p>

        <a href="explore.html" class="btn btn-ghost">
          Explore stocks
        </a>
      </div>
    `;

    return;
  }

  watchlistGrid.innerHTML = `
    <div class="watchlist-header">
      <div class="watchlist-header__logo"></div>

      <span class="watchlist-header__col watchlist-header__col--symbol">
        Symbol
      </span>

      <span class="watchlist-header__col watchlist-header__col--price">
        Price
      </span>

      <span class="watchlist-header__col watchlist-header__col--change">
        Change
      </span>

      <span class="watchlist-header__col watchlist-header__col--high">
        High
      </span>

      <span class="watchlist-header__col watchlist-header__col--low">
        Low
      </span>

      <div class="watchlist-header__remove"></div>
    </div>
  `;

  const results = await Promise.allSettled(
    watchlistItems.map(async item => {
      const symbol = item.symbol;
      const asset = AppState.current.getAsset(symbol);

      if (!asset) {
        throw new Error(`Asset ${symbol} not found.`);
      }

      const [quote, profile] = await Promise.all([
        asset.getQuote(),
        asset.getProfile().catch(() => null)
      ]);

      return {
        asset,
        quote,
        profile
      };
    })
  );

  results.forEach((result, index) => {
    const item = watchlistItems[index];
    const symbol = item.symbol;

    if (result.status === "fulfilled") {
      const { asset, quote, profile } = result.value;

      watchlistGrid.appendChild(
        createWatchlistCard({
          asset,
          quote,
          profile
        })
      );
    } else {
      console.error(
        `Failed to load watchlist asset ${symbol}:`,
        result.reason
      );

      watchlistGrid.appendChild(
        createErrorCard(
          symbol,
          result.reason.message
        )
      );

      showToast(
        `Could not load ${symbol}`,
        "error"
      );
    }
  });

  viewCurrency();
  viewMovementStyle();

  connectStockSocket();
}

function createWatchlistCard({
  asset,
  quote,
  profile
}) {
  const row = document.createElement("div");

  const price = Number(quote?.price ?? asset.price ?? 0);

  const dayReferencePrice = Number(
    quote?.dayStart ??
    quote?.open ??
    quote?.prevClose ??
    price
  );

  const change = price - dayReferencePrice;

  const changePct =
    dayReferencePrice > 0
      ? (change / dayReferencePrice) * 100
      : 0;

  const high = Number(quote?.high ?? 0);
  const low = Number(quote?.low ?? 0);

  const streamSymbol = getFinnhubStreamSymbol(
    asset.symbol,
    asset.type
  );

  row.className = "watchlist-row live-watchlist-row";
  row.dataset.ticker = asset.symbol;
  row.dataset.type = asset.type;
  row.dataset.streamSymbol = streamSymbol;
  row.dataset.lastPrice = String(price);
  row.dataset.dayReferencePrice = String(dayReferencePrice);

  const isPositive = change >= 0;
  const changeClass = isPositive ? "up" : "down";
  const changeSymbol = isPositive ? "+" : "-";

  const logo =
    profile?.image ||
    profile?.logo ||
    null;

  const companyName =
    profile?.companyName ||
    asset.name ||
    asset.symbol;

  const logoHtml = logo
    ? `
      <img
        class="watchlist-row__logo"
        src="${logo}"
        alt="${asset.symbol}"
        onerror="this.style.visibility='hidden'"
      >
    `
    : `
      <div class="watchlist-row__logo watchlist-row__logo--placeholder"></div>
    `;

  row.innerHTML = `
    ${logoHtml}

    <div class="watchlist-row__identity">
      <span class="watchlist-row__ticker">
        ${asset.symbol}
      </span>

      <span class="watchlist-row__name">
        ${companyName}
      </span>
    </div>

    <span
      class="watchlist-row__price price-locator"
      ${moneyAttrs(price)}
    >
      ${formatPrice(price)}
    </span>

    <span class="watchlist-row__change ${changeClass} movement-locator">
      <span id="direction-locator">
        ${changeSymbol}
      </span>

      <span
        class="watchlist-row__change-amount price-locator"
        ${moneyAttrs(Math.abs(change))}
      >
        ${Math.abs(change).toFixed(2)}
      </span>

      <span
        class="percent-change-locator"
        data-change="${Math.abs(changePct).toFixed(2)}"
      >
        (${Math.abs(changePct).toFixed(2)}%)
      </span>
    </span>

    <span
      class="watchlist-row__high price-locator"
      ${moneyAttrs(high)}
    >
      ${formatPrice(high)}
    </span>

    <span
      class="watchlist-row__low price-locator"
      ${moneyAttrs(low)}
    >
      ${formatPrice(low)}
    </span>

    <button
      class="watchlist-row__remove fav-btn active"
      data-ticker="${asset.symbol}"
      title="Remove from watchlist"
    >
      ✕
    </button>
  `;

  row.querySelector(".watchlist-row__remove")
    ?.addEventListener("click", e => {
      e.stopPropagation();
      removeFromWatchlist(asset.symbol);
    });

  row.onclick = () => {
    window.location.href =
      `stock-details.html?symbol=${encodeURIComponent(asset.symbol)}&type=${encodeURIComponent(asset.type)}`;
  };

  return row;
}

function createErrorCard(symbol, message) {
  const row = document.createElement("div");

  row.className =
    "watchlist-row watchlist-row--error";

  row.innerHTML = `
    <div class="watchlist-row__logo watchlist-row__logo--placeholder"></div>

    <span class="watchlist-row__ticker">
      ${symbol}
    </span>

    <span
      class="watchlist-row__price card-error-msg"
      title="${message}"
    >
      Failed to load
    </span>
  `;

  return row;
}

function removeFromWatchlist(symbol) {
  const user = getUser();

  if (!user) return;

  const asset = AppState.current?.getAsset(symbol);

  const removed =
    user.removeFromWatchlist(asset ?? { symbol });

  if (!removed) {
    showToast(
      `Could not remove ${symbol}`,
      "error"
    );

    return;
  }

  persistUser();

  unsubscribeSymbol(symbol);

  const remaining =
    user.watchlist.all().length;

  if (remaining === 0) {
    displayWatchlist();
  } else {
    const row = document.querySelector(
      `#watchlist-grid [data-ticker="${symbol}"]`
    );

    if (row) {
      row.remove();
    }
  }

  showToast(
    `${symbol} removed from watchlist`,
    "warning"
  );
}

function connectStockSocket() {
  if (stockSocket || getWatchlistItems().length === 0) return;

  stockSocket = new WebSocket(
    `wss://ws.finnhub.io?token=${CONFIG.API_KEY}`
  );

  stockSocket.addEventListener("open", () => {
    console.log("Finnhub watchlist WebSocket opened.");
    socketLoggedIn = true;
    subscribeWatchlistSymbols();
  });

  stockSocket.addEventListener("message", event => {
    try {
      const payload = JSON.parse(event.data);
      handleSocketMessage(payload);
    } catch (err) {
      console.error("Finnhub WebSocket parse failed:", err, event.data);
    }
  });

  stockSocket.addEventListener("error", event => {
    console.error("Finnhub watchlist websocket error:", event);
  });

  stockSocket.addEventListener("close", () => {
    console.warn("Finnhub watchlist WebSocket closed.");
    stockSocket = null;
    socketLoggedIn = false;
    subscribedSymbols.clear();
  });
}

function handleSocketMessage(payload) {
  if (payload?.type === "ping") return;

  if (payload?.type === "error") {
    console.warn("Finnhub watchlist websocket error:", payload);
    return;
  }

  if (
    payload?.type === "trade" &&
    Array.isArray(payload.data) &&
    payload.data.length > 0
  ) {
    payload.data.forEach(handleLiveQuote);
  }
}

function subscribeWatchlistSymbols() {
  if (
    !stockSocket ||
    stockSocket.readyState !== WebSocket.OPEN ||
    !socketLoggedIn
  ) {
    return;
  }

  document
    .querySelectorAll(".live-watchlist-row")
    .forEach(row => {
      const streamSymbol = row.dataset.streamSymbol;

      if (!streamSymbol || subscribedSymbols.has(streamSymbol)) {
        return;
      }

      stockSocket.send(JSON.stringify({
        type: "subscribe",
        symbol: streamSymbol
      }));

      subscribedSymbols.add(streamSymbol);
      console.log(`Watchlist subscribed to ${streamSymbol}`);
    });
}

function unsubscribeSymbol(symbol) {
  if (!symbol) return;

  const row = document.querySelector(
    `.live-watchlist-row[data-ticker="${symbol}"]`
  );

  const streamSymbol =
    row?.dataset?.streamSymbol ??
    symbol.toUpperCase();

  if (
    stockSocket &&
    stockSocket.readyState === WebSocket.OPEN &&
    socketLoggedIn &&
    subscribedSymbols.has(streamSymbol)
  ) {
    stockSocket.send(JSON.stringify({
      type: "unsubscribe",
      symbol: streamSymbol
    }));
  }

  subscribedSymbols.delete(streamSymbol);
}

function handleLiveQuote(trade) {
  const streamSymbol = trade?.s;
  const price = trade?.p;

  if (!streamSymbol || price == null) return;

  document
    .querySelectorAll(".live-watchlist-row")
    .forEach(row => {
      if (row.dataset.streamSymbol === streamSymbol) {
        updateLiveWatchlistRow(row, Number(price));
      }
    });
}

function updateLiveWatchlistRow(row, price) {
  const referencePrice = Number(
    row.dataset.dayReferencePrice ??
    row.dataset.lastPrice
  );

  row.dataset.lastPrice = String(price);

  const priceEl = row.querySelector(".watchlist-row__price");

  if (priceEl) {
    setMoneyEl(priceEl, price);
  }

  const changeAmount =
    referencePrice > 0
      ? price - referencePrice
      : 0;

  const changePct =
    referencePrice > 0
      ? (changeAmount / referencePrice) * 100
      : 0;

  const positive = changeAmount >= 0;
  const changeClass = positive ? "up" : "down";
  const changeSymbol = positive ? "+" : "-";

  const changeEl = row.querySelector(".watchlist-row__change");
  const directionEl = row.querySelector("#direction-locator");
  const amountEl = row.querySelector(".watchlist-row__change-amount");
  const percentEl = row.querySelector(".percent-change-locator");

  if (changeEl) {
    changeEl.classList.remove("up", "down");
    changeEl.classList.add(changeClass);
  }

  if (directionEl) {
    directionEl.textContent = changeSymbol;
  }

  if (amountEl) {
    setMoneyEl(amountEl, Math.abs(changeAmount));
  }

  if (percentEl) {
    percentEl.dataset.change = String(Math.abs(changePct));
    percentEl.textContent = `(${Math.abs(changePct).toFixed(2)}%)`;
  }

  viewCurrency();
  viewMovementStyle();
}

function cleanupSocket() {
  if (stockSocket) {
    subscribedSymbols.forEach(symbol => {
      if (stockSocket.readyState === WebSocket.OPEN) {
        stockSocket.send(JSON.stringify({
          type: "unsubscribe",
          symbol
        }));
      }
    });

    stockSocket.close();
    stockSocket = null;
  }

  socketLoggedIn = false;
  subscribedSymbols.clear();
}

window.onload = async function () {
  await AppState.hydrate();

  if (!AppState.current) {
    window.location.replace("login.html");
    return;
  }

  await initWatchlist();
  onLoad();
};

window.addEventListener("beforeunload", cleanupSocket);