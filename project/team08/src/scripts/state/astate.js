import { loadUserData } from "../storage/userStorage.js";
import { User } from "../models/userClass.js";
import { buildAssetRegistry } from "../models/assetFactory.js";
export class AppState {
    static current = null;

    constructor(user) {
        this.user = user;

        this.assetRegistry = null;

        this.searchResults = [];
        this.topGainers = [];
        this.topLosers = [];

        this.currentSymbol = null;
        this.currentQuote = null;
        this.currentProfile = null;
        this.currentPeers = null;

        this.currentHistoricalSymbol = null;
        this.currentHistoricalStart = null;
        this.currentHistoricalEnd = null;
        this.currentHistoricalData = [];
    }

    static async hydrate() {
        const username = localStorage.getItem("team08_currentUser");

        if (!username) {
            AppState.relocateClient();
            return null;
        }

        const userData = loadUserData(username);

        if (!userData) {
            AppState.relocateClient();
            return null;
        }

        const user = User.fromJSON(userData);
        const state = new AppState(user);

        state.assetRegistry = await buildAssetRegistry();

        AppState.current = state;

        return state;
    }

    static relocateClient(loc = "login.html") {
        const users = JSON.parse(localStorage.getItem("team08_users") ?? "[]");
        window.location.replace(users.length > 0 ? loc : "signup.html");
    }

    getPersistedUserData() {
        return this.user.toJSON();
    }

    getAsset(symbol) {
        return this.assetRegistry.get(symbol);
    }

    searchAssets(query) {
        const q = query.toLowerCase().trim();

        const scoredResults = this.assetRegistry.all()
            .filter(asset =>
                this.user.settings.searchIncludes.has(asset.type)
            )
            .map(asset => {
                const symbol = asset.symbol.toLowerCase();
                const name = asset.name.toLowerCase();

                let score = 0;

                // Highest priority
                if (symbol === q) score += 1000;

                // Symbol starts with query
                if (symbol.startsWith(q)) score += 500;

                // Name starts with query
                if (name.startsWith(q)) score += 250;

                // Symbol contains query
                if (symbol.includes(q)) score += 100;

                // Name contains query
                if (name.includes(q)) score += 50;

                // Prefer shorter symbols/names slightly
                score -= symbol.length * 0.1;

                return { asset, score };
            })
            .filter(result => result.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(result => result.asset);

        this.searchResults = scoredResults;

        return scoredResults;
    }
}