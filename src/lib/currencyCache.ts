const CACHE_DURATION = 8 * 60 * 60 * 1000; // 8 hours

interface CachedRate {
    rate: number;
    timestamp: number;
}

export async function getExchangeRate(from: string, to: string): Promise<number | null> {
    if (from === to) return 1;

    const CACHE_KEY = `rate_${from}_${to}`;

    // Try to load from cache
    if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const { rate, timestamp } = JSON.parse(cached) as CachedRate;
                const age = Date.now() - timestamp;
                if (age < CACHE_DURATION) {
                    // console.log(`[Cache Hit] ${from}->${to}`);
                    return rate;
                }
            } catch (e) {
                console.error('Failed to parse cached rate', e);
            }
        }
    }

    try {
        const res = await fetch(`/api/currencies?from=${from}&to=${to}`);
        const data = await res.json();

        const rateToCache = data.rate || null;

        // Save to cache (even if null/failed, to prevent retry for 8h)
        if (typeof window !== 'undefined') {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                rate: rateToCache,
                timestamp: Date.now()
            }));
        }

        return rateToCache;
    } catch (error) {
        console.error(`Failed to fetch rate for ${from} -> ${to}`, error);
        return null;
    }
}
