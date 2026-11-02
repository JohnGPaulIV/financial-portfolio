import { onLoad, viewCurrency, viewMovementStyle } from "../initPage.js";
import { moneyAttrs } from "../utils/formatting.js";
import { AppState } from "../state/astate.js";
import { getTopTraded, getTopGainers } from "../api.js";
import { CONFIG } from "../../config.js";

let stockSocket = null;
let rowObserver = null;
let socketLoggedIn = false;

const visibleSymbols = new Set();
const subscribedSymbols = new Set();

function formatPrice(price) {
    if (price == null || Number.isNaN(Number(price))) return "—";
    return `$${Number(price).toFixed(2)}`;
}

function formatChangePct(pct) {
    if (pct == null || Number.isNaN(Number(pct))) return "—";

    const n = Number(pct);
    return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
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

function createExploreRow({
    symbol,
    name,
    price,
    changePct,
    high,
    low,
    type = "stock"
}) {
    const row = document.createElement("div");

    row.className = "watchlist-row explore-row";
    row.dataset.ticker = symbol.toUpperCase();
    row.dataset.type = type;
    row.dataset.streamSymbol = getFinnhubStreamSymbol(symbol, type);
    row.dataset.lastPrice = price ?? "";

    const positive = Number(changePct ?? 0) >= 0;
    const changeClass = positive ? "up" : "down";

    row.innerHTML = `
        <div class="watchlist-row__logo watchlist-row__logo--placeholder"></div>

        <div class="watchlist-row__identity">
            <span class="watchlist-row__ticker">${symbol}</span>
            <span class="watchlist-row__name">${name ?? ""}</span>
        </div>

        <span
            class="watchlist-row__price price-locator"
            ${moneyAttrs(price)}
        >
            ${formatPrice(price)}
        </span>

        <span class="watchlist-row__change ${changeClass} movement-locator">
            <span
                class="percent-change-locator"
                data-change="${changePct ?? 0}"
            >
                ${formatChangePct(changePct)}
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
    `;

    row.addEventListener("click", () => {
        window.location.href =
            `stock-details.html?symbol=${encodeURIComponent(symbol)}&type=${encodeURIComponent(type)}`;
    });

    return row;
}

function renderGrid(gridId, assets, emptyMsg) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    grid.innerHTML = "";

    if (!assets || assets.length === 0) {
        grid.innerHTML = `<p class="mini-card-empty">${emptyMsg}</p>`;
        return;
    }

    grid.innerHTML = `
        <div class="watchlist-header explore-header">
            <div class="watchlist-header__logo"></div>
            <span class="watchlist-header__col watchlist-header__col--symbol">Symbol</span>
            <span class="watchlist-header__col watchlist-header__col--price">Price</span>
            <span class="watchlist-header__col watchlist-header__col--change">Change</span>
            <span class="watchlist-header__col watchlist-header__col--high">High</span>
            <span class="watchlist-header__col watchlist-header__col--low">Low</span>
        </div>
    `;

    assets.forEach(asset => {
        grid.appendChild(createExploreRow(asset));
    });
}

function normalizeMarketItem(item) {
    return {
        symbol: item.symbol,
        name: item.name,
        price: item.price,
        changePct: item.changesPercentage,
        high: item.dayHigh,
        low: item.dayLow,
        type: item.type ?? "stock"
    };
}

function normalizeAssetWithQuote(asset, quote) {
    return {
        symbol: asset.symbol,
        name: asset.name,
        price: quote?.price,
        changePct: quote?.priceChangePercent,
        high: quote?.high,
        low: quote?.low,
        type: asset.type
    };
}

function getUserHoldingSymbols() {
    const user = AppState.current?.user;

    if (!user) {
        return {
            watchlistSymbols: [],
            portfolioSymbols: []
        };
    }

    return {
        watchlistSymbols: user.watchlist.all().map(item => item.symbol).filter(Boolean),
        portfolioSymbols: user.portfolio.all().map(item => item.symbol).filter(Boolean)
    };
}

async function getRelatedStocks() {
    const state = AppState.current;
    const user = state?.user;

    if (!state || !user) return [];

    const { watchlistSymbols, portfolioSymbols } = getUserHoldingSymbols();

    const sourceSymbols = [
        ...new Set([
            ...watchlistSymbols,
            ...portfolioSymbols
        ])
    ].slice(0, 5);

    if (sourceSymbols.length === 0) return null;

    const sourceAssets = sourceSymbols
        .map(symbol => state.getAsset(symbol))
        .filter(Boolean);

    if (sourceAssets.length === 0) return [];

    const peersArrays = await Promise.all(
        sourceAssets.map(asset => asset.getPeers().catch(() => []))
    );

    const ownedSet = new Set([
        ...watchlistSymbols,
        ...portfolioSymbols
    ]);

    const peerSymbols = [
        ...new Set(peersArrays.flat())
    ]
        .filter(symbol => symbol && !ownedSet.has(symbol))
        .slice(0, 8);

    if (peerSymbols.length === 0) return [];

    const peerAssets = peerSymbols
        .map(symbol => state.getAsset(symbol))
        .filter(Boolean);

    return Promise.all(
        peerAssets.map(async asset => {
            try {
                const quote = await asset.getQuote();
                return normalizeAssetWithQuote(asset, quote);
            } catch {
                return {
                    symbol: asset.symbol,
                    name: asset.name,
                    price: asset.price,
                    changePct: null,
                    high: null,
                    low: null,
                    type: asset.type
                };
            }
        })
    );
}

function observeVisibleRows() {
    if (rowObserver) {
        rowObserver.disconnect();
    }

    visibleSymbols.clear();

    rowObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const streamSymbol = entry.target.dataset.streamSymbol;

            if (!streamSymbol) return;

            if (entry.isIntersecting) {
                visibleSymbols.add(streamSymbol);
            } else {
                visibleSymbols.delete(streamSymbol);
            }
        });

        syncVisibleSubscriptions();
    }, {
        threshold: 0.25
    });

    document
        .querySelectorAll(".explore-row")
        .forEach(row => rowObserver.observe(row));
}

function connectStockSocket() {
    if (stockSocket && stockSocket.readyState === WebSocket.OPEN) {
        return;
    }

    stockSocket = new WebSocket(
        `wss://ws.finnhub.io?token=${CONFIG.API_KEY}`
    );

    stockSocket.addEventListener("open", () => {
        console.log("Finnhub WebSocket opened.");
        socketLoggedIn = true;
        syncVisibleSubscriptions();
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
        console.error("Finnhub WebSocket error:", event);
    });

    stockSocket.addEventListener("close", () => {
        console.warn("Finnhub WebSocket closed.");
        stockSocket = null;
        socketLoggedIn = false;
        subscribedSymbols.clear();
    });
}

function handleSocketMessage(payload) {
    if (payload?.type === "ping") {
        return;
    }

    if (payload?.type === "error") {
        console.warn("Finnhub websocket error:", payload);
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

function syncVisibleSubscriptions() {
    if (
        !stockSocket ||
        stockSocket.readyState !== WebSocket.OPEN ||
        !socketLoggedIn
    ) {
        return;
    }

    const toSubscribe = [...visibleSymbols]
        .filter(symbol => !subscribedSymbols.has(symbol));

    const toUnsubscribe = [...subscribedSymbols]
        .filter(symbol => !visibleSymbols.has(symbol));

    toSubscribe.forEach(symbol => {
        stockSocket.send(JSON.stringify({
            type: "subscribe",
            symbol
        }));

        subscribedSymbols.add(symbol);
        console.log(`Subscribed to ${symbol}`);
    });

    toUnsubscribe.forEach(symbol => {
        stockSocket.send(JSON.stringify({
            type: "unsubscribe",
            symbol
        }));

        subscribedSymbols.delete(symbol);
        console.log(`Unsubscribed from ${symbol}`);
    });
}

function handleLiveQuote(trade) {
    const streamSymbol = trade?.s;
    const price = trade?.p;

    if (!streamSymbol || price == null) return;

    document
        .querySelectorAll(".explore-row")
        .forEach(row => {
            if (row.dataset.streamSymbol === streamSymbol) {
                updateExploreRow(row, Number(price), trade);
            }
        });
}

function updateExploreRow(row, price) {
    const previousPrice = Number(row.dataset.lastPrice);
    const hasPrevious =
        Number.isFinite(previousPrice) &&
        previousPrice > 0;

    row.dataset.lastPrice = String(price);

    const priceEl = row.querySelector(".watchlist-row__price");

    if (priceEl) {
        priceEl.dataset.amount = String(price);
    }

    if (hasPrevious) {
        const changeAmount = price - previousPrice;
        const changePct = (changeAmount / previousPrice) * 100;
        const positive = changeAmount >= 0;

        const changeEl = row.querySelector(".watchlist-row__change");
        const percentEl = row.querySelector(".percent-change-locator");

        if (changeEl) {
            changeEl.classList.toggle("up", positive);
            changeEl.classList.toggle("down", !positive);
        }

        if (percentEl) {
            percentEl.dataset.change = String(Math.abs(changePct));
            percentEl.textContent = formatChangePct(changePct);
        }
    }

    viewCurrency();
    viewMovementStyle();
}

function cleanupSocket() {
    if (rowObserver) {
        rowObserver.disconnect();
        rowObserver = null;
    }

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
    visibleSymbols.clear();
    subscribedSymbols.clear();
}

window.onload = async function () {
    await AppState.hydrate();

    if (!AppState.current) {
        window.location.replace("login.html");
        return;
    }

    const [hotRaw, risingRaw, related] = await Promise.all([
        getTopTraded(8).catch(() => []),
        getTopGainers(8).catch(() => []),
        getRelatedStocks().catch(() => [])
    ]);

    renderGrid(
        "hot-grid",
        hotRaw.map(normalizeMarketItem),
        "Could not load hot stocks."
    );

    renderGrid(
        "rising-grid",
        risingRaw.map(normalizeMarketItem),
        "Could not load rising stocks."
    );

    if (related === null) {
        const grid = document.getElementById("related-grid");

        if (grid) {
            grid.innerHTML = `
                <p class="mini-card-empty">
                    Add stocks to your watchlist or portfolio to see personalized recommendations.
                </p>
            `;
        }
    } else {
        renderGrid(
            "related-grid",
            related,
            "No related stocks found."
        );
    }

    observeVisibleRows();
    connectStockSocket();

    onLoad();
};

window.addEventListener("beforeunload", cleanupSocket);