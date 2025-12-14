const CACHE_PREFIX = 'portfolio_cache_';
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 Hours

interface CacheEntry<T> {
    timestamp: number;
    data: T;
    version: number;
}

const CURRENT_VERSION = 1;

export const ClientCache = {
    get: <T>(key: string): T | null => {
        if (typeof window === 'undefined') return null;
        try {
            const item = localStorage.getItem(CACHE_PREFIX + key);
            if (!item) return null;

            const entry: CacheEntry<T> = JSON.parse(item);

            // Version Check
            if (entry.version !== CURRENT_VERSION) {
                localStorage.removeItem(CACHE_PREFIX + key);
                return null;
            }

            // TTL Check
            if (Date.now() - entry.timestamp > DEFAULT_TTL) {
                localStorage.removeItem(CACHE_PREFIX + key);
                return null;
            }

            return entry.data;
        } catch (e) {
            console.error('Cache Read Error', e);
            return null;
        }
    },

    set: <T>(key: string, data: T): void => {
        if (typeof window === 'undefined') return;
        try {
            const entry: CacheEntry<T> = {
                timestamp: Date.now(),
                data,
                version: CURRENT_VERSION
            };
            localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
        } catch (e) {
            console.error('Cache Write Error', e);
            // Handle QuotaExceeded
            if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
                console.warn('LocalStorage Quota Exceeded. Clearing old cache.');
                ClientCache.clear();
            }
        }
    },

    generateKey: (base: string, params: Record<string, any>): string => {
        // Sort keys to ensure stability
        const stableString = JSON.stringify(params, Object.keys(params).sort());
        // Simple hash or btoa to safe string
        return `${base}_${btoa(stableString)}`;
    },

    clear: () => {
        if (typeof window === 'undefined') return;
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(CACHE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
    }
};
