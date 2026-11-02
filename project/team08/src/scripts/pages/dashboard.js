/* dashboard.js
   Handles fetching and displaying the user's portfolio on the dashboard page.
*/

import { onLoad, viewCurrency, viewMovementStyle } from "../initPage.js";
import {
  moneyAttrs,
  moneySpan,
  setMoneyEl,
  formatPrice
} from "../utils/formatting.js";
import { AppState } from "../state/astate.js";
import { showToast } from "../search.js";
import { saveUserData } from "../storage/userStorage.js";
import { getHistoricalPricesFMP } from "../api.js";
import { CONFIG } from "../../config.js";

let allocationChartInstance = null;
let performanceChartInstance = null;

let stockSocket = null;
let socketLoggedIn = false;

const subscribedSymbols = new Set();
const livePortfolioStocks = new Map();

function persistUser() {
  const state = AppState.current;
  if (!state?.user) return;

  saveUserData(state.user.username, state.getPersistedUserData());
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

async function initDashboard() {
  if (!document.getElementById("toast")) {
    const toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
  }

  await displayPortfolio();
}

function getPortfolioItems() {
  return AppState.current?.user?.portfolio?.all() ?? [];
}

function hideDashboardSections() {
  [
    "holdings-section",
    "portfolio-summary-section",
    "performance-section",
    "allocation-section",
    "sector-section",
    "earnings-section"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
}

function showDashboardSections() {
  [
    "holdings-section",
    "portfolio-summary-section",
    "performance-section",
    "allocation-section",
    "sector-section",
    "earnings-section"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = false;
  });
}

async function displayPortfolio() {
  const portfolioGrid = document.getElementById("portfolio-grid");
  const emptyState = document.getElementById("empty-portfolio-state");
  const summarySection = document.getElementById("portfolio-summary-section");

  const portfolioItems = getPortfolioItems();

  livePortfolioStocks.clear();

  if (!portfolioItems.length) {
    cleanupSocket();
    hideDashboardSections();

    if (emptyState) {
      emptyState.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="2" y="7" width="4" height="14" rx="1"/>
              <rect x="9" y="3" width="4" height="18" rx="1"/>
              <rect x="16" y="10" width="4" height="11" rx="1"/>
            </svg>
          </div>
          <p class="empty-state__title">Your portfolio is empty</p>
          <p class="empty-state__msg">Search for a stock and add it to start tracking!</p>
          <a href="explore.html" class="btn btn-ghost">Explore stocks</a>
        </div>
      `;
    }

    return;
  }

  if (emptyState) emptyState.innerHTML = "";
  showDashboardSections();

  if (portfolioGrid) portfolioGrid.innerHTML = "";
  if (summarySection) summarySection.hidden = true;

  const loadedHoldings = await Promise.allSettled(
    portfolioItems.map(async holding => {
      const asset = AppState.current.getAsset(holding.symbol);

      if (!asset) {
        throw new Error(`Asset ${holding.symbol} was not found in registry.`);
      }

      const [quote, profile] = await Promise.all([
        asset.getQuote(),
        asset.getProfile().catch(() => null)
      ]);

      return { asset, quote, profile, holding };
    })
  );

  loadedHoldings.forEach((result, index) => {
    const holding = portfolioItems[index];
    const symbol = holding.symbol;

    if (result.status !== "fulfilled") {
      console.error(`Failed to load data for ${symbol}:`, result.reason);
      portfolioGrid?.appendChild(createErrorCard(symbol, result.reason.message));
      showToast(`Could not load data for ${symbol}`, "error");
      return;
    }

    const { asset, quote, profile } = result.value;

    const shares = Number(holding.shares ?? 0);
    const avgPrice = Number(holding.avgPrice ?? 0);
    const price = Number(quote.price ?? asset.price ?? 0);

    const dayReferencePrice = Number(
      quote.dayStart ??
      quote.open ??
      quote.prevClose ??
      price
    );

    const stockView = {
      symbol: asset.symbol,
      ticker: asset.symbol,

      // if using Finnhub websocket mapping
      streamSymbol: getFinnhubStreamSymbol(
        asset.symbol,
        asset.type
      ),

      name: profile?.companyName ?? asset.name,
      company: profile?.companyName ?? asset.name,
      type: asset.type,

      price,

      // IMPORTANT
      dayReferencePrice,

      // calculate live day movement from reference price
      priceChangeAmount:
        price - dayReferencePrice,

      priceChangePercent:
        dayReferencePrice > 0
          ? (
            (price - dayReferencePrice) /
            dayReferencePrice
          ) * 100
          : 0,

      sector:
        profile?.sector ??
        asset.sector ??
        "Unknown",

      industry:
        profile?.industry ??
        asset.industry ??
        "Unknown",

      shares,
      avgCost: avgPrice
    };
    livePortfolioStocks.set(stockView.streamSymbol, stockView);

    portfolioGrid?.appendChild(createStockCard(stockView, holding));
  });

  refreshPortfolioVisuals();

  if (summarySection) summarySection.hidden = false;

  connectStockSocket();
}

function getLiveStocksArray() {
  return [...livePortfolioStocks.values()];
}

function getPortfolioValueStocks() {
  return getLiveStocksArray().map(stock => ({
    ticker: stock.ticker,
    price: stock.price,
    shares: stock.shares,
    avgCost: stock.avgCost,
    change: stock.priceChangeAmount,
    changePercent: stock.priceChangePercent
  }));
}

function getAllocationData() {
  return getLiveStocksArray().map(stock => ({
    ticker: stock.ticker,
    value: stock.shares * stock.price
  }));
}

function getSectorData() {
  return getLiveStocksArray().map(stock => ({
    sector: stock.sector ?? stock.industry ?? "Unknown",
    value: stock.shares * stock.price
  }));
}

function refreshPortfolioVisuals() {
  const stocks = getLiveStocksArray();

  if (!stocks.length) return;

  renderPortfolioSummary(stocks);
  renderPortfolioValue(getPortfolioValueStocks());
  renderPortfolioAllocation(getAllocationData());
  renderSectorExposure(getSectorData());

  viewCurrency();
  viewMovementStyle();
}

function renderPortfolioSummary(stocks) {
  const summaryEl = document.getElementById("portfolio-summary");
  if (!summaryEl || !stocks.length) return;

  const holdings = stocks.length;
  const gainers = stocks.filter(q => (q.priceChangeAmount ?? 0) > 0).length;
  const losers = stocks.filter(q => (q.priceChangeAmount ?? 0) < 0).length;

  const best = stocks.reduce((a, b) =>
    (a.priceChangePercent ?? 0) > (b.priceChangePercent ?? 0) ? a : b
  );

  const worst = stocks.reduce((a, b) =>
    (a.priceChangePercent ?? 0) < (b.priceChangePercent ?? 0) ? a : b
  );

  summaryEl.innerHTML = `
    <div class="summary-stat">
      <p class="summary-stat__label">Holdings</p>
      <p class="summary-stat__value">${holdings}</p>
      <p class="summary-stat__sub">asset${holdings > 1 ? "s" : ""} tracked</p>
    </div>

    <div class="summary-stat">
      <p class="summary-stat__label">Today's Movers</p>
      <p class="summary-stat__value">
        <span class="up">${gainers} ↑</span>
        <span class="summary-stat__divider">/</span>
        <span class="down">${losers} ↓</span>
      </p>
      <p class="summary-stat__sub">${holdings - gainers - losers} unchanged</p>
    </div>

    <div class="summary-stat">
      <p class="summary-stat__label">Top Gainer</p>
      <p class="summary-stat__value summary-stat__value--ticker">${best.ticker}</p>
      <p class="summary-stat__sub up">+${(best.priceChangePercent ?? 0).toFixed(2)}% today</p>
    </div>

    <div class="summary-stat">
      <p class="summary-stat__label">Top Loser</p>
      <p class="summary-stat__value summary-stat__value--ticker">${worst.ticker}</p>
      <p class="summary-stat__sub down">${(worst.priceChangePercent ?? 0).toFixed(2)}% today</p>
    </div>
  `;
}

function renderPortfolioValue(stocks) {
  const portfolioEl = document.getElementById("portfolio-earnings");
  if (!portfolioEl) return;

  if (!stocks.length) {
    portfolioEl.innerHTML = `<p>No holdings yet.</p>`;
    return;
  }

  let totalValue = 0;
  let totalCost = 0;
  let dayChange = 0;

  stocks.forEach(stock => {
    const shares = stock.shares ?? 0;
    const price = stock.price ?? 0;
    const avgCost = stock.avgCost ?? 0;
    const changeAmount = stock.change ?? 0;

    totalValue += shares * price;
    totalCost += shares * avgCost;
    dayChange += shares * changeAmount;
  });

  const totalGainLoss = totalValue - totalCost;
  const totalGainLossPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
  const previousValue = totalValue - dayChange;
  const dayChangePct = previousValue > 0 ? (dayChange / previousValue) * 100 : 0;

  const realizedGainLoss = Number(
  AppState.current?.user?.realizedGainLoss ?? 0
);

const allTimeGainLoss = realizedGainLoss + totalGainLoss;

const allTimeGainLossPct = totalCost > 0
  ? (allTimeGainLoss / totalCost) * 100
  : 0;
  
  const best = stocks.reduce((a, b) =>
    (a.changePercent ?? 0) > (b.changePercent ?? 0) ? a : b
  );

  const worst = stocks.reduce((a, b) =>
    (a.changePercent ?? 0) < (b.changePercent ?? 0) ? a : b
  );

  portfolioEl.innerHTML = `
    <div class="summary-stat">
      <p class="summary-stat__label">Portfolio Value</p>
      <p class="summary-stat__value">
        ${moneySpan(totalValue)}
      </p>
      <p class="summary-stat__sub ${dayChange >= 0 ? "up" : "down"}">
        ${dayChange >= 0 ? "+" : "-"}${moneySpan(Math.abs(dayChange))} today
      </p>
    </div>

    <div class="summary-stat">
      <p class="summary-stat__label">Total Gain/Loss</p>
      <p class="summary-stat__value ${totalGainLoss >= 0 ? "up" : "down"}">
        ${totalGainLoss >= 0 ? "+" : "-"}${moneySpan(Math.abs(totalGainLoss))}
      </p>
      <p class="summary-stat__sub ${totalGainLoss >= 0 ? "up" : "down"}">
        ${totalGainLossPct >= 0 ? "+" : ""}${totalGainLossPct.toFixed(2)}%
      </p>
    </div>

    <div class="summary-stat">
  <p class="summary-stat__label">All-Time Gain/Loss</p>
  <p class="summary-stat__value ${allTimeGainLoss >= 0 ? "up" : "down"}">
    ${allTimeGainLoss >= 0 ? "+" : "-"}${moneySpan(Math.abs(allTimeGainLoss))}
  </p>
  <p class="summary-stat__sub ${allTimeGainLoss >= 0 ? "up" : "down"}">
    ${allTimeGainLossPct >= 0 ? "+" : ""}${allTimeGainLossPct.toFixed(2)}%
  </p>
</div>

    <div class="summary-stat">
      <p class="summary-stat__label">Today's Return</p>
      <p class="summary-stat__value ${dayChange >= 0 ? "up" : "down"}">
        ${dayChangePct >= 0 ? "+" : ""}${dayChangePct.toFixed(2)}%
      </p>
      <p class="summary-stat__sub">daily portfolio movement</p>
    </div>

    <div class="summary-stat">
      <p class="summary-stat__label">Top Gainer</p>
      <p class="summary-stat__value summary-stat__value--ticker">${best.ticker}</p>
      <p class="summary-stat__sub up">+${(best.changePercent ?? 0).toFixed(2)}%</p>
    </div>

    <div class="summary-stat">
      <p class="summary-stat__label">Top Loser</p>
      <p class="summary-stat__value summary-stat__value--ticker">${worst.ticker}</p>
      <p class="summary-stat__sub down">${(worst.changePercent ?? 0).toFixed(2)}%</p>
    </div>
  `;
}

function createStockCard(stock, holding) {
  const card = document.createElement("div");

  card.className = "card live-dashboard-card";
  card.dataset.ticker = stock.ticker;
  card.dataset.streamSymbol = stock.streamSymbol;
  card.dataset.lastPrice = stock.price;

  const price = stock.price ?? 0;
  const change = stock.priceChangeAmount ?? 0;
  const changePct = stock.priceChangePercent ?? 0;

  const shares = Number(holding.shares ?? 0);
  const avgCost = Number(holding.avgPrice ?? holding.avgCost ?? 0);

  const positionValue = shares * price;
  const totalCost = shares * avgCost;
  const gainLoss = positionValue - totalCost;
  const gainLossPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

  const isPositive = change >= 0;
  const changeClass = isPositive ? "up" : "down";
  const changeSymbol = isPositive ? "+" : "-";

  const gainLossClass = gainLoss >= 0 ? "up" : "down";
  const gainLossSymbol = gainLoss >= 0 ? "+" : "-";

  card.innerHTML = `
    <div class="card-header-row">
      <div>
        <div class="tkrSym">${stock.ticker}</div>
        <div class="compName">${stock.company || stock.name || stock.ticker}</div>
      </div>
      <button class="fav-btn active" data-ticker="${stock.ticker}" title="Remove from portfolio">✕</button>
    </div>

    <div class="currPrice price-locator" ${moneyAttrs(price)}>
      ${formatPrice(price)}
    </div>

    <div class="priceDiff ${changeClass} movement-locator">
      <span id="direction-locator">${changeSymbol}</span>

      <span class="price-locator" ${moneyAttrs(Math.abs(change))}>
        ${Math.abs(change).toFixed(2)}
      </span>

      <span class="percent-change-locator" data-change="${Math.abs(changePct).toFixed(2)}">
        (${Math.abs(changePct).toFixed(2)}%)
      </span>
    </div>

    <div class="position-info">
      <div class="position-info__row">
        <span>Shares</span>
        <strong>${shares}</strong>
      </div>

      <div class="position-info__row">
        <span>Position Value</span>
        <strong class="position-value price-locator" ${moneyAttrs(positionValue)}>
          ${formatPrice(positionValue)}
        </strong>
      </div>

      <div class="position-info__row">
        <span>Avg Cost</span>
        <strong class="price-locator" ${moneyAttrs(avgCost)}>
          ${formatPrice(avgCost)}
        </strong>
      </div>

      <div class="position-info__row">
        <span>Total P/L</span>
        <strong class="total-pl ${gainLossClass}">
          <span class="pl-sign">${gainLossSymbol}</span>
          ${moneySpan(Math.abs(gainLoss), "total-pl-amount")}
          <span class="pl-percent"> (${gainLossSymbol}${Math.abs(gainLossPct).toFixed(2)}%)</span>
        </strong>
      </div>
    </div>
  `;

  card.querySelector(".fav-btn")?.addEventListener("click", e => {
    e.stopPropagation();
    removeFromPortfolio(stock.ticker);
  });

  card.addEventListener("click", () => {
  window.location.href =
    `stock-details.html?symbol=${encodeURIComponent(stock.ticker)}&type=${encodeURIComponent(stock.type)}`;
});

  return card;
}

function createErrorCard(ticker, message) {
  const card = document.createElement("div");

  card.className = "card card--error";
  card.innerHTML = `
    <div class="card-header-row">
      <div>
        <div class="tkrSym">${ticker}</div>
        <div class="compName">Could not load data</div>
      </div>
    </div>
    <p class="card-error-msg">${message}</p>
    <p class="card-error-hint">This may be a temporary issue. Try refreshing the page.</p>
  `;

  return card;
}

function removeFromPortfolio(ticker) {
  const user = AppState.current?.user;
  const asset = AppState.current?.getAsset(ticker);

  if (!user) return;

  const removed = user.removePortfolioPosition(asset ?? ticker);

  if (!removed) {
    showToast(`Could not remove ${ticker}`, "error");
    return;
  }

  persistUser();
  displayPortfolio();
  showToast(`${ticker} removed from portfolio`, "warning");
}

function renderPortfolioAllocation(allocationData) {
  const canvas = document.getElementById("allocationChart");
  if (!canvas) return;

  const labels = allocationData.map(item => item.ticker);
  const values = allocationData.map(item => item.value);

  if (allocationChartInstance) {
    allocationChartInstance.destroy();
  }

  allocationChartInstance = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data: values, borderWidth: 1 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const total = values.reduce((sum, value) => sum + value, 0);
              const value = context.raw;
              const percent = total ? (value / total) * 100 : 0;
              return `${context.label}: ${formatPrice(value)} (${percent.toFixed(1)}%)`;
            }
          }
        }
      }
    }
  });

  const listEl = document.getElementById("allocation-list");
  if (!listEl) return;

  const total = values.reduce((sum, value) => sum + value, 0);

  listEl.innerHTML = allocationData.map(item => {
    const percent = total ? (item.value / total) * 100 : 0;

    return `
      <div class="allocation-item">
        <div class="allocation-item__top">
          <div class="allocation-item__ticker">${item.ticker}</div>
          <div class="allocation-item__percent">${percent.toFixed(1)}%</div>
        </div>

        <div class="allocation-item__value">${moneySpan(item.value)}</div>
        <div class="allocation-item__sub">of total portfolio</div>

        <div class="allocation-bar">
          <div class="allocation-bar__fill" style="width: ${percent}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

function updateAllocationListOnly(allocationData) {
  const listEl = document.getElementById("allocation-list");
  if (!listEl) return;

  const total = allocationData.reduce((sum, item) => sum + item.value, 0);

  listEl.innerHTML = allocationData.map(item => {
    const percent = total ? (item.value / total) * 100 : 0;

    return `
      <div class="allocation-item">
        <div class="allocation-item__top">
          <div class="allocation-item__ticker">${item.ticker}</div>
          <div class="allocation-item__percent">${percent.toFixed(1)}%</div>
        </div>

        <div class="allocation-item__value">${moneySpan(item.value)}</div>
        <div class="allocation-item__sub">of total portfolio</div>

        <div class="allocation-bar">
          <div class="allocation-bar__fill" style="width: ${percent}%"></div>
        </div>
      </div>
    `;
  }).join("");

  viewCurrency();
}

async function renderPortfolioPerformance(portfolioValueStocks) {
  const canvas = document.getElementById("portfolioPerformanceChart");
  if (!canvas) return;

  const historicalData = await Promise.all(
    portfolioValueStocks.map(async stock => {
      const history = await getHistoricalPricesFMP(stock.ticker, 30);

      return {
        ticker: stock.ticker,
        shares: stock.shares,
        history
      };
    })
  );

  const portfolioByDate = {};

  historicalData.forEach(stock => {
    stock.history.forEach(day => {
      const date = day.date;
      const close = day.close ?? day.price ?? 0;

      portfolioByDate[date] = (portfolioByDate[date] ?? 0) + close * stock.shares;
    });
  });

  const sortedDates = Object.keys(portfolioByDate)
    .sort((a, b) => new Date(a) - new Date(b));

  const labels = sortedDates.map(date =>
    new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    })
  );

  const values = sortedDates.map(date => portfolioByDate[date]);

  if (performanceChartInstance) {
    performanceChartInstance.destroy();
  }

  performanceChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: values,
        tension: 0.35,
        fill: true,
        pointRadius: 0,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8" },
          grid: { display: false }
        },
        y: {
          ticks: {
            color: "#94a3b8",
            callback: value => formatPrice(value)
          },
          grid: {
            color: "rgba(255,255,255,0.06)"
          }
        }
      }
    }
  });
}

function renderSectorExposure(sectorData) {
  const sectorEl = document.getElementById("sector-exposure");
  if (!sectorEl) return;

  const sectorTotals = {};

  sectorData.forEach(item => {
    const sector = item.sector || "Unknown";
    const value = Number(item.value ?? 0);

    sectorTotals[sector] = (sectorTotals[sector] ?? 0) + value;
  });

  const totalPortfolioValue = Object.values(sectorTotals)
    .reduce((sum, value) => sum + value, 0);

  sectorEl.innerHTML = Object.entries(sectorTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([sector, value]) => {
      const percent = totalPortfolioValue
        ? (value / totalPortfolioValue) * 100
        : 0;

      return `
        <div class="sector-card">
          <div class="sector-card__top">
            <span class="sector-card__name">${sector}</span>
            <strong>${percent.toFixed(1)}%</strong>
          </div>

          <div class="sector-card__value">${moneySpan(value)}</div>

          <div class="sector-bar">
            <div class="sector-bar__fill" style="width: ${percent}%"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function connectStockSocket() {
  if (stockSocket || livePortfolioStocks.size === 0) return;

  stockSocket = new WebSocket(
    `wss://ws.finnhub.io?token=${CONFIG.API_KEY}`
  );

  stockSocket.addEventListener("open", () => {
    console.log("Finnhub dashboard WebSocket opened.");
    socketLoggedIn = true;
    subscribePortfolioSymbols();
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
    console.error("Finnhub dashboard websocket error:", event);
  });

  stockSocket.addEventListener("close", () => {
    console.warn("Finnhub dashboard WebSocket closed.");
    stockSocket = null;
    socketLoggedIn = false;
    subscribedSymbols.clear();
  });
}

function handleSocketMessage(payload) {
  if (payload?.type === "ping") return;

  if (payload?.type === "error") {
    console.warn("Finnhub dashboard websocket error:", payload);
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

function subscribePortfolioSymbols() {
  if (
    !stockSocket ||
    stockSocket.readyState !== WebSocket.OPEN ||
    !socketLoggedIn
  ) {
    return;
  }

  const symbols = [...livePortfolioStocks.keys()]
    .filter(Boolean)
    .filter(symbol => !subscribedSymbols.has(symbol));

  symbols.forEach(symbol => {
    stockSocket.send(JSON.stringify({
      type: "subscribe",
      symbol
    }));

    subscribedSymbols.add(symbol);
    console.log(`Dashboard subscribed to ${symbol}`);
  });
}

function handleLiveQuote(trade) {
  const streamSymbol = trade?.s;
  const price = trade?.p;

  if (!streamSymbol || price == null || !livePortfolioStocks.has(streamSymbol)) {
    return;
  }

  updateLivePortfolioStock(streamSymbol, Number(price), trade);
}

function updateLivePortfolioStock(streamSymbol, price) {
  const stock =
    livePortfolioStocks.get(streamSymbol);

  if (!stock) return;

  const referencePrice = Number(
    stock.dayReferencePrice ??
    stock.price
  );

  const changeAmount =
    referencePrice > 0
      ? price - referencePrice
      : 0;

  const changePercent =
    referencePrice > 0
      ? (changeAmount / referencePrice) * 100
      : 0;

  stock.price = price;

  stock.priceChangeAmount =
    changeAmount;

  stock.priceChangePercent =
    changePercent;

  livePortfolioStocks.set(
    streamSymbol,
    stock
  );

  updateLiveCard(stock.ticker, stock);

renderPortfolioSummary(getLiveStocksArray());
renderPortfolioValue(getPortfolioValueStocks());
updateAllocationListOnly(getAllocationData());
renderSectorExposure(getSectorData());

viewCurrency();
viewMovementStyle();
}

function updateLiveCard(symbol, stock) {
  const card = document.querySelector(`.live-dashboard-card[data-ticker="${symbol}"]`);
  if (!card) return;

  card.dataset.lastPrice = String(stock.price);

  const priceEl = card.querySelector(".currPrice");

  if (priceEl) {
    priceEl.dataset.amount = String(stock.price);
  }

  const positive = stock.priceChangeAmount >= 0;
  const direction = positive ? "up" : "down";
  const sign = positive ? "+" : "-";

  const movement = card.querySelector(".movement-locator");
  const directionEl = movement?.querySelector("#direction-locator");
  const changePriceEl = movement?.querySelector(".price-locator");
  const percentEl = movement?.querySelector(".percent-change-locator");

  if (movement) {
    movement.classList.remove("up", "down");
    movement.classList.add(direction);
  }

  if (directionEl) {
    directionEl.textContent = sign;
  }

  if (changePriceEl) {
    changePriceEl.dataset.amount = String(Math.abs(stock.priceChangeAmount));
  }

  if (percentEl) {
    percentEl.dataset.change = String(Math.abs(stock.priceChangePercent));
    percentEl.textContent = `(${Math.abs(stock.priceChangePercent).toFixed(2)}%)`;
  }

  const positionValue = stock.shares * stock.price;
  const totalCost = stock.shares * stock.avgCost;
  const gainLoss = positionValue - totalCost;
  const gainLossPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

  const positionValueEl = card.querySelector(".position-value");
  const totalPlEl = card.querySelector(".total-pl");

  if (positionValueEl) {
    setMoneyEl(positionValueEl, positionValue);
  }

  if (totalPlEl) {
    const gainPositive = gainLoss >= 0;
    const gainSign = gainPositive ? "+" : "-";

    totalPlEl.classList.remove("up", "down");
    totalPlEl.classList.add(gainPositive ? "up" : "down");

    totalPlEl.innerHTML = `
      <span class="pl-sign">${gainSign}</span>
      ${moneySpan(Math.abs(gainLoss), "total-pl-amount")}
      <span class="pl-percent"> (${gainSign}${Math.abs(gainLossPct).toFixed(2)}%)</span>
    `;
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

  await initDashboard();

  const stocks = getPortfolioValueStocks();
  if (stocks.length) {
    await renderPortfolioPerformance(stocks);
  }

  onLoad();
};

window.addEventListener("beforeunload", () => {
  cleanupSocket();
});