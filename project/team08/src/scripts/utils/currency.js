import { formatAmount } from "./formatting.js";
import { AppState } from "../state/astate.js";

export const CURRENCY_CONVERSIONS = {
    USD: 1.0,
    EUR: 0.85,
    GBP: 0.79,
    JPY: 154.21
};

function getSelectedCurrency() {
    return (
        AppState.current?.user?.settings?.currency ??
        "USD"
    );
}

export function setCurrency(price) {
    if (!price) {
        return formatAmount(0, "USD");
    }

    const from =
        price.dataset.denomination ?? "USD";

    const to = getSelectedCurrency();

    const newPrice =
        getConvertedCurrency(price, from, to);

    price.dataset.setamount = String(newPrice);

    return formatAmount(newPrice, to);
}

function getConvertedCurrency(amount, from, to) {
    if (
        !CURRENCY_CONVERSIONS[from] ||
        !CURRENCY_CONVERSIONS[to]
    ) {
        return 0.00;
    }

    const rawAmount = parseFloat(
        amount.dataset.amount ?? "0"
    );

    if (!Number.isFinite(rawAmount)) {
        return 0.00;
    }

    if (to === from) {
        return rawAmount;
    }

    const usdAmount =
        rawAmount / CURRENCY_CONVERSIONS[from];

    return +(
        usdAmount *
        CURRENCY_CONVERSIONS[to]
    ).toFixed(2);
}