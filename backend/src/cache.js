import crypto from 'crypto';

class ResearchCache {
    constructor(ttlMs = 1000 * 60 * 60 * 24) {
        this.cache = new Map();
        this.ttlMs = ttlMs;
        console.log(`[cache] Initialized in-memory atomic cache (TTL: ${ttlMs / 1000 / 60}m)`);
    }

    generateKey(query, model) {
        const hash = crypto.createHash('sha256')
            .update(`${model}:${query.trim().toLowerCase()}`)
            .digest('hex');
        return hash;
    }

    get(query, model) {
        const key = this.generateKey(query, model);
        const entry = this.cache.get(key);

        if (!entry) return null;

        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }

        console.log(`[cache] HIT for: ${query.slice(0, 40)}... [${model}]`);
        return entry.value;
    }

    set(query, model, value) {
        const key = this.generateKey(query, model);
        this.cache.set(key, {
            value,
            expiry: Date.now() + this.ttlMs,
            timestamp: new Date().toISOString()
        });
        console.log(`[cache] SET for: ${query.slice(0, 40)}... [${model}]`);
    }

    prune() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiry) this.cache.delete(key);
        }
    }
}

export const researchCache = new ResearchCache();