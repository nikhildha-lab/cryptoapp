type CacheEntry<T> = {
    value: T;
    expiry: number;
};

const cache = new Map<string, CacheEntry<any>>();

export const memoryCache = {
    get: <T>(key: string): T | null => {
        const entry = cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiry) {
            cache.delete(key);
            return null;
        }
        return entry.value;
    },

    set: <T>(key: string, value: T, ttlSeconds: number): void => {
        const expiry = Date.now() + ttlSeconds * 1000;
        cache.set(key, { value, expiry });
    },

    delete: (key: string): void => {
        cache.delete(key);
    },
};
