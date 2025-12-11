import { NextResponse } from 'next/server';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey']
});

// Helper to generate date range
function getDates(startDate: Date, endDate: Date) {
    const dates = [];
    const currentDate = new Date(startDate);
    // Strip time for safety comparison
    currentDate.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (currentDate <= end) {
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
                case 'ALL': startDate.setFullYear(startDate.getFullYear() - 5); break; // Cap at 5 years
                default: startDate.setMonth(startDate.getMonth() - 1);
            }
        }

        // 2. Fetch all activities & Types
        const [activities, activityTypes] = await Promise.all([
            prisma.activity.findMany({
                include: { investment: true },
                orderBy: { date: 'asc' }
            }),
            prisma.activityType.findMany()
        ]);

        if (activities.length === 0) {
            return NextResponse.json([]);
        }

        // Map behaviors
        const behaviorMap = new Map<string, string>();
        activityTypes.forEach(t => behaviorMap.set(t.name, t.behavior));
        // Defaults
        if (!behaviorMap.has('BUY')) behaviorMap.set('BUY', 'ADD');
        if (!behaviorMap.has('SELL')) behaviorMap.set('SELL', 'REMOVE');
        if (!behaviorMap.has('SPLIT')) behaviorMap.set('SPLIT', 'SPLIT');

        // Adjust start date if ALL to the first activity
        if (range === 'ALL' && activities.length > 0) {
            const firstActivityDate = new Date(activities[0].date);
            if (firstActivityDate > startDate) {
                startDate = new Date(firstActivityDate);
            }
        }

        // 3. Identify Symbols and Currencies
        const symbols = new Set<string>();
        const currencies = new Set<string>();

        // Map symbol -> currency for easy lookup
        const symbolCurrencyMap = new Map<string, string>();

        activities.forEach(a => {
            symbols.add(a.investment.symbol);
            if (a.investment.currencyCode) {
                currencies.add(a.investment.currencyCode);
                symbolCurrencyMap.set(a.investment.symbol, a.investment.currencyCode);
            } else {
                symbolCurrencyMap.set(a.investment.symbol, 'USD'); // Default
            }
        });

        // 4. Fetch Historical Data (Prices & Rates) in Parallel
        // For Rates: We need them from the very beginning to normalize "Invested" correctly
        const rateStartDate = new Date(startDate < new Date(activities[0].date) ? startDate : activities[0].date);
        rateStartDate.setDate(rateStartDate.getDate() - 5);

        // For Prices: We only need them for the requested range
        const priceStartDate = new Date(startDate);
        priceStartDate.setDate(priceStartDate.getDate() - 5);

        const priceMap: Record<string, Record<string, number>> = {};
        const rateMap: Record<string, Record<string, number>> = {};

        const dataPromises: Promise<void>[] = [];

        // Fetch Prices (Requested Range)
        for (const sym of symbols) {
            dataPromises.push((async () => {
                try {
                    const result = await yahooFinance.chart(sym, {
                        period1: priceStartDate,
                        period2: endDate,
                        interval: '1d'
                    }) as any;
                    const quotes = result?.quotes || [];
                    priceMap[sym] = {};
                    quotes.forEach((q: any) => {
                        if (q.date && q.close) {
                            const d = new Date(q.date).toISOString().split('T')[0];
                            priceMap[sym][d] = q.close || q.adjClose;
                        }
                    });
                } catch (e) {
                    console.warn(`Failed history for ${sym}`, e);
                }
            })());
        }

        // Fetch Rates (Full History)
        for (const curr of currencies) {
            if (curr === 'USD') continue;
            dataPromises.push((async () => {
                try {
                    const pair = `${curr}USD=X`;
                    const result = await yahooFinance.chart(pair, {
                        period1: rateStartDate,
                        period2: endDate,
                        interval: '1d'
                    }) as any;

                    const quotes = result?.quotes || [];
                    rateMap[curr] = {};
                    quotes.forEach((q: any) => {
                        if (q.date && q.close) {
                            const d = new Date(q.date).toISOString().split('T')[0];
                            rateMap[curr][d] = q.close || q.adjClose;
                        }
                    });

                } catch (e) {
                    console.warn(`Failed history rate for ${curr}`, e);
                }
            })());
        }

        await Promise.all(dataPromises);

        // 5. Daily Simulation
        const dates = getDates(startDate, endDate);
        const historyPoints: { date: string, value: number, invested: number }[] = [];

        // Running State
        const currentHoldings: Record<string, number> = {};
        const symbolCostBasis: Record<string, { totalCostUSD: number, totalQty: number }> = {};
        let activityIndex = 0;

        for (const date of dates) {
            const dateStr = date.toISOString().split('T')[0];

            // Apply activities up to this date
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            while (activityIndex < activities.length) {
                const activity = activities[activityIndex];
                if (new Date(activity.date) > endOfDay) break;

                const sym = activity.investment.symbol;
                const curr = symbolCurrencyMap.get(sym) || 'USD';
                const behavior = behaviorMap.get(activity.type) || 'NEUTRAL';
                const absQty = Math.abs(activity.quantity);
                const priceAtActivity = activity.price;
                const fee = activity.fee || 0;

                // Initialize cost basis for symbol if not present
                if (!symbolCostBasis[sym]) {
                    symbolCostBasis[sym] = { totalCostUSD: 0, totalQty: 0 };
                }

                // Get Rate at Activity Date
                let rateAtActivity = 1;
                if (curr !== 'USD') {
                    const actDateStr = new Date(activity.date).toISOString().split('T')[0];
                    rateAtActivity = rateMap[curr]?.[actDateStr] || 1;
                    // Try lookback if missing
                    if (!rateMap[curr]?.[actDateStr]) {
                        const lb = new Date(activity.date);
                        for (let i = 0; i < 5; i++) {
                            lb.setDate(lb.getDate() - 1);
                            const lbs = lb.toISOString().split('T')[0];
                            if (rateMap[curr]?.[lbs]) { rateAtActivity = rateMap[curr][lbs]; break; }
                        }
                    }
                }

                // Adjust quantities and cost basis
                if (behavior === 'ADD') {
                    currentHoldings[sym] = (currentHoldings[sym] || 0) + absQty;
                    const costUSD = ((absQty * priceAtActivity) + fee) * rateAtActivity;
                    symbolCostBasis[sym].totalCostUSD += costUSD;
                    symbolCostBasis[sym].totalQty += absQty;
                } else if (behavior === 'REMOVE') {
                    currentHoldings[sym] = (currentHoldings[sym] || 0) - absQty;
                    // Reduce Invested by PROPORTIONAL cost basis (Average Cost Basis method)
                    if (symbolCostBasis[sym].totalQty > 0) {
                        const costPerShareUSD = symbolCostBasis[sym].totalCostUSD / symbolCostBasis[sym].totalQty;
                        const costReductionUSD = absQty * costPerShareUSD;
                        symbolCostBasis[sym].totalCostUSD -= costReductionUSD;
                        symbolCostBasis[sym].totalQty -= absQty;
                    }
                } else if (behavior === 'SPLIT') {
                    const multiplier = absQty;
                    if (multiplier > 0 && currentHoldings[sym]) {
                        currentHoldings[sym] *= multiplier;
                        // Splits don't change Total Cost Basis, but change Total Quantity
                        symbolCostBasis[sym].totalQty *= multiplier;
                    }
                }
                activityIndex++;
            }

            let totalValueUSD = 0;
            let totalInvestedUSD = 0; // Sum of cost basis for currently held positions

            for (const [sym, qty] of Object.entries(currentHoldings)) {
                if (qty > 0.000001) { // Floating point tolerance
                    const curr = symbolCurrencyMap.get(sym) || 'USD';

                    // 1. Get Price
                    let price = priceMap[sym]?.[dateStr];
                    if (!price) {
                        // Lookback 5 days
                        const lb = new Date(date);
                        for (let i = 0; i < 5; i++) {
                            lb.setDate(lb.getDate() - 1);
                            const lbs = lb.toISOString().split('T')[0];
                            if (priceMap[sym]?.[lbs]) { price = priceMap[sym][lbs]; break; }
                        }
                    }

                    if (price) {
                        let value = qty * price;

                        // 2. Convert to USD
                        if (curr !== 'USD') {
                            let rate = rateMap[curr]?.[dateStr];
                            if (!rate) {
                                // Lookback
                                const lb = new Date(date);
                                for (let i = 0; i < 5; i++) {
                                    lb.setDate(lb.getDate() - 1);
                                    const lbs = lb.toISOString().split('T')[0];
                                    if (rateMap[curr]?.[lbs]) { rate = rateMap[curr][lbs]; break; }
                                }
                            }

                            if (rate) value *= rate;
                            // Use last known rate or 1 if desperate? 1 is dangerous.
                            // If rate missing, maybe skip or keep local (creates spikes). 
                            // Defaulting to 1 if missing USD rate is bad for INR.
                            // If no rate, maybe use 0 to avoid massive spikes, or exclude?
                        }

                        totalValueUSD += value;
                    }
                }
                // Sum up the cost basis for currently held positions
                if (symbolCostBasis[sym] && symbolCostBasis[sym].totalQty > 0.000001) {
                    totalInvestedUSD += symbolCostBasis[sym].totalCostUSD;
                }
            }

            historyPoints.push({
                date: dateStr,
                value: totalValueUSD,
                invested: totalInvestedUSD
            });
        }

        return NextResponse.json(historyPoints);

    } catch (error) {
        console.error('Error generating portfolio history:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
