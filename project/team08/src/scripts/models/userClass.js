import { UserHoldings } from "./userHoldings.js";

export class Watchlist extends UserHoldings {
    addAsset(asset) {
        if (!asset?.symbol) return false;

        const symbol = asset.symbol.toUpperCase();

        if (this.items.has(symbol)) {
            return false;
        }

        this.items.set(symbol, {
            symbol,
            addedAt: new Date().toISOString(),
        });

        this.history.push({
            type: "ADD",
            symbol,
            timestamp: new Date().toISOString(),
        });

        this.addAllocationMetadata(asset);

        return true;
    }

    removeAsset(asset) {
        if (!asset?.symbol) return false;

        const symbol = asset.symbol.toUpperCase();

        if (!this.items.has(symbol)) {
            return false;
        }

        this.items.delete(symbol);

        this.history.push({
            type: "REMOVE",
            symbol,
            timestamp: new Date().toISOString(),
        });

        this.removeAllocationMetadata(asset);

        return true;
    }

    toJSON() {
        return {
            items: [...this.items.entries()],
            history: this.history,
            industryTracker: this.industryTracker.toJSON(),
            sectorTracker: this.sectorTracker.toJSON(),
            exchangeTracker: this.exchangeTracker.toJSON(),
            countryTracker: this.countryTracker.toJSON(),
        };
    }

    static fromJSON(data = {}) {
        return new Watchlist(data);
    }
}

export class Portfolio extends UserHoldings {
    buy(asset, shares, price) {
        if (!asset?.symbol || shares <= 0 || price <= 0) return false;

        const symbol = asset.symbol.toUpperCase();
        const existing = this.items.get(symbol);

        if (!existing) {
            this.items.set(symbol, {
                symbol,
                shares,
                avgPrice: price,
                totalCost: shares * price,
                addedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            this.addAllocationMetadata(asset);
        } else {
            const newTotalCost = existing.totalCost + shares * price;
            const newShares = existing.shares + shares;

            existing.shares = newShares;
            existing.totalCost = newTotalCost;
            existing.avgPrice = newTotalCost / newShares;
            existing.updatedAt = new Date().toISOString();
        }

        this.history.push({
            type: "BUY",
            symbol,
            shares,
            price,
            total: shares * price,
            timestamp: new Date().toISOString(),
        });

        return true;
    }

    sell(asset, shares, price) {
        if (!asset?.symbol || shares <= 0 || price <= 0) return false;

        const symbol = asset.symbol.toUpperCase();
        const existing = this.items.get(symbol);

        if (!existing || existing.shares < shares) {
            return false;
        }

        existing.shares -= shares;
        existing.totalCost = existing.avgPrice * existing.shares;
        existing.updatedAt = new Date().toISOString();

        if (existing.shares === 0) {
            this.items.delete(symbol);
            this.removeAllocationMetadata(asset);
        }

        this.history.push({
            type: "SELL",
            symbol,
            shares,
            price,
            total: shares * price,
            timestamp: new Date().toISOString(),
        });

        return true;
    }

    removePosition(assetOrSymbol, options = {}) {
        const symbol =
            typeof assetOrSymbol === "string"
                ? assetOrSymbol.toUpperCase()
                : assetOrSymbol?.symbol?.toUpperCase();

        if (!symbol || !this.items.has(symbol)) {
            return false;
        }

        const existing = this.items.get(symbol);

        this.items.delete(symbol);

        if (options.removeHistory === true) {
            this.history = this.history.filter(
                entry => entry.symbol !== symbol
            );
        } else {
            this.history.push({
                type: "REMOVE_POSITION",
                symbol,
                timestamp: new Date().toISOString(),
            });
        }

        if (options.assetMetadata) {
            this.removeAllocationMetadata(options.assetMetadata);
        }

        return true;
    }

    toJSON() {
        return {
            items: [...this.items.entries()],
            history: this.history,
            industryTracker: this.industryTracker.toJSON(),
            sectorTracker: this.sectorTracker.toJSON(),
            exchangeTracker: this.exchangeTracker.toJSON(),
            countryTracker: this.countryTracker.toJSON(),
        };
    }

    static fromJSON(data = {}) {
        return new Portfolio(data);
    }
}

export const DEFAULT_SETTINGS = {
    darkMode: true,
    currency: "USD",
    movementFormat: "both",
    chartRange: "1W",
    intervalChartRange: "1min",
    landingPage: "index",
    displayMarketStatus: false,
    searchIncludes: new Set(["etf", "currency_pair", "index", "mutual_fund", "stock", "crypto", "etn"])
};

export class User {
    constructor(userData = {}) {
        this.username = userData.username ?? "";
        this.password = userData.password ?? "";
        this.realizedGainLoss = userData.realizedGainLoss ?? 0;

        this.portfolio = Portfolio.fromJSON(userData.portfolio);
        this.watchlist = Watchlist.fromJSON(userData.watchlist);

        const incomingSettings = userData.settings ?? {};

        this.settings = {
            ...DEFAULT_SETTINGS,
            ...incomingSettings,
            searchIncludes: new Set(
                incomingSettings.searchIncludes ??
                DEFAULT_SETTINGS.searchIncludes
            )
        };
    }

    addToWatchlist(asset) {
        return this.watchlist.addAsset(asset);
    }

    removeFromWatchlist(asset) {
        return this.watchlist.removeAsset(asset);
    }

    buyAsset(asset, shares, price) {
        return this.portfolio.buy(asset, shares, price);
    }

    sellAsset(asset, shares, price) {
    if (!asset?.symbol || shares <= 0 || price <= 0) return false;

    const symbol = asset.symbol.toUpperCase();
    const existing = this.portfolio.items.get(symbol);

    if (!existing || existing.shares < shares) {
        return false;
    }

    const avgPrice = Number(existing.avgPrice ?? 0);
    const realizedGainLoss = (price - avgPrice) * shares;

    const sold = this.portfolio.sell(asset, shares, price);

    if (!sold) return false;

    this.realizedGainLoss =
        Number(this.realizedGainLoss ?? 0) + realizedGainLoss;

    return true;
}

    removePortfolioPosition(asset) {
        return this.portfolio.removePosition(asset);
    }

    updateSettings(changes = {}) {
        this.settings = {
            ...this.settings,
            ...changes,
            searchIncludes: new Set(
                changes.searchIncludes ??
                this.settings.searchIncludes ??
                DEFAULT_SETTINGS.searchIncludes
            )
        };

        return true;
    }

    toJSON() {
        return {
            username: this.username,
            password: this.password,
            realizedGainLoss: this.realizedGainLoss,
            portfolio: this.portfolio.toJSON(),
            watchlist: this.watchlist.toJSON(),
            settings: {
                ...this.settings,
                searchIncludes: [...this.settings.searchIncludes]
            }
        };
    }

    static fromJSON(data = {}) {
        return new User(data);
    }
}