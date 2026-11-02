import { getCompanyProfile, getPeers, getQuoteFMP } from "../api.js";
import { APP_STATE } from "../state/appState.js";

const UP = "up"
const DOWN = "down"

const STOCK_TEMPLATE = {
    ticker: "AAPL",
    company: "Apple Inc.",
    logo: "https://static.finnhub.io/logo/87cb30d8-80df-11ea-8951-00000000092a.png",
    industry: "Technology",
    exchange: "NASDAQ/NMS (GLOBAL MARKET)",
    website: "https://www.apple.com",
    country: "US",
    currency: "USD",
    ipo: "1980-12-12",
    marketCap: 1415993,
    phone: "14089961010",
    shareOutstanding: 4375.47998046875,
    type: "Stock",
    dayStart: 30.58,
    price: 34.33,
    priceChangeAmount: 3.75,
    priceChangePercent: 12.3,
    priceDirection: "up",
    high: 34.33,
    low: 34.33,
    prevClose: 34.33,
    currBasis: 30.58,
    isFavorited: false,
    peers: []
};

function fillQuoteData(fill, quote) {
    fill.price = quote.price;
    fill.dayStart = quote.dayStart;

    fill.priceChangeAmount = quote.priceChangeAmount;
    fill.priceChangePercent = quote.priceChangePercent;
    fill.priceDirection = quote.priceChangeAmount >= 0 ? "up" : "down";

    fill.high = quote.high;
    fill.low = quote.low;
    fill.prevClose = quote.prevClose;

    fill.currBasis = quote.dayStart;

    fill.exchange = quote.exchange ?? fill.exchange;
    fill.marketCap = quote.marketCap ?? fill.marketCap;
    fill.company = quote.name ?? fill.company;
}

function fillProfileData(fill, profile) {
    fill.ticker = profile.ticker;
    fill.company = profile.company;
    fill.logo = profile.logo;
    fill.industry = profile.industry;
    fill.exchange = profile.exchange;
    fill.website = profile.website;

    fill.country = profile.country;
    fill.currency = profile.currency;
    fill.ipo = profile.ipo;
    fill.marketCap = profile.marketCap;
    fill.phone = profile.phone;
    fill.shareOutstanding = profile.shareOutstanding;

}

function fillPeers(fill, peers) {
    fill.peers = peers;
}

const STOCK_ACTIONS = {
    updatePrice: function (newPrice, basis, force = false) {
        if (!force && (newPrice == null || newPrice === this.price))
            return;

        basis = basis ?? this.currBasis;
        const changeAmount = newPrice - basis;
        const changePercent = basis === 0 ? 0 : (changeAmount / basis) * 100;

        this.price = newPrice;
        this.priceChangeAmount = changeAmount;
        this.priceChangePercent = changePercent;
        this.prevClose = newPrice;

        this.priceDirection = changeAmount > 0 ? "up" : changeAmount < 0 ? "down" : this.priceDirection;

        this.high = newPrice > this.high ? newPrice : this.high;
        this.low = newPrice < this.low ? newPrice : this.low;
    },
    endDay: function (amount) {
        this.prevClose = amount ?? this.price;
    },
    startDay: function () {
        this.dayStart = this.prevClose;
        this.price = this.prevClose;
        this.init();
    }
}

export const STOCK_DIRECTIONS = [UP, DOWN];

export function Stock(data = {}) {
    // TODO implement a fetch to get data for the stock by its identifier (ie. ticker symbol, company name, ISIN, CUSIP) and then use initStock
    return initStock(data);
}

function initStock(data = {}, type) {
    const stock = Object.assign(
        Object.create(STOCK_ACTIONS),
        structuredClone(STOCK_TEMPLATE),
        data
    )
    return stock;
}

export async function createStock(ticker, type = "Common stock") {
    const [quote, profile, peers] = await Promise.all([
        getQuoteFMP(ticker, type),
        getCompanyProfile(ticker, type),
        getPeers(ticker)
    ]);

    const data = {};
    fillProfileData(data, profile);
    fillQuoteData(data, quote);
    fillPeers(data, peers);
    data.isFavorited = APP_STATE.watchlist.has(data.ticker);
    data.type = type
    return Stock(data, type);
}