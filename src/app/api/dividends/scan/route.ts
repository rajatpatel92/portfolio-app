import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import YahooFinance from 'yahoo-finance2';
import { getHoldingsAtDate, checkDividendExists } from '@/lib/portfolio-helper';

export const dynamic = 'force-dynamic';

const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey', 'ripHistorical']
});

export async function GET() {
    try {
        // 1. Get all distinct symbols from Investments
        const investments = await prisma.investment.findMany({
            select: { symbol: true }
        });
        const symbols = investments.map(i => i.symbol);

        const foundDividends = [];

        // 2. Scan each symbol
        for (const symbol of symbols) {
            try {
                // Fetch dividends for the last year
                const endDate = new Date();
                const startDate = new Date();
                startDate.setFullYear(startDate.getFullYear() - 1);

                const chartResult = await yahooFinance.chart(symbol, {
                    period1: startDate,
                    period2: endDate,
                    interval: '1d',
                    events: 'div'
                });

                if (chartResult.events && chartResult.events.dividends) {
                    for (const div of chartResult.events.dividends) {
                        const divDate = new Date(div.date);

                        // Check if already exists
                        const exists = await checkDividendExists(symbol, divDate, div.amount);
                        if (exists) continue;

                        // Calculate holdings on Ex-Date - 1 day
                        const checkDate = new Date(divDate);
                        checkDate.setDate(checkDate.getDate() - 1);

                        const holdingsByAccount = await getHoldingsAtDate(symbol, checkDate);

                        // Find price for the dividend date
                        // The chart result 'quotes' array contains open, high, low, close, volume, date
                        // We need to find the quote matching the dividend date
                        let price = 0;
                        if (chartResult.quotes) {
                            const quote = chartResult.quotes.find(q => {
                                const qDate = new Date(q.date);
                                return qDate.toISOString().split('T')[0] === divDate.toISOString().split('T')[0];
                            });
                            if (quote) {
                                price = quote.close || 0;
                            } else {
                                // If no quote on ex-date (e.g. weekend), try the next available quote? 
                                // Or previous? Usually ex-date is a trading day.
                                // Let's fallback to the last quote if exact match fails, or 0.
                                // Actually, let's try to find the closest quote.
                                // For now, simple find.
                            }
                        }

                        for (const [accountId, quantity] of Object.entries(holdingsByAccount)) {
                            if (quantity > 0) {
                                foundDividends.push({
                                    symbol,
                                    date: divDate.toISOString(),
                                    rate: div.amount,
                                    quantity,
                                    amount: div.amount * quantity,
                                    currency: chartResult.meta.currency || 'USD',
                                    accountId: accountId === 'unknown' ? null : accountId,
                                    price: price
                                });
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(`Error scanning dividends for ${symbol}:`, err);
                // Continue to next symbol
            }
        }

        return NextResponse.json(foundDividends);

    } catch (error) {
        console.error('Error scanning dividends:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
