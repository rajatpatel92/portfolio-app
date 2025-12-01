/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const YahooFinance = require('yahoo-finance2').default;

// Mocking the service to avoid importing the whole file which might have TS issues in JS script
// But wait, I can just use the logic from the service in this script to test it.

const yahooFinanceInstance = new YahooFinance({
    suppressNotices: ['yahooSurvey']
});

async function getHistoricalPrices(symbol) {
    try {
        // 1. Check Cache
        const cached = await prisma.marketDataCache.findUnique({
            where: { symbol }
        });

        console.log('Cached History Keys:', cached && cached.history ? Object.keys(cached.history) : 'None');
        if (cached && cached.history) {
            console.log('Cached 1Y:', cached.history['1Y']);
            console.log('Cached YTD:', cached.history['YTD']);
        }

        // 2. Fetch from API (Simulate what the service does)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        startDate.setDate(startDate.getDate() - 7);

        const queryOptions = {
            period1: startDate,
            period2: endDate,
            interval: '1d',
        };

        console.log('Fetching from Yahoo...');
        const result = await yahooFinanceInstance.chart(symbol, queryOptions);
        const quotes = result?.quotes || [];

        if (!quotes.length) {
            console.log('No quotes found');
            return;
        }

        const prices = {};
        for (const quote of quotes) {
            if (quote.date && (quote.close || quote.adjClose)) {
                const dateStr = new Date(quote.date).toISOString().split('T')[0];
                prices[dateStr] = quote.close || quote.adjClose;
            }
        }

        const findPrice = (targetDate) => {
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
        const oneWeekAgo = new Date(today); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const oneMonthAgo = new Date(today); oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const oneYearAgo = new Date(today); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const ytd = new Date(today.getFullYear(), 0, 1);

        prices['1W'] = findPrice(oneWeekAgo);
        prices['1M'] = findPrice(oneMonthAgo);
        prices['1Y'] = findPrice(oneYearAgo);
        prices['YTD'] = findPrice(ytd);

        console.log('Calculated 1W:', prices['1W']);
        console.log('Calculated 1M:', prices['1M']);
        console.log('Calculated 1Y:', prices['1Y']);
        console.log('Calculated YTD:', prices['YTD']);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

getHistoricalPrices('XEQT.TO');
