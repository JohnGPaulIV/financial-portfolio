export function guessTypeFromStockList(row) {
    const symbol = row.symbol?.toUpperCase() ?? "";
    const name = row.companyName ?? row.name ?? "";

    if (/ETF/i.test(name)) return "etf";
    if (/ETN/i.test(name)) return "etn";
    if (/Index Fund|Fund Class|Mutual Fund|Admiral Shares|Investor Shares/i.test(name)) {
        return "mutual_fund";
    }
    if (symbol.startsWith("^") || /Index$/i.test(name)) return "index";

    return "unknown";
}