/* eslint-disable @typescript-eslint/no-explicit-any */
import YahooFinance from 'yahoo-finance2';
import { prisma } from '@/lib/prisma';

const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey']
});

export interface StockSearchResult {
    symbol: string;
    name: string;
    exchange: string;
    type: string;
}

export interface MarketData {
    symbol: string;
    price: number;
    currency: string;
    regularMarketTime: Date;
    regularMarketChange: number;
    regularMarketChangePercent: number;
    sector?: string;
    country?: string;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    sectorAllocations?: any[];
    countryAllocations?: any[];
    dividendRate?: number;
    dividendYield?: number;
    exDividendDate?: Date;
    name?: string;
}

export class MarketDataService {
    /**
     * Search for symbols (stocks, ETFs, etc.)
     */
    static async searchSymbols(query: string): Promise<StockSearchResult[]> {
        try {
            // Simplify query options to reduce chance of 400 errors
            const results = await yahooFinance.search(query, {
                quotesCount: 10,
                newsCount: 0,
                enableNavLinks: false,
                enableEnhancedTrivialQuery: false
            }) as any;

            if (!results.quotes) return [];

            return results.quotes
                .filter((quote: any) => quote.isYahooFinance)
                .map((quote: any) => ({
                    symbol: quote.symbol,
                    name: quote.shortname || quote.longname || quote.symbol,
                    exchange: quote.exchange,
                    type: quote.quoteType,
                }));
        } catch (error) {
            console.error('Error searching symbols:', error);
            // Return empty array on error instead of crashing
            return [];
        }
    }

    /**
     * Get current price for a symbol with caching (15 min)
     */
    static async getPrice(symbol: string): Promise<MarketData | null> {
        try {
            // 1. Check Cache
            const cached = await prisma.marketDataCache.findUnique({
                where: { symbol }
            });

            const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
            const now = new Date();

            if (cached && (now.getTime() - cached.lastUpdated.getTime() < CACHE_DURATION)) {
                // If we have cached data, check if we have the new fields (sector/country)
                // For ETFs, sector/country might be null, so we check if we have allocations OR sector/country
                // Also check if we have dividend data if it's expected
                if (cached.sector || cached.country || (cached.sectorAllocations && (cached.sectorAllocations as any[]).length > 0)) {
                    return {
                        symbol: cached.symbol,
                        price: cached.price,
                        currency: cached.currency,
                        regularMarketTime: cached.lastUpdated,
                        regularMarketChange: cached.change,
                        regularMarketChangePercent: cached.changePercent,
                        sector: cached.sector || undefined,
                        country: cached.country || undefined,
                        sectorAllocations: cached.sectorAllocations as any[],
                        countryAllocations: cached.countryAllocations as any[],
                        dividendRate: cached.dividendRate || undefined,
                        dividendYield: cached.dividendYield || undefined,
                        exDividendDate: cached.exDividendDate || undefined,
                        // Note: 52w high/low are not currently cached in the model
                    };
                }
                // If missing critical data, fall through to fetch from API
            }

            // 2. Fetch from API
            // Fetch both Quote (for realtime price) and Summary (for metadata)
            const [quoteRealtime, quoteSummary] = await Promise.all([
                yahooFinance.quote(symbol).catch(e => {
                    console.error(`Error fetching quote for ${symbol}`, e);
                    return null;
                }),
                yahooFinance.quoteSummary(symbol, { modules: ['summaryProfile', 'summaryDetail', 'topHoldings', 'calendarEvents', 'defaultKeyStatistics'] }).catch(e => {
                    console.error(`Error fetching quoteSummary for ${symbol}`, e);
                    return null;
                })
            ]) as [any, any];

            if ((!quoteRealtime || !quoteRealtime.regularMarketPrice) && (!quoteSummary || !quoteSummary.price?.regularMarketPrice)) {
                return null;
            }

            // Prefer Realtime Quote for Price/Change
            const priceVal = quoteRealtime?.regularMarketPrice || quoteSummary?.price?.regularMarketPrice || 0;
            const changeVal = quoteRealtime?.regularMarketChange || quoteSummary?.price?.regularMarketChange || 0;
            const changePercentVal = quoteRealtime?.regularMarketChangePercent || quoteSummary?.price?.regularMarketChangePercent || 0;
            const currencyVal = quoteRealtime?.currency || quoteSummary?.price?.currency || 'USD';
            const nameVal = quoteRealtime?.longName || quoteRealtime?.shortName || quoteSummary?.price?.longName || quoteSummary?.price?.shortName;

            // Use Summary for Metadata
            const profile = quoteSummary?.summaryProfile || {};
            const detail = quoteSummary?.summaryDetail || {};
            const holdings = quoteSummary?.topHoldings || {};
            const calendar = quoteSummary?.calendarEvents || {};
            const keyStats = quoteSummary?.defaultKeyStatistics || {};

            let dividendRate = detail.dividendRate;
            let dividendYield = detail.dividendYield;

            // Fallback for Dividend Rate/Yield
            // Some ETFs/Funds provide 'yield' or 'trailingAnnualDividendYield' instead of 'dividendYield'
            if (!dividendYield) {
                if (detail.yield) {
                    dividendYield = detail.yield;
                } else if (detail.trailingAnnualDividendYield) {
                    dividendYield = detail.trailingAnnualDividendYield;
                } else if (keyStats.yield) {
                    dividendYield = keyStats.yield;
                }
            }

            if (!dividendRate) {
                if (detail.trailingAnnualDividendRate) {
                    dividendRate = detail.trailingAnnualDividendRate;
                }
            }

            // Calculate Rate if missing but Yield exists
            if (!dividendRate && dividendYield && priceVal) {
                dividendRate = priceVal * dividendYield;
            }

            // Calculate Yield if missing but Rate exists
            if (!dividendYield && dividendRate && priceVal) {
                dividendYield = dividendRate / priceVal;
            }

            const data: MarketData = {
                symbol: symbol,
                price: priceVal,
                currency: currencyVal,
                regularMarketTime: quoteRealtime?.regularMarketTime || new Date(),
                regularMarketChange: changeVal,
                regularMarketChangePercent: changePercentVal,
                sector: profile.sector,
                country: profile.country,
                fiftyTwoWeekHigh: detail.fiftyTwoWeekHigh,
                fiftyTwoWeekLow: detail.fiftyTwoWeekLow,
                sectorAllocations: holdings.sectorWeightings || [],
                countryAllocations: [],

                dividendRate: dividendRate,
                dividendYield: dividendYield,
                exDividendDate: calendar.exDividendDate ? new Date(calendar.exDividendDate) : undefined,
                name: nameVal
            };

            // 3. Update Cache
            await prisma.marketDataCache.upsert({
                where: { symbol },
                update: {
                    price: data.price,
                    change: data.regularMarketChange,
                    changePercent: data.regularMarketChangePercent,
                    currency: data.currency,
                    sector: data.sector,
                    country: data.country,
                    sectorAllocations: data.sectorAllocations,
                    countryAllocations: data.countryAllocations,
                    dividendRate: data.dividendRate,
                    dividendYield: data.dividendYield,
                    exDividendDate: data.exDividendDate,
                    lastUpdated: now
                },
                create: {
                    symbol: data.symbol,
                    price: data.price,
                    change: data.regularMarketChange,
                    changePercent: data.regularMarketChangePercent,
                    currency: data.currency,
                    sector: data.sector,
                    country: data.country,
                    sectorAllocations: data.sectorAllocations,
                    countryAllocations: data.countryAllocations,
                    lastUpdated: now
                }
            });

            return data;
        } catch (error) {
            console.error(`Error fetching price for ${symbol}:`, error);
            // Fallback to cache if API fails, even if stale
            const cached = await prisma.marketDataCache.findUnique({ where: { symbol } });
            if (cached) {
                return {
                    symbol: cached.symbol,
                    price: cached.price,
                    currency: cached.currency,
                    regularMarketTime: cached.lastUpdated,
                    regularMarketChange: cached.change,
                    regularMarketChangePercent: cached.changePercent,
                    sector: cached.sector || undefined,
                    country: cached.country || undefined,
                    sectorAllocations: cached.sectorAllocations as any[],
                    countryAllocations: cached.countryAllocations as any[],
                    dividendRate: cached.dividendRate || undefined,
                    dividendYield: cached.dividendYield || undefined,
                    exDividendDate: cached.exDividendDate || undefined
                };
            };
        }
        return null;
    }


    /**
     * Get exchange rate between two currencies
     * Uses Yahoo Finance tickers like "USDINR=X"
     */
    static async getExchangeRate(from: string, to: string): Promise<number | null> {
        if (from === to) return 1;

        // Try direct pair first
        // User requested logic: USD -> Any = Any=X (e.g. USD -> INR = INR=X)
        let symbol = `${from}${to}=X`;
        if (from === 'USD') {
            symbol = `${to}=X`;
        }

        // 1. Check Cache
        try {
            const cached = await prisma.marketDataCache.findUnique({
                where: { symbol }
            });

            const CACHE_DURATION = 8 * 60 * 60 * 1000; // 8 hours
            const now = new Date();

            if (cached && (now.getTime() - cached.lastUpdated.getTime() < CACHE_DURATION)) {
                return cached.price;
            }
        } catch (error) {
            console.error(`Error checking cache for ${symbol}:`, error);
        }

        try {
            const quote = await yahooFinance.quote(symbol) as any;
            if (quote && quote.regularMarketPrice) {
                const price = quote.regularMarketPrice;

                // Update Cache
                await prisma.marketDataCache.upsert({
                    where: { symbol },
                    update: {
                        price: price,
                        change: quote.regularMarketChange || 0,
                        changePercent: quote.regularMarketChangePercent || 0,
                        currency: quote.currency || to,
                        lastUpdated: new Date()
                    },
                    create: {
                        symbol,
                        price: price,
                        change: quote.regularMarketChange || 0,
                        changePercent: quote.regularMarketChangePercent || 0,
                        currency: quote.currency || to,
                        lastUpdated: new Date()
                    }
                });

                return price;
            }
        } catch {
            // Ignore and try reverse
        }

        // Try reverse pair (e.g., INRUSD=X) and invert
        let reverseSymbol = `${to}${from}=X`;
        if (to === 'USD') {
            reverseSymbol = `${from}=X`;
        }

        // Check Cache for Reverse
        try {
            const cached = await prisma.marketDataCache.findUnique({
                where: { symbol: reverseSymbol }
            });

            const CACHE_DURATION = 8 * 60 * 60 * 1000; // 8 hours
            const now = new Date();

            if (cached && (now.getTime() - cached.lastUpdated.getTime() < CACHE_DURATION)) {
                return 1 / cached.price;
            }
        } catch (error) {
            console.error(`Error checking cache for ${reverseSymbol}:`, error);
        }

        try {
            const quote = await yahooFinance.quote(reverseSymbol) as any;
            if (quote && quote.regularMarketPrice) {
                const price = quote.regularMarketPrice;

                // Update Cache for Reverse
                await prisma.marketDataCache.upsert({
                    where: { symbol: reverseSymbol },
                    update: {
                        price: price,
                        change: quote.regularMarketChange || 0,
                        changePercent: quote.regularMarketChangePercent || 0,
                        currency: quote.currency || from,
                        lastUpdated: new Date()
                    },
                    create: {
                        symbol: reverseSymbol,
                        price: price,
                        change: quote.regularMarketChange || 0,
                        changePercent: quote.regularMarketChangePercent || 0,
                        currency: quote.currency || from,
                        lastUpdated: new Date()
                    }
                });

                return 1 / price;
            }
        } catch (error) {
            console.error(`Error fetching exchange rate for ${from}/${to}:`, error);

            // Fallback: Check cache again, return it even if expired (stale data is better than no data)
            const cached = await prisma.marketDataCache.findUnique({
                where: { symbol: reverseSymbol } // Corrected to use reverseSymbol for fallback
            });

            if (cached) {
                console.warn(`Using stale cache for ${reverseSymbol} due to API error`); // Corrected to use reverseSymbol
                return 1 / cached.price; // Invert the cached price as it's for the reverse symbol
            }
        }

        return null;
    }

    /**
     * Get historical exchange rate for a specific date
     */
    static async getHistoricalExchangeRate(from: string, to: string, date: Date): Promise<number | null> {
        if (from === to) return 1;

        const getRateForSymbol = async (ticker: string): Promise<number | null> => {
            try {
                // Fetch window around date to handle weekends/holidays
                const startDate = new Date(date);
                startDate.setDate(startDate.getDate() - 4); // Look back 4 days
                const endDate = new Date(date);
                endDate.setDate(endDate.getDate() + 1); // Look forward 1 day

                const result = await yahooFinance.chart(ticker, {
                    period1: startDate,
                    period2: endDate,
                    interval: '1d'
                }) as any;

                const quotes = result?.quotes || [];
                if (quotes.length === 0) return null;

                // Find the quote closest to but usually before or on the transaction date
                // Since we sort by date, we can just grab the valid one closest to our target date
                // Reverse iterate to find the latest valid quote on or before the target date
                const targetTime = date.getTime();

                // Sort quotes just in case
                quotes.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

                let bestQuote = null;
                for (const q of quotes) {
                    const qTime = new Date(q.date).getTime();
                    if (qTime <= targetTime + (24 * 60 * 60 * 1000)) { // Allow same day (considering timezones)
                        if (q.close || q.adjClose) {
                            bestQuote = q;
                        }
                    }
                }

                // If we didn't find one before, maybe one slightly after (e.g. strict weekend boundary)?
                // Strict logic: Closest one available.
                if (!bestQuote && quotes.length > 0) bestQuote = quotes[quotes.length - 1];

                return bestQuote ? (bestQuote.close || bestQuote.adjClose) : null;

            } catch {
                // console.warn(`Failed history rate for ${ticker}`, e);
                return null;
            }
        };

        // Try direct pair
        let symbol = `${from}${to}=X`;
        if (from === 'USD') symbol = `${to}=X`;

        const rate = await getRateForSymbol(symbol);
        if (rate) return rate;

        // Try reverse pair
        let reverseSymbol = `${to}${from}=X`;
        if (to === 'USD') reverseSymbol = `${from}=X`;

        const reverseRate = await getRateForSymbol(reverseSymbol);
        if (reverseRate) return 1 / reverseRate;

        return null; // Both failed
    }

    /**
     * Helper to process raw quotes into a history object with period snapshots
     */
    static processHistory(quotes: any[]): Record<string, number> {
        if (!quotes || quotes.length === 0) return {};

        const prices: Record<string, number> = {};

        // 1. Store daily prices
        for (const quote of quotes) {
            if (quote.date && (quote.close || quote.adjClose)) {
                const dateStr = new Date(quote.date).toISOString().split('T')[0];
                prices[dateStr] = quote.close || quote.adjClose;
            }
        }

        // 2. Calculate period snapshots
        const findPrice = (targetDate: Date) => {
            const targetTime = targetDate.getTime();
            let closest = quotes[0];

            for (const candle of quotes) {
                const candleTime = new Date(candle.date).getTime();
                if (candleTime <= targetTime) {
                    closest = candle;
                } else {
                    break;
                }
            }
            return closest?.close || closest?.adjClose || 0;
        };

        const today = new Date();

        // 1 Week ago
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        prices['1W'] = findPrice(oneWeekAgo);

        // 1 Month ago
        const oneMonthAgo = new Date(today);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        prices['1M'] = findPrice(oneMonthAgo);

        // 1 Year ago
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        prices['1Y'] = findPrice(oneYearAgo);

        // YTD (Jan 1st of current year)
        const ytd = new Date(today.getFullYear(), 0, 1);
        prices['YTD'] = findPrice(ytd);

        return prices;
    }

    /**
     * Get historical prices for performance calculation with caching (24h)
     * Returns map of period -> price
     */
    static async getHistoricalPrices(symbol: string): Promise<Record<string, number>> {
        try {
            // 1. Check Cache
            const cached = await prisma.marketDataCache.findUnique({
                where: { symbol }
            });

            const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
            const now = new Date();

            if (cached?.history && (now.getTime() - cached.lastUpdated.getTime() < CACHE_DURATION)) {
                // Check if history is valid JSON object
                if (typeof cached.history === 'object' && cached.history !== null) {
                    // Check if we have the required keys, if not, re-fetch
                    const h = cached.history as Record<string, number>;
                    if (h['1W'] && h['1M'] && h['1Y'] && h['YTD']) {
                        return h;
                    }
                }
            }

            // 2. Fetch from API
            const endDate = new Date();
            const startDate = new Date();
            startDate.setFullYear(startDate.getFullYear() - 20); // Fetch up to 20 years back
            startDate.setDate(startDate.getDate() - 7); // Add buffer

            const queryOptions = {
                period1: startDate,
                period2: endDate,
                interval: '1d' as const,
            };

            // Use chart() instead of historical() as the latter is deprecated/broken
            const result = await yahooFinance.chart(symbol, queryOptions) as any;
            const quotes = result?.quotes || [];

            const prices = this.processHistory(quotes);

            // 3. Update Cache (merge with existing if possible, but here we just update history)
            await prisma.marketDataCache.upsert({
                where: { symbol },
                update: {
                    history: prices,
                    lastUpdated: now
                },
                create: {
                    symbol,
                    price: 0, // Placeholder if creating from history call first
                    change: 0,
                    changePercent: 0,
                    currency: 'USD', // Default
                    history: prices,
                    lastUpdated: now
                }
            });

            return prices;

        } catch (error) {
            console.error(`Error fetching historical for ${symbol}:`, error);
            // Fallback to cache
            const cached = await prisma.marketDataCache.findUnique({ where: { symbol } });
            if (cached?.history && typeof cached.history === 'object') {
                return cached.history as Record<string, number>;
            }
            return {};
        }
    }

    /**
     * Get full daily history for a symbol from a start date.
     * Essential for Portfolio Unitization.
     */
    static async getDailyHistory(symbol: string, fromDate?: Date): Promise<Record<string, number>> {
        try {
            // 1. Check Cache
            const cached = await prisma.marketDataCache.findUnique({
                where: { symbol }
            });

            // Cache Validity: 12 Hours (to ensure daily updates)
            const CACHE_DURATION = 12 * 60 * 60 * 1000;
            const now = new Date();

            if (cached?.history && (now.getTime() - cached.lastUpdated.getTime() < CACHE_DURATION)) {
                // Return cached history if it looks like a full map (has many keys)
                const h = cached.history as Record<string, number>;
                const keys = Object.keys(h).filter(k => k.match(/^\d{4}-\d{2}-\d{2}$/)); // Filter YYYY-MM-DD

                // If we have a reasonable amount of history (e.g. > 10 points), use it
                // We rely on the caller to handle missing specific dates if the cache is slightly out of sync
                if (keys.length > 10) {
                    return h;
                }
            }

            // 2. Fetch from API
            const endDate = new Date();
            const startDate = fromDate || new Date(new Date().setFullYear(endDate.getFullYear() - 5)); // Default 5Y

            const queryOptions = {
                period1: startDate,
                period2: endDate,
                interval: '1d' as const,
                events: 'split'
            };

            const result = await yahooFinance.chart(symbol, queryOptions) as any;
            const quotes = result?.quotes || [];
            const splits = result?.events?.splits || {};
            // Splits is an Object: { "173874623": { date:..., numerator:3, denominator:1, splitRatio:"3:1" } }
            // Map splits to Date String for easy lookup
            // Yahoo usually puts event on the Ex-Date.
            // Split of 3:1 means on Ex-Date, opening price is 1/3.
            // So Previous Close must be * 3.

            const splitMap: Record<string, number> = {};
            if (splits && typeof splits === 'object') {
                const keys = Object.keys(splits);
                // const keys = Object.keys(splits);
                Object.values(splits).forEach((s: any) => {
                    // Parse Ratio assuming "Num:Den" or usage of numerator/denominator
                    let ratio = 1;
                    if (s.numerator && s.denominator) {
                        ratio = s.numerator / s.denominator;
                    }
                    // Date can be Date object, string, or unix timestamp (seconds)
                    let dObj: Date;
                    if (s.date instanceof Date) {
                        dObj = s.date;
                    } else if (typeof s.date === 'string') {
                        dObj = new Date(s.date);
                    } else {
                        dObj = new Date(s.date * 1000);
                    }
                    const d = dObj.toISOString().split('T')[0];
                    splitMap[d] = ratio;
                });
            }

            const prices: Record<string, number> = {};
            const availableDates: Date[] = [];

            // Process Backwards to accumulate split factor
            let splitFactor = 1;

            // Sort Descending (Newest First)
            const sortedQuotes = [...quotes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            for (const quote of sortedQuotes) {
                const d = new Date(quote.date);
                const dateStr = d.toISOString().split('T')[0];

                // If ID matches a split date? Or date matches?
                // Yahoo events usually align with quote dates.
                // If Split happened ON this date (Ex-Date), then OLDER prices need adjustment.
                // So we update factor AFTER processing this date?
                // No, if today is Ex-Date, Today is already Low.
                // Yesterday needs to be High.
                // so we update factor AFTER reading this quote, for the NEXT (older) quote.

                let price = quote.close || quote.adjClose;

                if (price && price > 0) {
                    // Apply cumulative factor
                    price = price * splitFactor;

                    prices[dateStr] = price;
                    availableDates.push(d); // Note: Order will be desc in availableDates, sorting might be needed for findPrice?
                    // findPrice iterates all, so order doesn't matter for correctness, but perf.
                }

                if (splitMap[dateStr]) {
                    splitFactor *= splitMap[dateStr];
                }
            }

            // Re-sort availableDates ascending for findPrice/consistency?
            availableDates.sort((a, b) => a.getTime() - b.getTime());

            // 3. Populate Summary Keys (1W, 1M, 1Y, YTD) to prevent cache thrashing by getHistoricalPrices()
            // Helper to find closest price
            const findPrice = (target: Date) => {
                let closest: { date: Date, price: number } | null = null;
                let minDiff = Infinity;
                for (const d of availableDates) {
                    const diff = Math.abs(d.getTime() - target.getTime());
                    if (diff < minDiff) {
                        minDiff = diff;
                        closest = { date: d, price: prices[d.toISOString().split('T')[0]] };
                    }
                }
                // Allow matches within 4 days (weekends)
                return (closest && minDiff < 4 * 24 * 60 * 60 * 1000) ? closest.price : 0;
            };

            const today = new Date();

            // 1W
            const oneWeekAgo = new Date(today);
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            prices['1W'] = findPrice(oneWeekAgo);

            // 1M
            const oneMonthAgo = new Date(today);
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            prices['1M'] = findPrice(oneMonthAgo);

            // 1Y
            const oneYearAgo = new Date(today);
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            prices['1Y'] = findPrice(oneYearAgo);

            // YTD
            const ytd = new Date(today.getFullYear(), 0, 1);
            prices['YTD'] = findPrice(ytd);


            // console.log(`[MarketData] getDailyHistory(${symbol}): Fetched ${quotes.length} points. Updating Cache.`);

            // 4. Update Cache
            await prisma.marketDataCache.upsert({
                where: { symbol },
                update: {
                    history: prices,
                    lastUpdated: now
                },
                create: {
                    symbol,
                    price: 0,
                    change: 0,
                    changePercent: 0,
                    currency: 'USD',
                    history: prices,
                    lastUpdated: now
                }
            });

            return prices;
        } catch (error) {
            console.error(`Error fetching daily history for ${symbol}:`, error);
            // Fallback to cache without checking expiry
            try {
                const cached = await prisma.marketDataCache.findUnique({ where: { symbol } });
                if (cached?.history) return cached.history as Record<string, number>;
            } catch (ignore) { }
            return {};
        }
    }


    /**
     * Refresh all market data for a symbol (Price, Profile, History)
     * This is intended to be called in the background
     */
    static async refreshMarketData(symbol: string): Promise<void> {
        try {
            // Force rebuild
            console.log(`Refreshing market data for ${symbol}...`);
            const now = new Date();

            // 1. Fetch Quote (Price, Profile, Top Holdings for ETF)
            const quote = await yahooFinance.quoteSummary(symbol, { modules: ['price', 'summaryProfile', 'summaryDetail', 'topHoldings', 'calendarEvents', 'defaultKeyStatistics'] }) as any;

            let priceData = {
                price: 0,
                change: 0,
                changePercent: 0,
                currency: 'USD',
                sector: undefined as string | undefined,
                country: undefined as string | undefined,
                sectorAllocations: undefined as any,
                countryAllocations: undefined as any,
                dividendRate: undefined as number | undefined,
                dividendYield: undefined as number | undefined,
                exDividendDate: undefined as Date | undefined
            };


            if (quote && quote.price) {
                const p = quote.price;
                const profile = quote.summaryProfile || {};
                const holdings = quote.topHoldings || {};
                const calendar = quote.calendarEvents || {};

                priceData = {
                    price: p.regularMarketPrice || 0,
                    change: p.regularMarketChange || 0,
                    changePercent: p.regularMarketChangePercent || 0,
                    currency: p.currency || 'USD',
                    sector: profile.sector,
                    country: profile.country,
                    sectorAllocations: holdings.sectorWeightings || [],
                    countryAllocations: [], // Yahoo doesn't provide country breakdown easily in this module, leaving empty for now

                    dividendRate: quote.summaryDetail?.dividendRate,
                    dividendYield: quote.summaryDetail?.dividendYield,
                    exDividendDate: calendar.exDividendDate ? new Date(calendar.exDividendDate) : undefined
                };

                const detail = quote.summaryDetail || {};
                const keyStats = quote.defaultKeyStatistics || {};

                let dividendRate = detail.dividendRate;
                let dividendYield = detail.dividendYield;

                // Fallback for Dividend Rate/Yield
                if (!dividendYield) {
                    if (detail.yield) {
                        dividendYield = detail.yield;
                    } else if (detail.trailingAnnualDividendYield) {
                        dividendYield = detail.trailingAnnualDividendYield;
                    } else if (keyStats.yield) {
                        dividendYield = keyStats.yield;
                    }
                }

                if (!dividendRate) {
                    if (detail.trailingAnnualDividendRate) {
                        dividendRate = detail.trailingAnnualDividendRate;
                    }
                }

                // Calculate Rate if missing but Yield exists
                if (!dividendRate && dividendYield && priceData.price) {
                    dividendRate = priceData.price * dividendYield;
                }

                // Calculate Yield if missing but Rate exists
                if (!dividendYield && dividendRate && priceData.price) {
                    dividendYield = dividendRate / priceData.price;
                }

                priceData.dividendRate = dividendRate;
                priceData.dividendYield = dividendYield;
            }

            // 2. Fetch History (Chart)
            const endDate = new Date();
            const startDate = new Date();
            startDate.setFullYear(startDate.getFullYear() - 20); // Support up to 20y for ALL/10Y
            startDate.setDate(startDate.getDate() - 7);

            const queryOptions = {
                period1: startDate,
                period2: endDate,
                interval: '1d' as const,
            };

            const chartResult = await yahooFinance.chart(symbol, queryOptions) as any;
            const quotes = chartResult?.quotes || [];

            const history = this.processHistory(quotes);

            // 3. Update Cache (Upsert)
            await prisma.marketDataCache.upsert({
                where: { symbol },
                update: {
                    price: priceData.price,
                    change: priceData.change,
                    changePercent: priceData.changePercent,
                    currency: priceData.currency,
                    sector: priceData.sector,
                    country: priceData.country,
                    sectorAllocations: priceData.sectorAllocations,
                    countryAllocations: priceData.countryAllocations,
                    dividendRate: priceData.dividendRate,
                    dividendYield: priceData.dividendYield,
                    exDividendDate: priceData.exDividendDate,
                    history: history,
                    lastUpdated: now
                },
                create: {
                    symbol,
                    price: priceData.price,
                    change: priceData.change,
                    changePercent: priceData.changePercent,
                    currency: priceData.currency,
                    sector: priceData.sector,
                    country: priceData.country,
                    sectorAllocations: priceData.sectorAllocations,
                    countryAllocations: priceData.countryAllocations,
                    dividendRate: priceData.dividendRate,
                    dividendYield: priceData.dividendYield,
                    exDividendDate: priceData.exDividendDate,
                    history: history,
                    lastUpdated: now
                }
            });

            console.log(`Market data refreshed for ${symbol}`);

        } catch (error) {
            console.error(`Error refreshing market data for ${symbol}:`, error);
            // We don't throw here to avoid crashing the background process
        }
    }

    static async getIntradayPrices(symbol: string): Promise<{ date: string, value: number }[]> {
        try {
            // Calculate start date (2 days ago to ensure we get full recent session)
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 2);

            const queryOptions = {
                period1: startDate,
                interval: '60m' as const,
                includePrePost: false
            };

            const result = await yahooFinance.chart(symbol, queryOptions) as any;
            const quotes = result?.quotes || [];

            // Filter for only today/last session if needed, or just return the recent hourly data
            // The chart component will filter for 1D view, but let's return the last 24-48h
            return quotes
                .filter((q: any) => q.date && (q.close || q.open))
                .map((q: any) => ({
                    date: q.date.toISOString(),
                    value: q.close || q.open
                }));

        } catch (error) {
            console.error(`Error fetching intraday for ${symbol}:`, error);
            return [];
        }
    }
}
