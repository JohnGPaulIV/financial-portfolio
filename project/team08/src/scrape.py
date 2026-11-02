"""Scrape yfinance data and save to JSON file."""
import yfinance as yf
import json

tickers = [
    "NVDA", "GOOGL", "AAPL", "MSFT", "AMZN", "META", "TSLA", "BRK-B",
    "AVGO", "TSM", "LLY", "JPM", "WMT", "V", "XOM", "ORCL", "MA", "UNH",
    "COST", "JNJ", "HD", "PG", "NFLX", "BAC", "ABBV", "CRM", "CVX", "KO",
    "AMD", "PLTR", "WFC", "TMUS", "CSCO", "ADBE", "MRK", "ACN", "PEP",
    "LIN", "NOW", "MCD", "IBM", "AXP", "DIS", "TMO", "ABT", "GE", "ISRG",
    "QCOM", "CAT", "GS", "INTU", "VZ", "MS", "T", "BKNG", "RTX", "PFE",
    "TXN", "PGR", "SPGI", "UBER", "NEE", "UNP", "LOW", "HON", "ETN", "AMGN",
    "BLK", "BSX", "SYK", "DHR", "C", "PM", "TJX", "COP", "ANET", "VRTX",
    "SCHW", "PANW", "GILD", "CMCSA", "DE", "ADP", "LMT", "MDT", "NKE",
    "MMC", "BX", "SBUX", "CB", "PLD", "MU", "ADI", "KLAC", "LRCX", "INTC",
    "MDLZ", "CI", "SO", "REGN", "AMAT", "ASML", "ARM", "CRWD", "SNOW", "SHOP",
    "MELI", "DDOG", "NET", "SMCI", "MSTR", "APP", "SE", "CMG", "ELV", "KKR",
    "APH", "TT", "PH", "HWM", "RCL", "CCL", "NVO", "AZN", "SAP", "TM",
    "SONY", "BABA", "NVS", "SHEL", "BP", "RIO", "WDAY", "ZS", "MDB", "FTNT",
    "MAR", "ABNB", "CRH", "TRGP", "OKE", "CTAS", "PAYX", "ORLY", "AON", "ITW",
]

dataset = {}
failed = []

for ticker in tickers:
    try:
        hist = yf.Ticker(ticker).history(period="1y")
        
        # Check if we actually got data back
        if hist.empty:
            print(f"No data for {ticker}, skipping")
            failed.append(ticker)
            continue
        
        dataset[ticker] = {
            "dates": hist.index.strftime("%Y-%m-%d").tolist(),
            "close": [round(x, 2) for x in hist["Close"].tolist()],
            "volume": [int(x) for x in hist["Volume"].tolist()]
        }
        print(f"{ticker} ({len(hist)} days)")
    
    except Exception as e:
        print(f"Error fetching {ticker}: {e}")
        failed.append(ticker)
        continue

with open("stock_data.json", "w") as f:
    json.dump(dataset, f, indent=4) #change indent

print(f"\nDone! Saved {len(dataset)} tickers.")
if failed:
    print(f"Failed: {failed}")