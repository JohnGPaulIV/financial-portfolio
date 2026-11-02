import { loadUserData, getUserKey } from "../storage/userStorage.js";
import {
  fetchCryptoImgs,
  fetchFMPETFs,
  fetchFMPIndexes,
  fetchFMPCryptos,
} from "../api.js";

export let APP_STATE = null;

export function createAppState(userData) {
  return {
    currentUser: userData.username,
    password: userData.password,

    portfolio: structuredClone(userData.portfolio),
    watchlist: structuredClone(userData.watchlist),
    settings: structuredClone(userData.settings),

    searchResults: [],
    topGainers: [],
    topLosers: [],
    etfList: [],
    cryptoList: [],
    indexList: [],
    cryptoImgs: new Map(),
    currentHistoricalSymbol: null,
    currentHistoricalStart: null,
    currentHistoricalEnd: null,
    currentHistoricalData: [],
    currentQuote: null,
    currentProfile: null,
  };
}

export function setAppState(newState) {
  APP_STATE = newState;
}

export function clearAppState() {
  APP_STATE = null;
}

export function getPersistedUserData(state) {
  return {
    username: state.currentUser,
    password: state.password,
    portfolio: state.portfolio,
    watchlist: state.watchlist,
    settings: state.settings,
  };
}

export async function hydrateAppState() {
  const username = localStorage.getItem("team08_currentUser");

  if (!username) {
    console.log("No current user");
    return false;
  }

  const userData = loadUserData(username);

  if (!userData) {
    console.log("No saved user data");
    return false;
  }

  setAppState(createAppState(userData));

  await fetchCryptoImgs();

  await Promise.all([
    fetchFMPETFs(),
    fetchFMPIndexes(),
    fetchFMPCryptos(),
  ]);

  return true;
}