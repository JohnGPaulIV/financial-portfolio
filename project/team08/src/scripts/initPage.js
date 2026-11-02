import { setCurrency } from "./utils/currency.js";
import { initSearch } from "./search.js";
import { AppState } from "./state/astate.js";
import { CONFIG } from "../config.js";
const loc = window.location.pathname;

export function redir(name) {
    window.location.replace(name);
}

function isAuthPage() {
    return loc.endsWith("login.html") || loc.endsWith("signup.html");
}

function hasValidAppState() {
    if (!AppState.current && !isAuthPage()) {
        redir("login.html");
        return false;
    }

    return true;
}

function getSettings() {
    return AppState.current?.user?.settings ?? null;
}

export function viewMode() {
    const settings = getSettings();

    if (!settings) return;

    if (!settings.darkMode) {
        document.documentElement.classList.add("light-mode");
        return;
    }

    document.documentElement.classList.remove("light-mode");
}

export function viewCurrency() {
    const prices = document.querySelectorAll(".price-locator");

    if (prices.length === 0) return;

    prices.forEach(price => {
        const curr = setCurrency(price);

        price.dataset.denominationSymbol =
            curr[0] === "-" ? curr[1] : curr[0];

        price.textContent = curr;
    });
}

export function viewMovementStyle() {
    const settings = getSettings();
    if (!settings) return;

    const movements = document.querySelectorAll(".movement-locator");
    if (movements.length === 0) return;

    const movementSelected = settings.movementFormat;

    movements.forEach(movement => {
        const priceChanges = movement.querySelectorAll(".price-locator");
        const percentChanges = movement.querySelectorAll(".percent-change-locator");

        if (priceChanges.length !== percentChanges.length) return;

        for (let i = 0; i < priceChanges.length; i++) {
            const amount =
                priceChanges[i].dataset.amount ??
                priceChanges[i].dataset.setamount ??
                "0";

            const denomSym =
                priceChanges[i].dataset.denominationSymbol ??
                priceChanges[i].dataset.denominationSymbol ??
                "$";

            const changeAmount =
                percentChanges[i].dataset.change ?? "0";

            const priceChange =
                movementSelected !== "percent"
                    ? `${denomSym}${Math.abs(parseFloat(amount)).toFixed(2)}`
                    : "";

            const percentChange =
                movementSelected !== "amount"
                    ? `${Math.abs(parseFloat(changeAmount)).toFixed(2)}%`
                    : "";

            const lParen = movementSelected === "both" ? " (" : "";
            const rParen = movementSelected === "both" ? ")" : "";

            priceChanges[i].textContent = priceChange;
            percentChanges[i].textContent = `${lParen}${percentChange}${rParen}`;
        }
    });
}

export async function marketStatus() {
    const res = await fetch(`https://financialmodelingprep.com/stable/exchange-market-hours?exchange=NASDAQ&apikey=${CONFIG.FMP_API_KEY}`);
    if (!res.ok)
        return "UNKNOWN";
    const data = await res.json();
    if (!data)
        return "UNKNOWN";
    if (data[0].isMarketOpen)
        return "OPEN";
    return "CLOSED";
}

export async function onLoad() {
    if (!AppState.current && !isAuthPage()) {
        await AppState.hydrate();
    }

    if (!hasValidAppState()) return;

    initSearch();
    viewMode();
    viewCurrency();
    if (AppState.current.user.settings.displayMarketStatus) {
        const mstatus = document.getElementById("market-status");
        mstatus.textContent = await marketStatus();
        mstatus.dataset.marketState = mstatus.textContent.toLowerCase();
    }
    viewMovementStyle();
}