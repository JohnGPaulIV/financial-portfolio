import { Asset } from "./asset.js"
import { fetchAssetData, fetchCryptoProfile } from "../api.js";

export class Stock extends Asset {
    constructor(data = {}) {
        super({ ...data, type: "stock" });

        this.sector = data.sector ?? null;
        this.industry = data.industry ?? null;
        this.marketCap = data.marketCap ?? null;
        this.beta = data.beta ?? null;
        this.price = data.price ?? null;
        this.volume = data.volume ?? null;
        this.lastAnnualDividend = data.lastAnnualDividend ?? null;
        this.country = data.country ?? null;
        this.isActivelyTrading = data.isActivelyTrading ?? null;
    }
}

export class ETF extends Asset {
    constructor(data = {}) {
        super({ ...data, type: "etf" });
        this.isEtf = true;
    }
}

export class MutualFund extends Asset {
    constructor(data = {}) {
        super({ ...data, type: "mutual_fund" });
        this.isFund = true;
    }
}

export class IndexAsset extends Asset {
    constructor(data = {}) {
        super({ ...data, type: "index" });
    }

    getPeers() {
        return [];
    }
}

export class ETN extends Asset {
    constructor(data = {}) {
        super({ ...data, type: "etn" });

        this.issuer = data.issuer ?? null;
        this.leverage = data.leverage ?? null;
    }
}

export class Cryptocurrency extends Asset {
    constructor(data = {}) {
        super({
            symbol: data.symbol,
            name: data.name,
            type: "crypto",
            currency: data.currency ?? "USD",
            sources: data.sources ?? [],
            exchange: "CRYPTO",
            exchangeCode: "CCC"
        });
    }

    #normalizeSymbol() {
        return this.symbol?.replace(/usd$/i, "").toLowerCase();
    }

    async getProfile() {
        const normalizedCryptoSymbol = this.#normalizeSymbol();
        const cryptoProfile = await fetchCryptoProfile(normalizedCryptoSymbol);
        return {
            ...this._createEmptyProfile(),
            industry: "Cryptocurrency",
            sector: "Digital Assets",
            ...cryptoProfile
        };
    }

    getPeers() {
        return [];
    }
}

export class ForexPair extends Asset {
    constructor(data = {}) {
        super({
            ...data,
            type: "currency_pair",
            exchange: "FOREX",
            exchangeCode: "CCY",
        });

        this.fromCurrency = data.fromCurrency;
        this.toCurrency = data.toCurrency;
        this.fromName = data.fromName;
        this.toName = data.toName;
    }

    async getProfile() {
        return {
            ...this._createEmptyProfile(),
            industry: "Foreign Exchange",
            sector: "Currency Pair",
            exchange: "FOREX",
            exchangeCode: "CCY",
            symbol: `${this.fromCurrency} -> ${this.toCurrency}`,
            companyName: `${this.fromName} -> ${this.toName}`,
            marketCap: 0,
            logo: "../../src/imgs/forex.png",
        };
    }

    getPeers() {
        return [];
    }
}

export class UnknownAsset extends Asset {
    constructor(data = {}) {
        super({ ...data, type: "unknown" });
    }

    getPeers() {
        return [];
    }
}