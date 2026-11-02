import { guessTypeFromStockList } from "./builderHelpers.js";
import {
    Stock,
    ETF,
    ETN,
    MutualFund,
    IndexAsset,
    Cryptocurrency,
    UnknownAsset,
    ForexPair,
} from "./assetTypes.js";
import {
    fetchFMPIndexes,
    fetchFMPCryptos,
    fetchFMPETFs,
    fetchFMPCompanyScreener,
    fetchFMPStockList,
    fetchFMPForexList,
} from "../api.js"
export class AssetFactory {
    static fromCompanyScreener(row) {
        const data = {
            symbol: row.symbol,
            name: row.companyName,
            exchange: row.exchange ?? null,
            exchangeShortName: row.exchangeShortName ?? null,
            country: row.country ?? null,
            sector: row.sector ?? null,
            industry: row.industry ?? null,
            marketCap: row.marketCap ?? null,
            beta: row.beta ?? null,
            price: row.price ?? null,
            volume: row.volume ?? null,
            lastAnnualDividend: row.lastAnnualDividend ?? null,
            isActivelyTrading: row.isActivelyTrading ?? null,
            sources: ["company-screener"],
        };

        if (/ETN/i.test(row.companyName ?? "")) return new ETN(data);
        if (row.isEtf === true) return new ETF(data);
        if (row.isFund === true) return new MutualFund(data);

        return new Stock(data);
    }
    static fromIndexList(row) {
        return new IndexAsset({
            symbol: row.symbol,
            name: row.name,
            exchange: row.exchange ?? null,
            exchangeShortName: row.exchange ?? null,
            currency: row.currency ?? null,
            sources: ["index-list"],
        });
    }

    static fromCryptoList(row) {
        return new Cryptocurrency({
            symbol: row.symbol,
            name: row.name,
            exchange: row.exchange ?? null,
            exchangeShortName: row.exchange ?? null,
            icoDate: row.icoDate ?? null,
            circulatingSupply: row.circulatingSupply ?? null,
            totalSupply: row.totalSupply ?? null,
            sources: ["crypto-list"],
        });
    }

    static fromEtfList(row) {
        return new ETF({
            symbol: row.symbol,
            name: row.name,
            sources: ["etf-list"],
        });
    }

    static fromStockList(row) {
        const last_try = guessTypeFromStockList(row);
        const name = row.companyName ?? row.name ?? "";
        const symbol = row.symbol ?? "";

        const data = {
            symbol: symbol,
            name: name,
            sources: ["stock-list"]
        };

        switch (last_try) {
            case "etf":
                return new ETF(data);
            case "etn":
                return new ETN(data);
            case "mutual_fund":
                return new MutualFund(data);
            case "index":
                return new IndexAsset(data);
            case "unknown":
                return new UnknownAsset(data);
        }
    }

    static fromForexList(row) {
        return new ForexPair({
            symbol: row.symbol,
            exchange: "FOREX",
            exchangeCode: "CCY",
            fromCurrency: row.fromCurrency,
            toCurrency: row.toCurrency,
            fromName: row.fromName,
            toName: row.toName,
        })
    }
}

export class AssetRegistry {
    constructor() {
        this.assets = new Map();
    }

    upsert(asset) {
        const existing = this.assets.get(asset.symbol);

        if (!existing) {
            this.assets.set(asset.symbol, asset);
            return asset;
        }

        for (const source of asset.sources) {
            existing.addSource(source);
        }

        for (const [key, value] of Object.entries(asset)) {
            if (
                value !== null &&
                value !== undefined &&
                value !== "" &&
                (existing[key] === null ||
                    existing[key] === undefined ||
                    existing[key] === "")
            ) {
                existing[key] = value;
            }
        }

        return existing;
    }

    get(symbol) {
        return this.assets.get(symbol.toUpperCase());
    }

    all() {
        return [...this.assets.values()];
    }
}

export async function buildAssetRegistry() {
    const [
        indexRows,
        cryptoRows,
        etfRows,
        companyRows,
        stockRows,
        forexRows,
    ] = await Promise.all([
        fetchFMPIndexes(),
        fetchFMPCryptos(),
        fetchFMPETFs(),
        fetchFMPCompanyScreener(),
        fetchFMPStockList(),
        fetchFMPForexList(),
    ]);

    const registry = new AssetRegistry();

    indexRows.forEach(row => {
        registry.upsert(AssetFactory.fromIndexList(row));
    });

    cryptoRows.forEach(row => {
        registry.upsert(AssetFactory.fromCryptoList(row));
    });

    etfRows.forEach(row => {
        registry.upsert(AssetFactory.fromEtfList(row));
    });

    companyRows.forEach(row => {
        registry.upsert(AssetFactory.fromCompanyScreener(row));
    });

    stockRows.forEach(row => {
        registry.upsert(AssetFactory.fromStockList(row));
    });

    forexRows.forEach(row => {
        registry.upsert(AssetFactory.fromForexList(row))
    });

    return registry;
}