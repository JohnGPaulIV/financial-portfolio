export class AllocationTracker {
    constructor(counts = []) {
        this.counts = new Map(counts);
        this.percentages = new Map();
        this.totalCount = 0;

        for (const count of this.counts.values()) {
            this.totalCount += count;
        }

        this.recalculate();
    }

    add(key, amount = 1) {
        if (!key) return false;

        this.counts.set(key, (this.counts.get(key) ?? 0) + amount);
        this.totalCount += amount;
        this.recalculate();

        return true;
    }

    remove(key, amount = 1) {
        if (!key || !this.counts.has(key)) return false;

        const current = this.counts.get(key);
        const next = current - amount;

        if (next <= 0) {
            this.counts.delete(key);
            this.totalCount -= current;
        } else {
            this.counts.set(key, next);
            this.totalCount -= amount;
        }

        this.recalculate();
        return true;
    }

    recalculate() {
        this.percentages.clear();

        if (this.totalCount <= 0) return;

        for (const [key, count] of this.counts) {
            this.percentages.set(key, count / this.totalCount);
        }
    }

    toJSON() {
        return {
            counts: [...this.counts.entries()],
        };
    }

    static fromJSON(data = {}) {
        return new AllocationTracker(data.counts ?? []);
    }
}

export class UserHoldings {
    constructor(data = {}) {
        this.items = new Map(data.items ?? []);
        this.history = data.history ?? [];

        this.industryTracker = AllocationTracker.fromJSON(data.industryTracker);
        this.sectorTracker = AllocationTracker.fromJSON(data.sectorTracker);
        this.exchangeTracker = AllocationTracker.fromJSON(data.exchangeTracker);
        this.countryTracker = AllocationTracker.fromJSON(data.countryTracker);
    }

    addAllocationMetadata(asset) {
        this.industryTracker.add(asset.industry);
        this.sectorTracker.add(asset.sector);
        this.exchangeTracker.add(asset.exchangeShortName ?? asset.exchange);
        this.countryTracker.add(asset.country);
    }

    removeAllocationMetadata(asset) {
        this.industryTracker.remove(asset.industry);
        this.sectorTracker.remove(asset.sector);
        this.exchangeTracker.remove(asset.exchangeShortName ?? asset.exchange);
        this.countryTracker.remove(asset.country);
    }

    has(symbol) {
        return this.items.has(symbol?.toUpperCase());
    }

    get(symbol) {
        return this.items.get(symbol?.toUpperCase());
    }

    all() {
        return [...this.items.values()];
    }
}