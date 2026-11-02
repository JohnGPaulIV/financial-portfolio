import { onLoad, viewCurrency, viewMovementStyle } from "../initPage.js";
import { showCard } from "./card-creator.js";
import {
    getTopGainers,
    getTopLosers,
    getTopTraded,
    getHistoricalPricesFMP
} from "../api.js";

import { AppState } from "../state/astate.js";
import { CONFIG } from "../../config.js";

const MOBILE_BREAKPOINT = 600;
const SWIPE_THRESHOLD_PX = 45;

const TOP_GAINERS = "#top-gainer-grid";
const TOP_LOSERS = "#top-losers-grid";
const TOP_TRADED = "#top-traded-grid";

let stockSocket = null;
let rowObserver = null;
let socketLoggedIn = false;

const visibleSymbols = new Set();
const subscribedSymbols = new Set();

const inMobileViewport = () =>
    window.innerWidth <= MOBILE_BREAKPOINT;

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

const getSlides = grid =>
    Array.from(grid.children)
        .filter(node => node instanceof HTMLElement);

const getSectionLabel = (section, fallback = "carousel") => {
    const labelledBy = section.getAttribute("aria-labelledby");

    if (labelledBy) {
        const heading = document.getElementById(labelledBy);

        if (heading?.textContent) {
            return heading.textContent.trim();
        }
    }

    return fallback;
};

const moveToIndex = (state, index) => {
    if (!state.slides.length) {
        state.currentIndex = 0;
        return;
    }

    const bounded =
        ((index % state.slides.length) + state.slides.length) %
        state.slides.length;

    state.currentIndex = bounded;

    if (inMobileViewport()) {
        const nextSlide = state.slides[bounded];

        state.grid.scrollTo({
            left: nextSlide.offsetLeft,
            behavior: "smooth"
        });
    }

    state.dotButtons.forEach((dot, dotIndex) => {
        const isCurrent = dotIndex === bounded;

        dot.setAttribute("aria-current", String(isCurrent));
        dot.setAttribute("aria-selected", String(isCurrent));
    });
};

const buildDots = state => {
    state.dotsContainer.textContent = "";
    state.dotButtons = [];

    const label = getSectionLabel(state.section, "stock cards");

    state.slides.forEach((_, index) => {
        const dot = document.createElement("button");

        dot.type = "button";
        dot.className = "stock-carousel__dot";
        dot.setAttribute("role", "tab");
        dot.setAttribute("aria-label", `Go to ${label} card ${index + 1}`);
        dot.setAttribute("aria-current", "false");
        dot.setAttribute("aria-selected", "false");

        dot.addEventListener("click", () =>
            moveToIndex(state, index)
        );

        state.dotsContainer.appendChild(dot);
        state.dotButtons.push(dot);
    });
};

const updateControlsVisibility = state => {
    const shouldShowControls =
        inMobileViewport() &&
        state.slides.length > 1;

    state.controls.classList.toggle(
        "is-hidden",
        !shouldShowControls
    );
};

const syncFromScroll = state => {
    if (!state.slides.length || !inMobileViewport()) {
        return;
    }

    const midpoint =
        state.grid.scrollLeft +
        state.grid.clientWidth / 2;

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    state.slides.forEach((slide, index) => {
        const slideCenter =
            slide.offsetLeft + slide.clientWidth / 2;

        const distance =
            Math.abs(slideCenter - midpoint);

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
        }
    });

    if (nearestIndex !== state.currentIndex) {
        state.currentIndex = nearestIndex;

        state.dotButtons.forEach((dot, index) => {
            const isCurrent = index === nearestIndex;

            dot.setAttribute("aria-current", String(isCurrent));
            dot.setAttribute("aria-selected", String(isCurrent));
        });
    }
};

const bindSwipe = state => {
    let startX = 0;
    let startY = 0;

    state.grid.addEventListener(
        "touchstart",
        event => {
            if (!event.changedTouches.length) return;

            startX = event.changedTouches[0].clientX;
            startY = event.changedTouches[0].clientY;
        },
        { passive: true }
    );

    state.grid.addEventListener(
        "touchend",
        event => {
            if (
                !event.changedTouches.length ||
                !inMobileViewport() ||
                state.slides.length < 2
            ) {
                return;
            }

            const endX = event.changedTouches[0].clientX;
            const endY = event.changedTouches[0].clientY;

            const deltaX = endX - startX;
            const deltaY = endY - startY;

            if (
                Math.abs(deltaX) < SWIPE_THRESHOLD_PX ||
                Math.abs(deltaY) > Math.abs(deltaX)
            ) {
                return;
            }

            moveToIndex(
                state,
                deltaX < 0
                    ? state.currentIndex + 1
                    : state.currentIndex - 1
            );
        },
        { passive: true }
    );
};

const setupSection = section => {
    const grid =
        section.querySelector(".stock-card-grid");

    const controls =
        section.querySelector(".stock-carousel__controls");

    const prevButton =
        section.querySelector("[data-carousel-prev]");

    const nextButton =
        section.querySelector("[data-carousel-next]");

    const dotsContainer =
        section.querySelector("[data-carousel-dots]");

    if (
        !grid ||
        !controls ||
        !prevButton ||
        !nextButton ||
        !dotsContainer
    ) {
        return;
    }

    const state = {
        section,
        grid,
        controls,
        prevButton,
        nextButton,
        dotsContainer,
        slides: [],
        dotButtons: [],
        currentIndex: 0
    };

    const refresh = () => {
        state.slides = getSlides(state.grid);

        state.currentIndex = state.slides.length
            ? Math.min(state.currentIndex, state.slides.length - 1)
            : 0;

        buildDots(state);
        updateControlsVisibility(state);
        moveToIndex(state, state.currentIndex);
    };

    prevButton.addEventListener("click", () =>
        moveToIndex(state, state.currentIndex - 1)
    );

    nextButton.addEventListener("click", () =>
        moveToIndex(state, state.currentIndex + 1)
    );

    grid.addEventListener(
        "scroll",
        () => syncFromScroll(state),
        { passive: true }
    );

    grid.addEventListener("keydown", event => {
        if (
            !inMobileViewport() ||
            state.slides.length < 2
        ) {
            return;
        }

        if (event.key === "ArrowRight") {
            event.preventDefault();
            moveToIndex(state, state.currentIndex + 1);
        } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            moveToIndex(state, state.currentIndex - 1);
        }
    });

    bindSwipe(state);

    const observer = new MutationObserver(() => refresh());

    observer.observe(grid, {
        childList: true
    });

    window.addEventListener("resize", () => {
        updateControlsVisibility(state);
        moveToIndex(state, state.currentIndex);
    });

    refresh();
};

const initHomeCarousels = () => {
    const sections = document.querySelectorAll(
        "[data-carousel-section]"
    );

    sections.forEach(section =>
        setupSection(section)
    );
};

function buildSparklinePoints(prices) {
    if (!prices?.length) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const W = 300, H = 180, PAD = 10;
    return prices.map((price, i) => {
        const x = prices.length > 1 ? (i / (prices.length - 1)) * W : W / 2;
        const y = PAD + ((max - price) / range) * (H - PAD * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
}

async function buildAssetCard(symbol) {
    const asset = AppState.current.getAsset(symbol);

    if (!asset) return null;

    try {
        const [quote, profile, history] = await Promise.all([
            asset.getQuote(),
            asset.getProfile(),
            getHistoricalPricesFMP(asset.symbol, 7).catch(() => null)
        ]);

        const price = Number(quote?.price ?? asset.price ?? 0);

        const dayReferencePrice = Number(
            quote?.dayStart ??
            quote?.open ??
            quote?.prevClose ??
            price
        );

        const priceChangeAmount =
            price - dayReferencePrice;

        const priceChangePercent =
            dayReferencePrice > 0
                ? (priceChangeAmount / dayReferencePrice) * 100
                : 0;

        const chartPoints = history?.length
            ? buildSparklinePoints(
                [...history].reverse().map(d => d.close ?? d.adjClose ?? 0)
              )
            : null;

        return {
            ...asset,
            ...quote,
            ...profile,

            ticker: asset.symbol,
            symbol: asset.symbol,
            streamSymbol: getFinnhubStreamSymbol(asset.symbol, asset.type),

            companyName:
                profile?.companyName ??
                asset.name,

            type: asset.type,
            price,

            dayReferencePrice,
            priceChangeAmount,
            priceChangePercent,
            chartPoints
        };
    } catch (err) {
        console.error(`Could not build card for ${symbol}:`, err);
        return null;
    }
}

function markNewestCard(gridSelector, stock) {
    const grid = document.querySelector(gridSelector);
    const card = grid?.lastElementChild;

    if (!card || !stock?.symbol) return;

    card.classList.add("live-stock-card");
    card.dataset.ticker = stock.symbol.toUpperCase();
    card.dataset.streamSymbol = stock.streamSymbol;
    card.dataset.lastPrice = stock.price ?? "";
    card.dataset.dayReferencePrice = stock.dayReferencePrice ?? "";

    const priceEl = card.querySelector("#stock-card__curr-price .price-locator");

    if (priceEl) {
        priceEl.dataset.amount = String(stock.price ?? 0);
    }
}

async function loadMarketSection({
    apiFn,
    count,
    gridSelector
}) {
    try {
        const raw = await apiFn(count);

        if (!raw?.length) return;

        const symbols = raw
            .map(item => item.symbol)
            .filter(Boolean);

        const cards = await Promise.all(
            symbols.map(symbol =>
                buildAssetCard(symbol)
            )
        );

        cards
            .filter(Boolean)
            .forEach(stock => {
                showCard({
                    appendGrid: gridSelector,
                    stock
                });

                markNewestCard(gridSelector, stock);
            });

    } catch (err) {
        console.error(
            `Could not load section ${gridSelector}:`,
            err
        );
    }
}

function observeVisibleCards() {
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
        .querySelectorAll(".live-stock-card")
        .forEach(card => rowObserver.observe(card));
}

function connectStockSocket() {
    if (stockSocket) return;

    stockSocket = new WebSocket(
        `wss://ws.finnhub.io?token=${CONFIG.API_KEY}`
    );

    stockSocket.addEventListener("open", () => {
        console.log("Finnhub home WebSocket opened.");
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
        console.error("Finnhub home websocket error:", event);
    });

    stockSocket.addEventListener("close", () => {
        console.warn("Finnhub home WebSocket closed.");
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
        console.warn("Finnhub home websocket error:", payload);
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
        console.log(`Home subscribed to ${symbol}`);
    });

    toUnsubscribe.forEach(symbol => {
        stockSocket.send(JSON.stringify({
            type: "unsubscribe",
            symbol
        }));

        subscribedSymbols.delete(symbol);
        console.log(`Home unsubscribed from ${symbol}`);
    });
}

function handleLiveQuote(trade) {
    const streamSymbol = trade?.s;
    const price = trade?.p;

    if (!streamSymbol || price == null) return;

    document
        .querySelectorAll(".live-stock-card")
        .forEach(card => {
            if (card.dataset.streamSymbol === streamSymbol) {
                updateLiveCard(card, Number(price));
            }
        });
}

function updateLiveCard(card, price) {
    const referencePrice = Number(
        card.dataset.dayReferencePrice ??
        card.dataset.lastPrice
    );

    card.dataset.lastPrice = String(price);

    const priceSpan = card.querySelector(
        "#stock-card__curr-price .price-locator"
    );

    if (priceSpan) {
        priceSpan.dataset.amount = String(price);
    }

    const changeAmount =
        referencePrice > 0
            ? price - referencePrice
            : 0;

    const changePercent =
        referencePrice > 0
            ? (changeAmount / referencePrice) * 100
            : 0;

    const positive = changeAmount >= 0;
    const direction = positive ? "up" : "down";

    const changeContainer = card.querySelector(
        "#stock-card__curr-price-change"
    );

    const directionSpan = changeContainer?.querySelector(
        ".direction-locator"
    );

    const changePriceSpan = changeContainer?.querySelector(
        ".price-locator"
    );

    const percentSpan = changeContainer?.querySelector(
        ".percent-change-locator"
    );

    if (changeContainer) {
        changeContainer.classList.remove("up", "down");
        changeContainer.classList.add(direction);
    }

    if (directionSpan) {
        directionSpan.textContent = positive ? "+" : "-";
    }

    if (changePriceSpan) {
        changePriceSpan.dataset.amount = String(Math.abs(changeAmount));
    }

    if (percentSpan) {
        percentSpan.dataset.change = String(Math.abs(changePercent));
        percentSpan.textContent = `(${Math.abs(changePercent).toFixed(2)}%)`;
    }

    const polyline = card.querySelector(".stock-card__chart polyline");

    if (polyline) {
        polyline.style.stroke =
            direction === "down"
                ? "var(--card-down)"
                : "var(--card-up)";
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
        return;
    }

    initHomeCarousels();

    await Promise.all([
        loadMarketSection({
            apiFn: getTopGainers,
            count: 3,
            gridSelector: TOP_GAINERS
        }),

        loadMarketSection({
            apiFn: getTopLosers,
            count: 3,
            gridSelector: TOP_LOSERS
        }),

        loadMarketSection({
            apiFn: getTopTraded,
            count: 3,
            gridSelector: TOP_TRADED
        })
    ]);

    observeVisibleCards();
    connectStockSocket();

    onLoad();
};

window.addEventListener("beforeunload", cleanupSocket);