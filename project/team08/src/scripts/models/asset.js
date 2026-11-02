import { fetchAssetData } from "../api.js";
export class Asset {
    constructor({
        symbol,
        name,
        type = "unknown",
        exchange = null,
        exchangeCode = null,
        currency = null,
        sources = [],
        quote = {},
        profile = {},
        peers = [],

    }) {
        this.symbol = symbol?.toUpperCase();
        this.name = name ?? "";
        this.type = type;
        this.exchange = exchange;
        this.exchangeCode = exchangeCode;
        this.currency = currency;
        this.sources = new Set(sources);
    }

    addSource(source) {
        this.sources.add(source);
    }

    toJSON() {
        return {
            ...this,
            sources: [...this.sources]
        }
    }

    #checkDataFormatQuote(data) {
        return Array.isArray(data);
    }

    #checkDataFormatProfile(data) {
        return Array.isArray(data);
    }

    #checkDataFormatPeers(data) {
        return Array.isArray(data);
    }

    #rejectedCallback(err) {
        console.error(`Attempt to collect asset data for ${this.symbol} has failed: `, err);
    }

    async #dataProcessCallback(res, checkDataFormat) {
        try {
            if (!res.ok)
                throw new Error("HTTP error: ", res.status);

            const data = await res.json();
            if (!checkDataFormat(data))
                throw new Error(`Incorrect or no data found for ${this.symbol}: `, data);
            if (data.length <= 0)
                return [];
            return data;
        } catch (err) {
            this.#rejectedCallback(err);
        }
    }

    _createEmptyProfile() {
        return {
            symbol: this.symbol,
            beta: null,
            lastDividend: null,
            range: null,
            averageVolume: null,

            companyName: this.name,
            currency: this.currency,
            cik: null,
            isin: null,
            cusip: null,
            exchange: this.exchange,
            exchangeCode: this.exchangeCode,
            industry: null,
            website: null,
            description: null,
            ceo: null,
            sector: null,
            country: this.country,
            fullTimeEmployees: null,
            phone: null,
            address: null,
            city: null,
            state: null,
            zip: null,
            image: null,
            ipoDate: null,
            defaultImage: null,
            isEtf: false,
            isActivelyTrading: null,
            isAdr: false,
            isFund: false,
        };
    }

    #normalizeQuote(data) {
        return {
            price: data.price ?? null,
            priceChangePercent: data.changePercentage ?? null,
            priceChangeAmount: data.change ?? null,
            volume: data.volume ?? null,

            low: data.dayLow ?? null,
            high: data.dayHigh ?? null,
            yearHigh: data.yearHigh ?? null,
            yearLow: data.yearLow ?? null,

            dayStart: data.open ?? null,
            prevClose: data.previousClose ?? null,

            marketCap: data.marketCap ?? null,
            priceAvg50: data.priceAvg50 ?? null,
            priceAvg200: data.priceAvg200 ?? null,

            timestamp: data.timestamp ?? null,
        };
    }

    #normalizeProfile(data) {
        return {
            symbol: data.symbol,
            beta: data.beta,
            lastDividend: data.lastDividend,
            range: data.range,
            averageVolume: data.averageVolume,

            companyName: data.companyName,
            currency: data.currency,
            cik: data.cik,
            isin: data.isin,
            cusip: data.cusip,
            exchange: data.exchangeFullName,
            exchangeCode: data.exchange,
            industry: data.industry,
            website: data.website,
            description: data.description,
            ceo: data.ceo,
            sector: data.sector,
            country: data.country,
            fullTimeEmployees: data.fullTimeEmployees,
            phone: data.phone,
            address: data.address,
            city: data.city,
            state: data.state,
            zip: data.zip,
            image: data.image,
            ipoDate: data.ipoDate,
            defaultImage: data.defaultImage,
            isEtf: data.isEtf,
            isActivelyTrading: data.isActivelyTrading,
            isAdr: data.isAdr,
            isFund: data.isFund,
            marketCap: data.marketCap,
        };
    }

    #normalizePeers(data) {
        if (!data) return [];
        const processedData = [];
        data.forEach((peer) => {
            processedData.push(peer.symbol);
        });
        return processedData;
    }

    #rejectedQuoteFetch(err) {
        console.error(`Error fetching Quote: ${err}`);
    }

    #processQuote(res) {
        return this.#dataProcessCallback(
            res,
            (data) => this.#checkDataFormatQuote(data)
        );
    }

    #processProfile(res) {
        return this.#dataProcessCallback(
            res,
            (data) => this.#checkDataFormatProfile(data)
        );
    }

    #processPeers(res) {
        return this.#dataProcessCallback(
            res,
            (data) => this.#checkDataFormatPeers(data)
        );
    }

    async getQuote() {
        const quoteData = await fetchAssetData(`quote?symbol=${this.symbol}&`,
            (res) => this.#processQuote(res),
            (res) => this.#rejectedCallback(res));
        return this.#normalizeQuote(quoteData[0]);
    }

    async fillQuote() {
        const quoteData = await this.getQuote();
        this.quote = quoteData;
        return quoteData;
    }

    async getProfile() {
        const profileData = await fetchAssetData(`profile?symbol=${this.symbol}&`,
            (res) => this.#processProfile(res),
            (res) => this.#rejectedCallback(res)
        );
        return this.#normalizeProfile(profileData[0]);
    }

    async getPeers() {
        const peerData = await fetchAssetData(`stock-peers?symbol=${this.symbol}&`,
            (res) => this.#processPeers(res),
            (res) => this.#rejectedCallback(res)
        );
        console.log(peerData);
        console.log(this.#normalizePeers(peerData));
        return this.#normalizePeers(peerData);
    }
}

