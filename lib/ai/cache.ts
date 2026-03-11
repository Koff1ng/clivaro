type CacheEntry<T> = {
    value: T;
    expiry: number;
};

/**
 * Simple in-memory cache with TTL (Time To Live).
 */
class AICache {
    private cache: Map<string, CacheEntry<any>> = new Map();

    /**
     * Get item from cache if not expired
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }

        return entry.value as T;
    }

    /**
     * Set item in cache with TTL in seconds
     */
    set<T>(key: string, value: T, ttlSeconds: number = 3600): void {
        this.cache.set(key, {
            value,
            expiry: Date.now() + ttlSeconds * 1000,
        });
    }

    /**
     * Clear cache
     */
    clear(): void {
        this.cache.clear();
    }
}

export const aiCache = new AICache();
