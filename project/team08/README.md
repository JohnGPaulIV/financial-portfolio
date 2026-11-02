# Tradar — Stock Portfolio App

A client-side stock portfolio and market tracking web application. Users can manage holdings, monitor a watchlist, explore market data, and view interactive charts, all persisted in browser `localStorage` with live data fetched from external financial APIs.

---

## Architecture

```
src/
├── config.js                  # API keys (Finnhub + FMP)
├── index.html                 # Root redirect → pages/index.html
│
├── pages/                     # One HTML file per view
│   ├── index.html             # Landing / home
│   ├── login.html
│   ├── signup.html
│   ├── dashboard.html         # Portfolio overview
│   ├── explore.html           # Market explorer
│   ├── watchlist.html
│   ├── stock-details.html     # Per-symbol detail view
│   └── preferences.html
│
├── scripts/
│   ├── api.js                 # All external API calls (Finnhub, FMP, CoinGecko)
│   ├── initPage.js            
│   ├── search.js              # Search bar + toast notifications
│   ├── ui.js                  # Shared UI helpers
│   │
│   ├── pages/                 # Page-specific controllers
│   │   ├── dashboard.js       # Portfolio + live WebSocket prices
│   │   ├── explore.js         # Market screener / movers
│   │   ├── home.js
│   │   ├── login-page.js
│   │   ├── signup-page.js
│   │   ├── stock-details.js   # Charts, news, peers, company info
│   │   ├── watchlist.js
│   │   ├── preferences.js
│   │   └── card-creator.js    # Reusable card factory for search results
│   │
│   ├── models/                # Domain classes
│   │   ├── asset.js           # Base Asset class (FMP quote/profile/peers)
│   │   ├── assetFactory.js    # Factory: builds typed Asset from search result
│   │   ├── assetTypes.js      # Asset type constants (Stock, ETF, Crypto, …)
│   │   ├── card.js            # Card UI model
│   │   ├── stock.js           # Stock subclass
│   │   ├── user.js            # User domain object
│   │   ├── userClass.js       # User class with portfolio/watchlist methods
│   │   ├── userHoldings.js    # UserHoldings + AllocationTracker
│   │   └── builderHelpers.js
│   │
│   ├── state/
│   │   ├── appState.js        # Global APP_STATE singleton + hydration
│   │   └── astate.js           
│   │
│   ├── storage/
│   │   └── userStorage.js     # localStorage read/write (key: team08_user_<name>)
│   │
│   └── utils/
│       ├── formatting.js      # Currency, percentage, price formatters
│       ├── currency.js        # Currency helpers
│       └── enpoints.js        # Endpoint string builders
│
├── styles/                    # Per-page CSS
│   ├── constant.css           # CSS variables / design tokens
│   ├── cards.css
│   ├── auth.css
│   ├── prefs.css
│   └── stock-details.css
│
└── 
```

### Data flow

```
User action
    │
    ▼
Page controller (scripts/pages/*.js)
    │  reads/writes
    ▼
AppState singleton (scripts/state/appState.js)
    │  persists user data via
    ▼
userStorage.js  ──►  localStorage
    │
    └── on-demand API calls
            │
            ├── Finnhub REST  (quotes, search, WebSocket stream)
            ├── FMP REST      (profiles, news, charts, screener, movers)
            └── CoinGecko REST (crypto images, crypto markets)
```

---

## APIs Used

- **Finnhub**: Real-time stock quotes, symbol search, live WebSocket price stream. https://finnhub.io/docs/api
- **Financial Modeling Prep (FMP)**: Company profiles, historical/intraday price charts, ETF/index/crypto lists, market movers (gainers, losers, most-active), news, press releases, stock peers. https://site.financialmodelingprep.com/developer/docs
- **CoinGecko**: Cryptocurrency market data and coin logos. https://docs.coingecko.com/reference/introduction

---