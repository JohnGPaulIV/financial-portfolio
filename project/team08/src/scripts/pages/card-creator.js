import { Card, CARD_COLORS } from "../models/card.js";
import { AppState } from "../state/astate.js";
import { saveUserData } from "../storage/userStorage.js";

const CARD_IDS = {
    COMPANY: "#stock-card__comp-name",
    TICKER: "#stock-card__tk-sym",
    PRICE: "#stock-card__curr-price",
    PRICE_CHANGE: "#stock-card__curr-price-change",
    FAVORITE: "#stock-card__fav-btn"
};

const STOCK_DIRECTIONS = ["up", "down"];

function persistUser() {
    const state = AppState.current;

    if (!state?.user) return;

    saveUserData(
        state.user.username,
        state.getPersistedUserData()
    );
}

function getSymbol(stock) {
    return stock.symbol ?? stock.ticker;
}

function getCompanyName(stock) {
    return stock.companyName ?? stock.company ?? stock.name ?? getSymbol(stock);
}

function getPriceDirection(stock) {
    const change = Number(stock.priceChangeAmount ?? stock.change ?? 0);
    return change < 0 ? "down" : "up";
}

function getFavoriteColor(isFavorited) {
    return isFavorited
        ? CARD_COLORS.favorited
        : CARD_COLORS.notFavorited;
}

function updateClassList(elem, add, remove) {
    if (!elem || !Array.isArray(remove)) return false;

    remove.forEach(cls => elem.classList.remove(cls));

    if (add) {
        elem.classList.add(add);
    }

    return true;
}

function isInWatchlist(symbol) {
    const user = AppState.current?.user;
    return user?.watchlist?.has(symbol) ?? false;
}

function toggleFavorite(event, stock) {
    event.preventDefault();
    event.stopPropagation();

    const user = AppState.current?.user;
    if (!user) return false;

    const button = event.currentTarget;
    const symbol = getSymbol(stock);

    if (!symbol) return false;

    const asset = AppState.current.getAsset(symbol) ?? stock;

    let isFavorited;

    if (user.watchlist.has(symbol)) {
        user.removeFromWatchlist(asset);
        isFavorited = false;
    } else {
        user.addToWatchlist(asset);
        isFavorited = true;
    }

    button.style.color = getFavoriteColor(isFavorited);
    persistUser();

    return true;
}

function setUpFavorite(clone, stock, selector) {
    const fav = clone.querySelector(selector);
    if (!fav) return false;

    const symbol = getSymbol(stock);
    const favorited = isInWatchlist(symbol);

    fav.style.color = getFavoriteColor(favorited);
    fav.addEventListener("click", event => toggleFavorite(event, stock));

    return true;
}

function setItem(clone, stock, selector) {
    if (!clone || !stock || !selector) return false;

    if (selector === CARD_IDS.FAVORITE) {
        return setUpFavorite(clone, stock, selector);
    }

    const cardItem = clone.querySelector(selector);
    if (!cardItem) return false;

    if (selector === CARD_IDS.COMPANY) {
        cardItem.textContent = getCompanyName(stock);
        return true;
    }

    if (selector === CARD_IDS.TICKER) {
        cardItem.textContent = getSymbol(stock);
        return true;
    }

    if (selector === CARD_IDS.PRICE) {
        const priceSpan = cardItem.querySelector(".price-locator");
        if (!priceSpan) return false;

        const price = Number(stock.price ?? 0);

        priceSpan.textContent = price.toFixed(2);
        priceSpan.dataset.amount = String(price);

        return true;
    }

    if (selector === CARD_IDS.PRICE_CHANGE) {
        const directionSpan = cardItem.querySelector(".direction-locator");
        const priceSpan = cardItem.querySelector(".price-locator");
        const percentSpan = cardItem.querySelector(".percent-change-locator");

        if (!directionSpan || !priceSpan || !percentSpan) return false;

        const changeAmount = Number(stock.priceChangeAmount ?? stock.change ?? 0);
        const changePercent = Number(stock.priceChangePercent ?? stock.changesPercentage ?? 0);
        const direction = getPriceDirection(stock);

        directionSpan.textContent = direction === "down" ? "-" : "+";

        priceSpan.textContent = Math.abs(changeAmount).toFixed(2);
        priceSpan.dataset.amount = String(Math.abs(changeAmount));
        priceSpan.dataset.denomination = stock.currency ?? "USD";

        percentSpan.textContent = `(${Math.abs(changePercent).toFixed(2)}%)`;
        percentSpan.dataset.change = String(Math.abs(changePercent).toFixed(2));

        return updateClassList(cardItem, direction, STOCK_DIRECTIONS);
    }

    return true;
}

function constructCard(clone, card) {
    if (!clone || !card?.stock) return false;

    const stock = card.stock;
    let success = true;

    Object.values(CARD_IDS).forEach(selector => {
        if (!setItem(clone, stock, selector)) {
            success = false;
        }
    });

    const polyline = clone.querySelector(".stock-card__chart polyline");

    if (polyline) {
        const direction = getPriceDirection(stock);
        polyline.style.stroke =
            direction === "down"
                ? "var(--card-down)"
                : "var(--card-up)";

        if (stock.chartPoints) {
            polyline.setAttribute("points", stock.chartPoints);
        }
    }

    return success;
}

export function showCard(data = {}) {
    const card = new Card(data);

    const grid = document.querySelector(card.appendGrid);
    const template = document.querySelector("#stock-card__tmplt");

    if (!grid || !template || !card?.stock) return;

    const clone = template.content.cloneNode(true);
    const symbol = getSymbol(data.stock);

    const link = clone.querySelector("#stock_link");

    if (link && symbol) {
        link.href = `stock-details.html?symbol=${encodeURIComponent(symbol)}&type=${encodeURIComponent(data.stock.type ?? "stock")}`;
    }

    constructCard(clone, card);

    grid.appendChild(clone);
}