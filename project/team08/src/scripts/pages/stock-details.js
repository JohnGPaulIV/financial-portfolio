/* stock-details.js
   Reads the ?symbol= query param, loads the asset from AppState,
   fetches quote/profile/peers/news/chart data, and populates the stock details page.
*/

import { onLoad, viewCurrency, viewMovementStyle } from "../initPage.js";
import {
  getCompanyNews,
  getIntradayChartData,
  getHistoricalChartData
} from "../api.js";
import { AppState } from "../state/astate.js";
import { saveUserData } from "../storage/userStorage.js";
import { showToast } from "../search.js";
import { CONFIG } from "../../config.js";

let currentSymbol = null;
let currentType = null;
let currentName = null;
let currentStockObj = null;
let currentStreamSymbol = null;
let stockChart = null;
let liveCandles = [];
let liveCandleLabels = [];

let stockSocket = null;
let socketLoggedIn = false;

let btnClose = null;
let btnAdd = null;
let numShares = null;
let priceBought = null;
let portfolioQuestionsContainer = null;
let portfolioActionMode = "buy";

const chartState = {
  mode: "historical",
  candleInterval: null,
  historicalRange: null,
  fromDate: null,
  toDate: null
};

function formatPrice(price) {
  if (price == null || Number.isNaN(Number(price))) return "—";
  return `$${Number(price).toFixed(2)}`;
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

function formatMarketCap(value) {
  if (!value) return "—";

  const billions = value / 1_000_000_000;

  if (billions >= 1000) {
    return `$${(billions / 1000).toFixed(2)}T`;
  }

  if (billions >= 1) {
    return `$${billions.toFixed(2)}B`;
  }

  return `$${(value / 1_000_000).toFixed(0)}M`;
}

function persistUser() {
  const state = AppState.current;

  if (!state?.user) return;

  saveUserData(
    state.user.username,
    state.getPersistedUserData()
  );
}

function getCurrentUser() {
  return AppState.current?.user ?? null;
}

async function displaySymbolDetails() {
  const params = new URLSearchParams(window.location.search);
  const symbol = params.get("symbol");
  const type = params.get("type");

  if (!symbol) {
    const stockSymbol = document.getElementById("stock-symbol");
    if (stockSymbol) stockSymbol.textContent = "No stock selected";
    return;
  }

  currentSymbol = symbol.toUpperCase();
  currentType = type;
  document.title = `${currentSymbol} — Tradar`;

  const asset = AppState.current.getAsset(currentSymbol);

  if (!asset) {
    const stockSymbol = document.getElementById("stock-symbol");
    if (stockSymbol) stockSymbol.textContent = "Asset not found";

    showToast(`${currentSymbol} was not found`, "warning");
    return;
  }

  currentStockObj = asset;
  currentStreamSymbol = getFinnhubStreamSymbol(asset.symbol, asset.type);

  try {
    const [quote, profile, peers] = await Promise.all([
      asset.getQuote(),
      asset.getProfile(),
      asset.getPeers()
    ]);

    const price = Number(quote?.price ?? asset.price ?? 0);

    const dayReferencePrice = Number(
      quote?.dayStart ??
      quote?.open ??
      quote?.prevClose ??
      price
    );

    AppState.current.currentSymbol = currentSymbol;
    AppState.current.currentQuote = {
      ...quote,
      price,
      dayReferencePrice,
      priceChangeAmount: price - dayReferencePrice,
      priceChangePercent:
        dayReferencePrice > 0
          ? ((price - dayReferencePrice) / dayReferencePrice) * 100
          : 0
    };
    AppState.current.currentProfile = profile;
    AppState.current.currentPeers = peers;

    renderQuote(AppState.current.currentQuote);
    renderProfile(profile);
    renderPeers(peers);

    await Promise.all([
      refreshChart(),
      loadAndRenderNews(asset.symbol)
    ]);
  } catch (err) {
    console.error("Could not display asset details:", err);
    showToast(`Could not load ${currentSymbol}`, "warning");
  }
}

function renderQuote(quote) {
  if (!quote) return;

  const stockSymbol = document.getElementById("stock-symbol");
  const stockPrice = document.getElementById("stock-price");
  const statOpen = document.getElementById("stat-open");
  const statHigh = document.getElementById("stat-high");
  const statLow = document.getElementById("stat-low");
  const statPrevClose = document.getElementById("stat-prev-close");

  if (stockSymbol) {
    stockSymbol.textContent = currentStockObj.symbol;
  }

  if (stockPrice) {
    stockPrice.dataset.amount = quote.price ?? "";
    stockPrice.textContent = formatPrice(quote.price);
  }

  if (statOpen) {
    statOpen.dataset.amount = quote.dayStart ?? quote.open ?? "";
  }

  if (statHigh) {
    statHigh.dataset.amount = quote.high ?? "";
  }

  if (statLow) {
    statLow.dataset.amount = quote.low ?? "";
  }

  if (statPrevClose) {
    statPrevClose.dataset.amount = quote.prevClose ?? "";
  }

  const positive = (quote.priceChangeAmount ?? 0) >= 0;

  const hero = document.getElementById("stock-hero");
  if (hero) {
    hero.classList.remove("trend-up", "trend-down");
    hero.classList.add(positive ? "trend-up" : "trend-down");
  }

  const movementSelector = document.querySelector(".movement-locator");
  if (!movementSelector) return;

  movementSelector.classList.remove("change-positive", "change-negative");
  movementSelector.classList.add(positive ? "change-positive" : "change-negative");

  const movementDirection = movementSelector.querySelector("#direction-locator");
  const movementPrice = movementSelector.querySelector(".price-locator");
  const movementPercent = movementSelector.querySelector(".percent-change-locator");

  if (movementDirection) {
    movementDirection.textContent = positive ? "+" : "-";
  }

  if (movementPrice) {
    movementPrice.dataset.amount = Math.abs(quote.priceChangeAmount ?? 0).toFixed(2);
    movementPrice.textContent = Math.abs(quote.priceChangeAmount ?? 0).toFixed(2);
  }

  if (movementPercent) {
    movementPercent.dataset.change = Math.abs(quote.priceChangePercent ?? 0).toFixed(2);
    movementPercent.textContent = `(${Math.abs(quote.priceChangePercent ?? 0).toFixed(2)}%)`;
  }

  viewCurrency();
  viewMovementStyle();
}

function renderProfile(profile) {
  if (!profile) return;

  currentName = profile.companyName || currentStockObj.name || currentSymbol;

  const stockName = document.getElementById("stock-name");
  const stockIndustry = document.getElementById("stock-industry");
  const statExchange = document.getElementById("stat-exchange");
  const statMarketCap = document.getElementById("stat-market-cap");
  const logo = document.getElementById("stock-logo");

  if (stockName) {
    stockName.textContent = profile.companyName || currentStockObj.name || "";
  }

  if (stockIndustry) {
    stockIndustry.textContent =
      profile.industry ||
      profile.sector ||
      currentStockObj.industry ||
      currentStockObj.sector ||
      "";
  }

  if (statExchange) {
    statExchange.textContent = profile.exchange || currentStockObj.exchange || "";
  }

  if (statMarketCap) {
    statMarketCap.textContent = formatMarketCap(profile.marketCap);
  }

  if (logo && (profile.image || profile.logo)) {
    logo.src = profile.image || profile.logo;
    logo.alt = profile.companyName || currentStockObj.name || currentSymbol;
    logo.onerror = () => logo.remove();
    logo.hidden = false;
  }

  updateButtonStates();
}

function renderPeers(peers = []) {
  const peersList = document.getElementById("peers-list");
  if (!peersList) return;

  peersList.innerHTML = "";

  const filtered = peers.filter(peer => peer && peer !== currentSymbol);

  if (filtered.length === 0) {
    const msg = document.createElement("p");
    msg.className = "text-muted";
    msg.textContent = "No peer data available.";
    peersList.appendChild(msg);
    return;
  }

  filtered.forEach(peer => {
    const a = document.createElement("a");
    a.href = `stock-details.html?symbol=${encodeURIComponent(peer)}`;
    a.className = "peer-card";
    a.textContent = peer;
    peersList.appendChild(a);
  });
}

async function loadAndRenderNews(symbol) {
  const newsList = document.getElementById("news-list");
  if (!newsList) return;

  newsList.innerHTML = '<p class="news-loading">Loading news…</p>';

  try {
    const articles = await getCompanyNews(symbol, currentStockObj.type);
    renderNews(articles);
  } catch (err) {
    console.error("Could not load news:", err);
    newsList.innerHTML = '<p class="text-muted news-empty">Could not load news.</p>';
  }
}

function renderNews(articles = []) {
  const newsList = document.getElementById("news-list");
  if (!newsList) return;

  newsList.innerHTML = "";

  if (!articles.length) {
    const msg = document.createElement("p");
    msg.className = "text-muted news-empty";
    msg.textContent = "No recent news available.";
    newsList.appendChild(msg);
    return;
  }

  articles.forEach(article => {
    const a = document.createElement("a");
    a.href = article.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "news-card";

    const date = article.datetime
      ? new Date(article.datetime * 1000)
      : null;

    const dateStr = date
      ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      })
      : "";

    a.innerHTML = `
      ${article.image
        ? `<img class="news-thumb" src="${article.image}" alt="" loading="lazy" onerror="this.style.display='none'">`
        : ""
      }
      <div class="news-content">
        <p class="news-headline">${article.headline}</p>
        <div class="news-meta">
          <span class="news-source">${article.source ?? ""}</span>
          <span class="news-date">${dateStr}</span>
        </div>
      </div>
    `;

    newsList.appendChild(a);
  });
}

async function renderIntradayCandleChart(symbol, interval = "5min") {
  const ctx = document.getElementById("stockChart");
  if (!ctx) return;

  try {
    const candles = await getIntradayChartData(symbol, interval);

    if (!candles.length) {
      showToast("No intraday chart data available", "warning");
      return;
    }

    const gaplessCandles = candles.map((candle, index) => {
      const label = candle.date ?? candle.label ?? "";

      let parsedTime = Date.parse(String(label).replace(" ", "T"));

      if (!Number.isFinite(parsedTime)) {
        parsedTime = Date.now() - ((candles.length - index) * getIntervalMs(interval));
      }

      return {
        x: index,
        label,
        time: parsedTime,
        o: Number(candle.o ?? candle.open),
        h: Number(candle.h ?? candle.high),
        l: Number(candle.l ?? candle.low),
        c: Number(candle.c ?? candle.close),
        v: Number(candle.v ?? candle.volume ?? 0)
      };
    });

    const visibleCandles = gaplessCandles.slice(-60);

    visibleCandles.forEach((candle, index) => {
      candle.x = index;
    });

    liveCandles = visibleCandles;
    liveCandleLabels = gaplessCandles.map(c => c.label);


    if (stockChart) {
      stockChart.destroy();
    }
    const candleLows = liveCandles.map(c => Number(c.l)).filter(Number.isFinite);
    const candleHighs = liveCandles.map(c => Number(c.h)).filter(Number.isFinite);

    const minPrice = Math.min(...candleLows);
    const maxPrice = Math.max(...candleHighs);
    const priceRange = maxPrice - minPrice || maxPrice * 0.001;
    const padding = priceRange * 0.15;
    stockChart = new Chart(ctx, {
      type: "candlestick",
      data: {
        datasets: [{
          label: `${symbol} ${interval} Candles`,
          data: visibleCandles
        }]
      },
      options: {
        responsive: true,
        parsing: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              title(items) {
                const candle = items[0]?.raw;
                return candle?.label || "";
              },
              label(context) {
                const candle = context.raw;
                return [
                  `Open: ${candle.o}`,
                  `High: ${candle.h}`,
                  `Low: ${candle.l}`,
                  `Close: ${candle.c}`,
                  `Volume: ${candle.v}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            type: "linear",
            ticks: {
              maxTicksLimit: 8,
              callback(value) {
                const candle = gaplessCandles[Math.round(value)];
                if (!candle?.label) return "";

                const date = new Date(candle.time);
                if (chartState.candleInterval === "1hour" || chartState.candleInterval === "4hour") {
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric"
                  });
                }

                return candle.label.slice(11, 16);
              }
            }
          },
          y: {
            position: "right",
            min: minPrice - padding,
            max: maxPrice + padding,
            ticks: {
              maxTicksLimit: 8
            }
          }
        }
      }
    });
  } catch (err) {
    console.error("Could not render intraday candle chart:", err);
    showToast("Could not load intraday chart", "warning");
  }
}

function connectStockSocket() {
  if (stockSocket || !currentStreamSymbol) return;

  stockSocket = new WebSocket(
    `wss://ws.finnhub.io?token=${CONFIG.API_KEY}`
  );

  stockSocket.addEventListener("open", () => {
    console.log("Finnhub stock details WebSocket opened.");
    socketLoggedIn = true;
    subscribeCurrentSymbol();
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
    console.error("Finnhub stock details websocket error:", event);
  });

  stockSocket.addEventListener("close", () => {
    console.warn("Finnhub stock details WebSocket closed.");
    stockSocket = null;
    socketLoggedIn = false;
  });
}

function handleSocketMessage(payload) {
  if (payload?.type === "ping") return;

  if (payload?.type === "error") {
    console.warn("Finnhub stock details websocket error:", payload);
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

function subscribeCurrentSymbol() {
  if (
    !stockSocket ||
    stockSocket.readyState !== WebSocket.OPEN ||
    !socketLoggedIn ||
    !currentStreamSymbol
  ) {
    return;
  }

  stockSocket.send(JSON.stringify({
    type: "subscribe",
    symbol: currentStreamSymbol
  }));

  console.log(`Stock details subscribed to ${currentStreamSymbol}`);
}

function unsubscribeCurrentSymbol() {
  if (
    !stockSocket ||
    stockSocket.readyState !== WebSocket.OPEN ||
    !socketLoggedIn ||
    !currentStreamSymbol
  ) {
    return;
  }

  stockSocket.send(JSON.stringify({
    type: "unsubscribe",
    symbol: currentStreamSymbol
  }));

  console.log(`Stock details unsubscribed from ${currentStreamSymbol}`);
}

function handleLiveQuote(trade) {
  const streamSymbol = trade?.s;
  const price = trade?.p;

  if (!streamSymbol || streamSymbol !== currentStreamSymbol || price == null) {
    return;
  }

  updateLiveQuote(Number(price));
  updateLiveCandle(trade);
}

function updateLiveQuote(price) {
  const quote = AppState.current?.currentQuote ?? {};

  const referencePrice = Number(
    quote.dayReferencePrice ??
    quote.dayStart ??
    quote.open ??
    quote.prevClose ??
    quote.price ??
    price
  );

  const changeAmount =
    referencePrice > 0
      ? price - referencePrice
      : 0;

  const changePercent =
    referencePrice > 0
      ? (changeAmount / referencePrice) * 100
      : 0;

  const stockPrice = document.getElementById("stock-price");

  if (stockPrice) {
    stockPrice.dataset.amount = String(price);
  }

  const positive = changeAmount >= 0;

  const hero = document.getElementById("stock-hero");
  if (hero) {
    hero.classList.remove("trend-up", "trend-down");
    hero.classList.add(positive ? "trend-up" : "trend-down");
  }

  const movementSelector = document.querySelector(".movement-locator");
  if (movementSelector) {
    movementSelector.classList.remove("change-positive", "change-negative");
    movementSelector.classList.add(positive ? "change-positive" : "change-negative");

    const movementDirection = movementSelector.querySelector("#direction-locator");
    const movementPrice = movementSelector.querySelector(".price-locator");
    const movementPercent = movementSelector.querySelector(".percent-change-locator");

    if (movementDirection) {
      movementDirection.textContent = positive ? "+" : "-";
    }

    if (movementPrice) {
      movementPrice.dataset.amount = Math.abs(changeAmount).toFixed(2);
    }

    if (movementPercent) {
      movementPercent.dataset.change = Math.abs(changePercent).toFixed(2);
      movementPercent.textContent = `(${Math.abs(changePercent).toFixed(2)}%)`;
    }
  }

  AppState.current.currentQuote = {
    ...quote,
    price,
    dayReferencePrice: referencePrice,
    priceChangeAmount: changeAmount,
    priceChangePercent: changePercent
  };

  viewCurrency();
  viewMovementStyle();
}

function cleanupSocket() {
  unsubscribeCurrentSymbol();

  if (stockSocket) {
    stockSocket.close();
    stockSocket = null;
  }

  socketLoggedIn = false;
}

function updateButtonStates() {
  if (!currentStockObj) return;

  const user = getCurrentUser();
  if (!user) return;

  const symbol = currentStockObj.symbol;

  const inPortfolio = user.portfolio.has(symbol);
  const inWatchlist = user.watchlist.has(symbol);

  const btnPortfolio = document.getElementById("btn-portfolio");
  const btnWatchlist = document.getElementById("btn-watchlist");

  const btnBuy = document.getElementById("btn-buy");
const btnSell = document.getElementById("btn-sell");

if (btnBuy) {
  btnBuy.disabled = false;
  btnBuy.textContent = inPortfolio ? "Buy More" : "Buy";
}

if (btnSell) {
  btnSell.disabled = !inPortfolio;
  btnSell.classList.toggle("btn-disabled", !inPortfolio);
}

  if (btnWatchlist) {
    btnWatchlist.disabled = inWatchlist;
    btnWatchlist.textContent = inWatchlist ? "Watching" : "Add to Watchlist";
    btnWatchlist.classList.toggle("btn-disabled", inWatchlist);
  }
}

function openPortfolioPopup(mode) {
  if (!currentSymbol || !currentStockObj) return;

  portfolioActionMode = mode;

  const popupTitle = document.querySelector("#portfolio-popup-title");
  const popupSubmit = document.querySelector("#btn-add-portfolio");

  if (popupTitle) {
    popupTitle.textContent = mode === "buy"
      ? `Buy ${currentSymbol}`
      : `Sell ${currentSymbol}`;
  }

  if (popupSubmit) {
    popupSubmit.textContent = mode === "buy"
      ? "Confirm Buy"
      : "Confirm Sell";
  }

  if (numShares) numShares.value = "";
  if (priceBought) priceBought.value = "";

  portfolioQuestionsContainer?.classList.remove("invisible");
}

function handleConfirmPortfolioAction() {
  if (!currentStockObj) return;

  const shares = Number(numShares?.value);
  const price = Number(priceBought?.value);

  if (!Number.isFinite(shares) || shares <= 0) {
    showToast("Enter a valid number of shares", "warning");
    return;
  }

  if (!Number.isFinite(price) || price <= 0) {
    showToast("Enter a valid price", "warning");
    return;
  }

  const user = getCurrentUser();
  if (!user) return;

  let success = false;

  if (portfolioActionMode === "buy") {
    success = user.buyAsset(currentStockObj, shares, price);

    if (!success) {
      showToast("Could not buy asset", "warning");
      return;
    }

    showToast(`${shares} shares of ${currentSymbol} bought`, "success");
  }

  if (portfolioActionMode === "sell") {
    success = user.sellAsset(currentStockObj, shares, price);

    if (!success) {
      showToast("Could not sell asset. Check your share amount.", "warning");
      return;
    }

    showToast(`${shares} shares of ${currentSymbol} sold`, "success");
  }

  persistUser();

  if (numShares) numShares.value = "";
  if (priceBought) priceBought.value = "";

  portfolioQuestionsContainer?.classList.add("invisible");

  updateButtonStates();
}

function handleAddToWatchlist() {
  if (!currentSymbol || !currentStockObj) return;

  const user = getCurrentUser();
  if (!user) return;

  const added = user.addToWatchlist(currentStockObj);

  if (!added) {
    showToast(`${currentSymbol} is already in your watchlist`, "warning");
    return;
  }

  persistUser();

  updateButtonStates();
  showToast(`${currentSymbol} added to watchlist`, "success");
}

function bindPageEvents() {
  btnClose = document.querySelector("#btn-close-portfolio");
  btnAdd = document.querySelector("#btn-add-portfolio");
  numShares = document.querySelector("#numShares");
  priceBought = document.querySelector("#priceBought");
  portfolioQuestionsContainer = document.querySelector(".portfolio-popup-container");

  const buyButton = document.querySelector("#btn-buy");
const sellButton = document.querySelector("#btn-sell");
const addToWatchlist = document.querySelector("#btn-watchlist");

buyButton?.addEventListener("click", () => openPortfolioPopup("buy"));
sellButton?.addEventListener("click", () => openPortfolioPopup("sell"));
addToWatchlist?.addEventListener("click", handleAddToWatchlist);
btnAdd?.addEventListener("click", handleConfirmPortfolioAction);

  btnClose?.addEventListener("click", () => {
    portfolioQuestionsContainer?.classList.add("invisible");
  });

  bindChartControls();
}

function formatDateForApi(date) {
  return date.toISOString().slice(0, 10);
}

function getHistoricalRangeDates(range) {
  const to = new Date();
  const from = new Date();

  switch (range) {
    case "1D":
      from.setDate(to.getDate() - 1);
      break;
    case "1W":
      from.setDate(to.getDate() - 7);
      break;
    case "1M":
      from.setMonth(to.getMonth() - 1);
      break;
    case "3M":
      from.setMonth(to.getMonth() - 3);
      break;
    case "1Y":
      from.setFullYear(to.getFullYear() - 1);
      break;
    case "YTD":
      from.setMonth(0);
      from.setDate(1);
      break;
  }

  return {
    from: formatDateForApi(from),
    to: formatDateForApi(to)
  };
}

async function refreshChart() {
  if (!currentSymbol) return;

  if (chartState.mode === "candlestick") {
    await renderIntradayCandleChart(currentSymbol, chartState.candleInterval);
  } else {
    await renderHistoricalChart(
      currentSymbol,
      chartState.historicalRange,
      chartState.fromDate,
      chartState.toDate
    );
  }
}

async function renderHistoricalChart(symbol, range = "1M", fromDate = null, toDate = null) {
  const ctx = document.getElementById("stockChart");
  if (!ctx) return;

  try {
    const dates = fromDate && toDate
      ? { from: fromDate, to: toDate }
      : getHistoricalRangeDates(range);

    const prices = await getHistoricalChartData(symbol, dates.from, dates.to);

    if (!prices.length) {
      showToast("No historical chart data available", "warning");
      return;
    }

    const orderedPrices = prices.slice().reverse();

    const labels = orderedPrices.map(point => point.date);

    const closePrices = orderedPrices
      .map(point => Number(point.close))
      .filter(price => Number.isFinite(price));

    if (stockChart) {
      stockChart.destroy();
    }

    stockChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: `${symbol} Historical Price`,
          data: closePrices,
          tension: 0,
          pointRadius: 0,
          borderWidth: 2,
          fill: false
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label(context) {
                return `Close: ${formatPrice(context.raw)}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 8
            }
          },
          y: {
            position: "right"
          }
        }
      }
    });
  } catch (err) {
    console.error("Could not render historical chart:", err);
    showToast("Could not load historical chart", "warning");
  }
}

function bindChartControls() {
  const modeButtons = document.querySelectorAll("[data-chart-mode]");
  const historicalControls = document.getElementById("historical-controls");
  const candlestickControls = document.getElementById("candlestick-controls");

  const historicalRangeButtons = document.querySelectorAll("[data-range]");
  const candleIntervalButtons = document.querySelectorAll("[data-interval]");

  const customRangeButton = document.getElementById("btn-custom-range");
  const customRangeControls = document.getElementById("custom-range-controls");
  const fromDateInput = document.getElementById("chart-from-date");
  const toDateInput = document.getElementById("chart-to-date");
  const applyCustomRangeButton = document.getElementById("btn-apply-custom-range");

  modeButtons.forEach(button => {
    button.addEventListener("click", async () => {
      const mode = button.dataset.chartMode;

      chartState.mode = mode;

      modeButtons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      historicalControls?.classList.toggle("invisible", mode !== "historical");
      candlestickControls?.classList.toggle("invisible", mode !== "candlestick");

      await refreshChart();
    });
  });

  historicalRangeButtons.forEach(button => {
    button.addEventListener("click", async () => {
      chartState.historicalRange = button.dataset.range;
      chartState.fromDate = null;
      chartState.toDate = null;

      historicalRangeButtons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      customRangeControls?.classList.add("invisible");

      await refreshChart();
    });
  });

  candleIntervalButtons.forEach(button => {
    button.addEventListener("click", async () => {
      chartState.candleInterval = button.dataset.interval;

      candleIntervalButtons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      await refreshChart();
    });
  });

  customRangeButton?.addEventListener("click", () => {
    customRangeControls?.classList.toggle("invisible");
  });

  applyCustomRangeButton?.addEventListener("click", async () => {
    const from = fromDateInput?.value;
    const to = toDateInput?.value;

    if (!from || !to) {
      showToast("Choose both a from and to date", "warning");
      return;
    }

    if (new Date(from) > new Date(to)) {
      showToast("From date must be before to date", "warning");
      return;
    }

    chartState.fromDate = from;
    chartState.toDate = to;

    historicalRangeButtons.forEach(btn => btn.classList.remove("active"));

    await refreshChart();
  });
}

function syncChartControlsToState() {
  document.querySelectorAll("[data-range]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.range === chartState.historicalRange
    );
  });

  document.querySelectorAll("[data-interval]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.interval === chartState.candleInterval
    );
  });

  document.querySelectorAll("[data-chart-mode]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.chartMode === chartState.mode
    );
  });
}

window.onload = async function () {
  await AppState.hydrate();

  if (!AppState.current) return;

  chartState.candleInterval = AppState.current.user.settings.intervalChartRange;
  chartState.historicalRange = AppState.current.user.settings.chartRange;

  bindPageEvents();
  syncChartControlsToState();

  await displaySymbolDetails();
  connectStockSocket();

  onLoad();
};

function getIntervalMs(interval) {
  switch (interval) {
    case "1min": return 60_000;
    case "5min": return 5 * 60_000;
    case "15min": return 15 * 60_000;
    case "30min": return 30 * 60_000;
    case "1hour": return 60 * 60_000;
    case "4hour": return 4 * 60 * 60_000;
    default: return 5 * 60_000;
  }
}

function getCandleBucketTime(timestamp, interval) {
  const intervalMs = getIntervalMs(interval);
  return Math.floor(timestamp / intervalMs) * intervalMs;
}

function updateLiveCandle(trade) {
  if (
    chartState.mode !== "candlestick" ||
    !stockChart ||
    !Array.isArray(liveCandles)
  ) {
    return;
  }

  const price = Number(trade?.p);
  const volume = Number(trade?.v ?? 0);
  const timestamp = Number(trade?.t);
  if (
    !Number.isFinite(price) ||
    !Number.isFinite(timestamp)
  ) {
    return;
  }

  const bucketTime = getCandleBucketTime(
    timestamp,
    chartState.candleInterval
  );

  const bucketLabel = new Date(bucketTime)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);

  const lastCandle = liveCandles[liveCandles.length - 1];

  if (!lastCandle) return;

  const lastCandleTime = Number(lastCandle.time);

  if (!Number.isFinite(lastCandleTime)) {
    console.log("Bad last candle time:", lastCandle);
    return;
  }

  const lastBucketTime = getCandleBucketTime(
    lastCandleTime,
    chartState.candleInterval
  );
  if (bucketTime === lastBucketTime) {
    lastCandle.h = Math.max(Number(lastCandle.h), price);
    lastCandle.l = Math.min(Number(lastCandle.l), price);
    lastCandle.c = price;
    lastCandle.v = Number(lastCandle.v ?? 0) + volume;
  } else if (bucketTime > lastBucketTime) {
    liveCandles.push({
      x: liveCandles.length,
      label: bucketLabel,
      time: bucketTime,
      o: price,
      h: price,
      l: price,
      c: price,
      v: volume
    });
  } else {
    return;
  }

  liveCandles.forEach((candle, index) => {
    candle.x = index;
  });

  stockChart.data.datasets[0].data =
    [...liveCandles];

  stockChart.update("none");
}

window.addEventListener("beforeunload", () => {
  persistUser();
  cleanupSocket();
});