import { Stock } from "./stock.js";

export const CARD_COLORS = {
    favorited: "#FFD84D",
    notFavorited: "rgba(255, 216, 77, 0.45)",
};

const CARD_TEMPLATE = {
    appendGrid: "",
};

export function Card(data = {}) {
    const stock = data.stock ? new Stock(data.stock) : new Stock();

    const card = Object.assign(
        Object.create(CARD_TEMPLATE),
        data,
        { stock }
    );
    return card;
}
