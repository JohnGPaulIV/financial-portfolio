/* api.js
    Handles all FMP, Finnhub and Coingecko API calls.
    Finnhub base URL: https://finnhub.io/api/v1
    FMP base URL:     https://financialmodelingprep.com/stable
    Coingecko base URL: https://api.coingecko.com/api/v3
*/
import { CONFIG } from "../config.js"
import { APP_STATE } from "./state/appState.js";
import { AppState } from "./state/astate.js";

const BASE_URL = "https://finnhub.io/api/v1";
const FMP_BASE_URL = "https://financialmodelingprep.com/stable"

export async function fetchCryptoImgs() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1"
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Crypto image fetch failed (${res.status}): ${errorText}`);
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      throw new Error("Unexpected response from CoinGecko");
    }

    APP_STATE.cryptoImgs = new Map(
      data.map((crypto) => [
        crypto.symbol?.toLowerCase(),
        crypto.image,
      ])
    );

    return APP_STATE.cryptoImgs;
  } catch (err) {
    console.error("fetchCryptoImgs failed:", err);
    APP_STATE.cryptoImgs = new Map();
    return APP_STATE.cryptoImgs;
  }
}

export async function fetchCryptoProfile(id) {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&symbols=${id}`
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Crypto profile fetch failed (${res.status}): ${errorText}`);
    }

    let data = await res.json();

    if (!Array.isArray(data)) {
      throw new Error("Unexpected response from CoinGecko");
    }
    data = data[0];
    const profile = {
      id: data.id,
      symbol: data.symbol.toUpperCase(),
      companyName: data.name,
      image: data.image,
      price: data.current_price,
      marketCap: data.market_cap,
      marketCapRank: data.market_cap_rank,
      fullyDilutedValuation: data.fully_diluted_valuation,
      volume: data.total_volume,
      high: data.high_24h,
      low: data.low_24h,
      priceChangeAmount: data.price_change_24h,
      priceChangePercent: data.price_change_percentage_24h,
      circulatingSupply: data.circulating_supply,
      total_supply: data.total_supply,
      maxSupply: data.max_supply,
      ath: data.ath,
      athChangePercentage: data.ath_change_percentage,
      athData: data.ath_date,
      atl: data.atl,
      atlChangePercentage: data.atl_change_percentage,
      atlDate: data.atlDate,
      lastUpdated: data.last_updated,
    }

    return profile;
  } catch (err) {
    console.error("fetchCryptoProfile failed:", err);
    APP_STATE.cryptoImgs = new Map();
    return {};
  }
}

export async function fetchAssetData(endpoint, dataProcessCallback = null,
  rejectedCallback = null, fetchOptions = {}) {

  if (!dataProcessCallback || !rejectedCallback)
    throw new Error("Must provide both fulfilled and rejected callback functions");
  // if (!badRespCallback)
  //   badRespCallback = rejectedCallback;

  try {
    const res = await fetch(`${FMP_BASE_URL}/${endpoint}apikey=${CONFIG.FMP_API_KEY}`, {
      method: "GET",
      credentials: "same-origin",
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers
      }
    });

    return dataProcessCallback(res);

  } catch (err) {
    rejectedCallback(err);
  }
}

async function fetchWithCache(cacheKey, url) {
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`FMP request failed: ${response.status}`);
  }

  const data = await response.json();

  localStorage.setItem(cacheKey, JSON.stringify(data));

  return data;
}

export function fetchFMPIndexes() {
  return fetchWithCache(
    "team08_index-list",
    `${FMP_BASE_URL}/index-list?apikey=${CONFIG.FMP_API_KEY}`
  );
}

export function fetchFMPCryptos() {
  return fetchWithCache(
    "team08_crypto-list",
    `${FMP_BASE_URL}/cryptocurrency-list?apikey=${CONFIG.FMP_API_KEY}`
  );
}

export function fetchFMPETFs() {
  return fetchWithCache(
    "team08_etf-list",
    `${FMP_BASE_URL}/etf-list?apikey=${CONFIG.FMP_API_KEY}`
  );
}

export function fetchFMPCompanyScreener() {
  return fetchWithCache(
    "team08_company-screener",
    `${FMP_BASE_URL}/company-screener?apikey=${CONFIG.FMP_API_KEY}`
  );
}

export function fetchFMPStockList() {
  return fetchWithCache(
    "team08_stock-list",
    `${FMP_BASE_URL}/stock-list?apikey=${CONFIG.FMP_API_KEY}`
  );
}

export function fetchFMPForexList() {
  return fetchWithCache(
    "team08_forex-list",
    `${FMP_BASE_URL}/forex-list?apikey=${CONFIG.FMP_API_KEY}`
  );
}

/**
 * Searches for stocks matching a given query.
 * Used for the search bar autocomplete dropdown.
 *
 * @param {string} query - User input (symbol or company name)
 * @returns {Promise<Array>} Array of matching stock results
 */
export async function stockSearch(query) {
  try {
    const res = await fetch(`${BASE_URL}/search?q=${query}&exchange=US&token=${CONFIG.API_KEY}`);
    if (!res.ok) throw new Error(`Search request failed (${res.status})`);
    const data = await res.json();
    if (!data.result) throw new Error("Unexpected response from search API");
    const results = data.result.map(stock => ({
      symbol: stock.symbol,
      name: stock.description,
      type: stock.type
    }));
    APP_STATE.searchResults = results;
    return results;
  } catch (err) {
    console.error("stockSearch failed:", err);
    return [];
  }
}

export async function stockSearchFMP(query) {
  try {
    const q = query.trim();

    const res = await fetch(
      `${FMP_BASE_URL}/search-symbol?query=${encodeURIComponent(q)}&apikey=${CONFIG.FMP_API_KEY}`
    );

    if (!res.ok) {
      throw new Error(`Stock search request failed (${res.status})`);
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      throw new Error("Unexpected response from stock search API");
    }

    return data.map((item) => normalizeSearchResult(item));
  } catch (err) {
    console.error("stockSearchFMP failed:", err);
    return [];
  }
}

async function fetchFMPList(endpoint, stateKey) {
  if (APP_STATE[stateKey]?.length) return APP_STATE[stateKey];

  try {
    const res = await fetch(
      `${FMP_BASE_URL}/${endpoint}?apikey=${CONFIG.FMP_API_KEY}`
    );

    if (!res.ok) {
      throw new Error(`${endpoint} request failed (${res.status})`);
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      throw new Error(`Unexpected response from ${endpoint}`);
    }

    if (stateKey === "cryptoList") {
      APP_STATE[stateKey] = data.map((crypto) => {
        // BTCUSD -> btc
        const normalizedSymbol = crypto.symbol
          ?.replace(/usd$/i, "")
          .toLowerCase();

        return {
          ...crypto,
          logo: APP_STATE.cryptoImgs?.get(normalizedSymbol) ?? null,
        };
      });
    } else {
      APP_STATE[stateKey] = data;
    }

    return APP_STATE[stateKey];
  } catch (err) {
    console.error(`${endpoint} failed:`, err);
    return [];
  }
}

function normalizeSearchResult(item) {
  return {
    symbol: item.symbol,
    name: item.name,
    currency: item.currency,
    exchangeFull: item.exchangeFullName,
    exchange: item.exchange,
  };
}

function localSearch(list = [], query = "") {
  const q = query.trim().toLowerCase();

  return list
    .filter((item) => {
      const symbol = item.symbol?.toLowerCase() ?? "";
      const name =
        item.name?.toLowerCase() ??
        item.companyName?.toLowerCase() ??
        item.description?.toLowerCase() ??
        "";

      return symbol.startsWith(q) || name.startsWith(q);
    })
    .map((item) => normalizeSearchResult(item));
}

async function etfSearchFMP(query) {
  const etfs = await fetchFMPList("etf-list", "etfList");
  return localSearch(etfs, query);
}

async function indexSearchFMP(query) {
  const indexes = await fetchFMPList("index-list", "indexList");
  return localSearch(indexes, query);
}

async function cryptoSearchFMP(query) {
  const cryptos = await fetchFMPList("cryptocurrency-list", "cryptoList");
  return localSearch(cryptos, query, "Cryptocurrency");
}

// export async function fetchFMPETFs() {
//   return fetchFMPList("etf-list", "etfList");
// }

// export async function fetchFMPIndexes() {
//   return fetchFMPList("index-list", "indexList");
// }

// export async function fetchFMPCryptos() {
//   return fetchFMPList("cryptocurrency-list", "cryptoList");
// }

export async function search(query) {
  const q = query.toLowerCase().trim();

  if (!q) return [];

  const [matchingStocks, matchingETFS, matchingCryptos, matchingIndexes] =
    await Promise.all([
      stockSearchFMP(q),
      etfSearchFMP(q),
      cryptoSearchFMP(q),
      indexSearchFMP(q),
    ]);

  const results = [
    ...matchingStocks,
    ...matchingETFS,
    ...matchingCryptos,
    ...matchingIndexes,
  ].filter((result) => {
    return (result?.symbol.toLowerCase().startsWith(q) ||
      result?.name.toLowerCase().startsWith(q));
  });

  APP_STATE.searchResults = results;
  return results;
}

function normalizeFMPQuote(data, symbol, type) {
  return {
    ticker: data.symbol ?? symbol,
    type,

    name: data.name,
    volume: data.volume,

    price: data.price,
    priceChangeAmount: data.change,
    priceChangePercent: data.changePercentage,

    high: data.dayHigh,
    low: data.dayLow,
    yearHigh: data.yearHigh,
    yearLow: data.yearLow,

    dayStart: data.open,
    prevClose: data.previousClose,

    marketCap: data.marketCap,
    priceAvg50: data.priceAvg50,
    priceAvg200: data.priceAvg200,
    exchange: data.exchange,
  };
}

export async function getQuote(symbol) {
  let res;
  try {
    res = await fetch(`${BASE_URL}/quote?symbol=${symbol}&token=${CONFIG.API_KEY}`);
  } catch (err) {
    throw new Error(`Network error fetching quote for ${symbol}. Check your connection.`);
  }
  if (!res.ok) throw new Error(`Failed to load quote for ${symbol} (HTTP ${res.status}).`);
  const data = await res.json();

  // Finnhub returns all zeros for unknown symbols
  if (data.c === 0 && data.d === null) {
    throw new Error(`No quote data found for "${symbol}". The symbol may be invalid.`);
  }

  const quote = {
    ticker: symbol,
    price: data.c,
    priceChangeAmount: data.d,
    priceChangePercent: data.dp,
    high: data.h,
    low: data.l,
    dayStart: data.o,
    prevClose: data.pc
  };

  APP_STATE.currentQuote = quote;
  return quote;
}

export async function getQuoteFMP(symbol, type = "Common Stock") {
  let res;

  try {
    res = await fetch(
      `${FMP_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${CONFIG.FMP_API_KEY}`
    );
  } catch (err) {
    throw new Error(`Network error fetching quote for ${symbol}. Check your connection.`);
  }

  if (!res.ok) {
    throw new Error(`Failed to load quote for ${symbol} (HTTP ${res.status}).`);
  }

  const data = await res.json();

  if (!Array.isArray(data) || !data[0]) {
    throw new Error(`No quote data found for "${symbol}".`);
  }

  const quote = normalizeFMPQuote(data[0], symbol, type);

  APP_STATE.currentQuote = quote;
  return quote;
}

export async function getHistoricalPricesFMP(ticker, days = 30) {
  const url = `${FMP_BASE_URL}/historical-price-eod/full?symbol=${ticker}&apikey=${CONFIG.FMP_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  return data.slice(0, days);
}

function normalizeProfileType(type) {
  return type?.toLowerCase().trim();
}

export async function getCompanyProfile(symbol, type = "Common Stock") {
  const normalizedType = normalizeProfileType(type);
  console.log(normalizedType)
  if (normalizedType === "cryptocurrency") {
    const crypto = APP_STATE.cryptoList?.find((coin) => {
      const normalizedCoinSymbol = coin.symbol
        ?.replace(/usd$/i, "")
        .toLowerCase();

      const normalizedSearchSymbol = symbol
        ?.replace(/usd$/i, "")
        .toLowerCase();

      return normalizedCoinSymbol === normalizedSearchSymbol;
    });
    console.log({
      symbol,
      crypto,
      logo: crypto?.logo,
    });
    console.log("APPSTATEIMGS: ", APP_STATE.cryptoImgs);
    const profile = {
      ticker: symbol,
      type,
      company: crypto?.name ?? symbol,
      logo: crypto?.logo ?? null,
      industry: "Cryptocurrency",
      exchange: crypto?.exchange ?? "",
      website: "",
      country: "",
      currency: crypto?.currency ?? "",
      ipo: "",
      marketCap: null,
      phone: "",
      shareOutstanding: null,
    };

    APP_STATE.currentProfile = profile;
    return profile;
  }

  if (normalizedType === "index") {
    const index = APP_STATE.indexList?.find(
      (item) => item.symbol === symbol
    );

    const profile = {
      ticker: symbol,
      type,
      company: index?.name ?? symbol,
      logo: null,
      industry: "Index",
      exchange: index?.exchange ?? "",
      website: "",
      country: "",
      currency: index?.currency ?? "",
      ipo: "",
      marketCap: null,
      phone: "",
      shareOutstanding: null,
    };

    APP_STATE.currentProfile = profile;
    return profile;
  }

  let res;

  try {
    res = await fetch(
      `${FMP_BASE_URL}/profile?symbol=${encodeURIComponent(symbol)}&apikey=${CONFIG.FMP_API_KEY}`
    );
  } catch (err) {
    throw new Error(`Network error fetching profile for ${symbol}. Check your connection.`);
  }

  if (!res.ok) {
    throw new Error(`Failed to load profile for ${symbol} (HTTP ${res.status}).`);
  }

  const data = await res.json();

  if (!Array.isArray(data) || !data[0]) {
    throw new Error(`No company profile found for "${symbol}".`);
  }

  const item = data[0];

  const profile = {
    ticker: item.symbol,
    type,
    company: item.companyName ?? item.name ?? symbol,
    logo: item.image,
    industry:
      normalizedType === "etf"
        ? "ETF"
        : item.industry,
    exchange: item.exchange,
    website: item.website,
    country: item.country,
    currency: item.currency,
    ipo: item.ipoDate,
    marketCap: item.marketCap,
    phone: item.phone,
    shareOutstanding:
      item.mktCap && item.price
        ? item.mktCap / item.price
        : item.marketCap && item.price
          ? item.marketCap / item.price
          : null,
  };

  APP_STATE.currentProfile = profile;
  return profile;
}

export async function getPeers(symbol) {
  const res = await fetch(`${FMP_BASE_URL}/stock-peers?symbol=${symbol}&apikey=${CONFIG.FMP_API_KEY}`);
  if (!res.ok) throw new Error(`Failed to load peers for ${symbol} (HTTP ${res.status}).`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return [];
  if (data[0].peersList) return data[0].peersList;
  return data.map(item => item.symbol ?? item).filter(Boolean);
}

function getNewsEndpointByType(type) {
  const normalizedType = type?.toLowerCase().trim();

  switch (normalizedType) {
    case "cryptocurrency":
      return "news/crypto";

    case "forex":
      return "news/forex"

    case "etf":
    case "common stock":
    case "stock":
    default:
      return "news/stock";
  }
}

function normalizeFMPNewsArticle(article, index) {
  return {
    id: article.id ?? article.url ?? index,
    headline: article.title ?? article.headline ?? "Untitled",
    summary: article.text ?? article.summary ?? article.site ?? "",
    source: article.site ?? article.source ?? "",
    url: article.url,
    image: article.image,
    datetime: article.publishedDate
      ? Math.floor(new Date(article.publishedDate).getTime() / 1000)
      : null,
  };
}

export async function getCompanyNews(symbol, type = "Common Stock") {
  const endpoint = getNewsEndpointByType(type);
  const normalizedType = type?.toLowerCase().trim();

  const url = `${FMP_BASE_URL}/${endpoint}?symbols=${encodeURIComponent(symbol)}&apikey=${CONFIG.FMP_API_KEY}`;

  const res = await fetch(url);
  let pr = null;
  if (!res.ok) {
    throw new Error(`Failed to load news for ${symbol} (HTTP ${res.status}).`);
  }

  const data = await res.json();

  if (!Array.isArray(data)) return [];

  let articles = data;

  // For indexes, general-news is broader, so loosely filter by symbol/name if possible.
  if (normalizedType === "index") {
    const q = symbol.toLowerCase();

    articles = data.filter((article) => {
      const title = article.title?.toLowerCase() ?? "";
      const text = article.text?.toLowerCase() ?? "";
      return title.includes(q) || text.includes(q);
    });

    // If filtering removes everything, still show general market news.
    if (articles.length === 0) {
      articles = data;
    }
  }

  let prArticles = [];
  if (normalizedType === "common stock") {
    pr = await fetch(`${FMP_BASE_URL}/news/press-releases?symbols=${symbol}&apikey=${CONFIG.FMP_API_KEY}`);

    if (!pr.ok) {
      throw new Error(`Failed to load news for ${symbol} (HTTP ${pr.status}).`);
    }

    const prData = await pr.json();

    if (!Array.isArray(prData)) return [];

    prArticles = prData;
  }

  return [
    ...articles
      .slice(0, 10)
      .map((article, index) => normalizeFMPNewsArticle(article, index)),

    ...prArticles
      .slice(0, 10)
      .map((article, index) => normalizeFMPNewsArticle(article, index)),
  ];
}

export async function getTopGainers(numGainers) {
  try {
    const res = await fetch(`${FMP_BASE_URL}/biggest-gainers?apikey=${CONFIG.FMP_API_KEY}`);
    if (!res.ok) throw new Error(`gainers request failed (${res.status})`);

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Unexpected response from gainers API");

    const results = data.slice(0, numGainers);

    if (AppState.current) {
      AppState.current.topGainers = results;
    }

    return results;
  } catch (err) {
    console.error("top gainers failed:", err);
    return [];
  }
}

export async function getTopTraded(numTraded) {
  try {
    const res = await fetch(`${FMP_BASE_URL}/most-actives?apikey=${CONFIG.FMP_API_KEY}`);
    if (!res.ok) throw new Error(`top traded request failed (${res.status})`);

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Unexpected response from top traded API");

    const results = data.slice(0, numTraded);

    if (AppState.current) {
      AppState.current.topTraded = results;
    }

    return results;
  } catch (err) {
    console.error("top traded failed:", err);
    return [];
  }
}

export async function getTopLosers(numLosers) {
  try {
    const res = await fetch(
      `${FMP_BASE_URL}/biggest-losers?apikey=${CONFIG.FMP_API_KEY}`
    );

    if (!res.ok) {
      throw new Error(`losers request failed (${res.status})`);
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      throw new Error("Unexpected response from losers API");
    }

    const results = data.slice(0, numLosers);

    if (AppState.current) {
      AppState.current.topLosers = results;
    }

    return results;

  } catch (err) {
    console.error("top losers failed:", err);
    return [];
  }
}

export async function getHistoricalChartData(symbol, from, to) {
  const params = new URLSearchParams({
    symbol,
    apikey: CONFIG.FMP_API_KEY
  });

  if (from) {
    params.append("from", from);
  }

  if (to) {
    params.append("to", to);
  }

  const url = `${FMP_BASE_URL}/historical-price-eod/full?${params}`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Could not fetch historical chart data for ${symbol}`);
  }

  const data = await res.json();
  console.log("Historical API response:", data);
  return Array.isArray(data) ? data : [];
}

export async function getIntradayChartData(symbol, interval = "5min", from = null, to = null) {
  const allowedIntervals = new Set([
    "1min",
    "5min",
    "15min",
    "30min",
    "1hour",
    "4hour"
  ]);

  if (!allowedIntervals.has(interval)) {
    throw new Error(`Invalid interval: ${interval}`);
  }

  const params = new URLSearchParams({
    symbol: symbol.toUpperCase(),
    apikey: CONFIG.FMP_API_KEY
  });

  if (from) params.append("from", from);
  if (to) params.append("to", to);

  const url = `${FMP_BASE_URL}/historical-chart/${interval}?${params}`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch intraday chart data for ${symbol}`);
  }

  const data = await res.json();

  return data.map(candle => ({
    x: new Date(candle.date).getTime(),
    o: candle.open,
    h: candle.high,
    l: candle.low,
    c: candle.close,
    v: candle.volume
  })).reverse();
}
