import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MarketDataService } from '@/lib/market-data';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey']
});

// Helper to generate date range
function getDates(startDate: Date, endDate: Date) {
    const dates = [];
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '1M';
    const customStart = searchParams.get('startDate');
    const customEnd = searchParams.get('endDate');

    try {
        // 1. Determine date range
        let endDate = new Date();
        let startDate = new Date();

        if (range === 'CUSTOM' && customStart && customEnd) {
            startDate = new Date(customStart);
            endDate = new Date(customEnd);
        } else {
            switch (range) {
                case '1D': startDate.setDate(startDate.getDate() - 1); break;
                case '1W': startDate.setDate(startDate.getDate() - 7); break;
                case '1M': startDate.setMonth(startDate.getMonth() - 1); break;
                case '3M': startDate.setMonth(startDate.getMonth() - 3); break;
                case '6M': startDate.setMonth(startDate.getMonth() - 6); break;
                case '1Y': startDate.setFullYear(startDate.getFullYear() - 1); break;
                case 'YTD': startDate.setMonth(0, 1); break;
                case 'ALL': startDate.setFullYear(startDate.getFullYear() - 5); break; // Cap at 5 years for now
                default: startDate.setMonth(startDate.getMonth() - 1);
            }
        }

        // 2. Fetch all activities
        const activities = await prisma.activity.findMany({
            include: { investment: true },
            orderBy: { date: 'asc' }
        });

        if (activities.length === 0) {
            return NextResponse.json([]);
        }

        // Adjust start date if ALL to the first activity
        if (range === 'ALL' && activities.length > 0) {
            const firstActivityDate = new Date(activities[0].date);
            if (firstActivityDate > startDate) {
                startDate.setTime(firstActivityDate.getTime());
            }
        }

        // 3. Get unique symbols
        const symbols = Array.from(new Set(activities.map((a: any) => a.investment.symbol)));

        // 4. Fetch historical prices for all symbols
        // We fetch a bit more buffer to ensure we have data
        const queryStartDate = new Date(startDate);
        queryStartDate.setDate(queryStartDate.getDate() - 5);

        const priceMap: Record<string, Record<string, number>> = {};

        await Promise.all(symbols.map(async (symbol: unknown) => {
            const sym = symbol as string;
            try {
                const result = await yahooFinance.chart(sym, {
                    period1: queryStartDate,
                    period2: endDate,
                    interval: '1d'
                }) as any;

                const quotes = result?.quotes || [];

                priceMap[sym] = {};
                if (Array.isArray(quotes)) {
                    quotes.forEach((candle: any) => {
                        if (candle.date) {
                            const dateStr = new Date(candle.date).toISOString().split('T')[0];
                            priceMap[sym][dateStr] = candle.close || candle.adjClose;
                        }
                    });
                }
            } catch (error) {
                console.error(`Failed to fetch history for ${sym}`, error);
            }
        }));

        // 5. Calculate daily portfolio value
        const dates = getDates(startDate, endDate);
        const history = dates.map(date => {
            const dateStr = date.toISOString().split('T')[0];

            // Calculate holdings up to this date
            const holdings: Record<string, number> = {};

            for (const activity of activities) {
                const activityDate = new Date(activity.date);
                if (activityDate <= date) {
                    const symbol = activity.investment.symbol;
                    if (activity.type === 'BUY') {
                        holdings[symbol] = (holdings[symbol] || 0) + activity.quantity;
                    } else if (activity.type === 'SELL') {
                        holdings[symbol] = (holdings[symbol] || 0) - activity.quantity;
                    }
                }
            }

            // Calculate total value and net invested
            let totalValue = 0;
            let netInvested = 0;

            // Calculate net invested from activities up to this date
            for (const activity of activities) {
                const activityDate = new Date(activity.date);
                if (activityDate <= date) {
                    if (activity.type === 'BUY') {
                        netInvested += (activity.quantity * activity.price) + (activity.fee || 0);
                    } else if (activity.type === 'SELL') {
                        netInvested -= (activity.quantity * activity.price) - (activity.fee || 0);
                    }
                }
            }

            for (const [symbol, quantity] of Object.entries(holdings)) {
                if (quantity > 0) {
                    // Find price for this date
                    let price = priceMap[symbol]?.[dateStr];

                    // If no price for exact date (e.g. weekend), look back
                    if (!price) {
                        const lookback = new Date(date);
                        for (let i = 0; i < 5; i++) {
                            lookback.setDate(lookback.getDate() - 1);
                            const lookbackStr = lookback.toISOString().split('T')[0];
                            if (priceMap[symbol]?.[lookbackStr]) {
                                price = priceMap[symbol][lookbackStr];
                                break;
                            }
                        }
                    }

                    if (price) {
                        totalValue += quantity * price;
                    }
                }
            }

            return {
                date: dateStr,
                value: totalValue,
                invested: netInvested
            };
        });

        return NextResponse.json(history);

    } catch (error) {
        console.error('Error generating portfolio history:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
