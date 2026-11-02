import { AppState } from "../state/astate.js";
export function formatAmount(amount, to = "USD", style = "currency", locale = "en-US", spacing = 0) {
    const formatter = new Intl.NumberFormat(locale, {
        style: style,
        currency: to
    });

    const parts = formatter.formatToParts(amount);

    return parts.map(part => {
        if (part.type === "currency")
            return part.value + " ".repeat(spacing);
        return part.value;
    }).join("");
}

export function moneyAttrs(value) {
    return `
    data-denomination="USD"
    data-locale="en-US"
    data-style="currency"
    data-spacing="0"
    data-amount="${Number(value ?? 0).toFixed(2)}"
    data-setAmount="0"
    data-denomination-symbol="$"
  `;
}

export function moneySpan(value, className = "") {
    return `
    <span class="price-locator ${className}" ${moneyAttrs(value)}>
      ${formatPrice(value)}
    </span>
  `;
}

export function setMoneyEl(el, value) {
    if (!el) return;

    el.dataset.denomination = "USD";
    el.dataset.locale = "en-US";
    el.dataset.style = "currency";
    el.dataset.spacing = "0";
    el.dataset.amount = Number(value ?? 0).toFixed(2);
    el.dataset.setamount = "0";
    el.dataset.denominationSymbol = "$";

    el.textContent = formatPrice(value);
}

export function formatPrice(value) {
    return formatAmount(
        Number(value ?? 0),
        getSelectedCurrency()
    );
}

export function getSelectedCurrency() {
    return (
        AppState.current?.user?.settings?.currency ??
        "USD"
    );
}