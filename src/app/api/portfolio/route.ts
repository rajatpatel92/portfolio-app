import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MarketDataService } from '@/lib/market-data';
import { calculateXIRR, Transaction } from '@/lib/xirr';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Fetch all activities and activity types
        const [activities, activityTypes] = await Promise.all([
            prisma.activity.findMany({
                include: {
                    investment: true,
                    platform: true,
                    account: true,
                },
            }),
            prisma.activityType.findMany()
        ]);

        // Map activity type name to behavior
        const behaviorMap = new Map<string, string>();
        activityTypes.forEach(t => behaviorMap.set(t.name, t.behavior));

        // Default behaviors if not found (fallback)
        if (!behaviorMap.has('BUY')) behaviorMap.set('BUY', 'ADD');
        if (!behaviorMap.has('SELL')) behaviorMap.set('SELL', 'REMOVE');
        if (!behaviorMap.has('DIVIDEND')) behaviorMap.set('DIVIDEND', 'NEUTRAL');

        // 2. Calculate holdings
        const holdingsMap = new Map<string, {
            quantity: number;
            investment: typeof activities[0]['investment'];
            platforms: Map<string, number>; // Platform Name -> Quantity
            accounts: Map<string, { quantity: number, platformName: string }>; // Account Name -> { Quantity, Platform }
        }>();

        for (const activity of activities) {
            const { symbol } = activity.investment;
            const current = holdingsMap.get(symbol) || {
                quantity: 0,
                investment: activity.investment,
                platforms: new Map(),
                accounts: new Map()
            };

            const platformName = activity.platform?.name || 'Unknown';
            const accountName = activity.account?.name || 'Unassigned';

            const currentPlatformQty = current.platforms.get(platformName) || 0;
            const currentAccountData = current.accounts.get(accountName) || { quantity: 0, platformName };

            const behavior = behaviorMap.get(activity.type) || 'NEUTRAL';

            if (behavior === 'ADD') {
                current.quantity += activity.quantity;
                current.platforms.set(platformName, currentPlatformQty + activity.quantity);
                current.accounts.set(accountName, {
                    quantity: currentAccountData.quantity + activity.quantity,
                    platformName
                });
            } else if (behavior === 'REMOVE') {
                current.quantity -= activity.quantity;
                current.platforms.set(platformName, Math.max(0, currentPlatformQty - activity.quantity));
                current.accounts.set(accountName, {
                    quantity: Math.max(0, currentAccountData.quantity - activity.quantity),
                    platformName
                });
            }
            // NEUTRAL does not affect quantity

            holdingsMap.set(symbol, current);
        }

        // 3. Fetch market data and calculate totals
        let totalValue = 0;
        let totalCostBasis = 0; // Track total cost basis
        let totalDayChange = 0;
        const allocationByType: Record<string, number> = {};
        const allocationByPlatform: Record<string, number> = {};
        const allocationByAccount: Record<string, { value: number, platformName: string }> = {};
        const allocationByAsset: { name: string; value: number }[] = [];
        const constituents: any[] = [];
        const upcomingDividends: any[] = [];
        let dividendsYTD = 0;
        let projectedDividends = 0;

        // Global Cash Flows for Portfolio XIRR
        const portfolioCashFlows: Transaction[] = [];

        // ... (Market Data Fetching Loop) ...
        for (const [symbol, data] of holdingsMap.entries()) {
            // Even if quantity is 0, we might want to calculate XIRR for realized gains,
            // but for now let's stick to active holdings or ensure we process all symbols with history.
            // Ideally we should process all symbols that have activities.

            const marketData = await MarketDataService.getPrice(symbol);
            // If no market data (e.g. delisted), skip for now or use last known
            // if (!marketData && data.quantity > 0) continue; // Original logic, now we default to 0 price

            const price = marketData?.price || 0;
            const regularMarketChange = marketData?.regularMarketChange || 0;
            const regularMarketChangePercent = marketData?.regularMarketChangePercent || 0;
            const currency = marketData?.currency || 'USD';

            const historicalPrices = await MarketDataService.getHistoricalPrices(symbol);

            // ... (Cost Basis Calculation & XIRR) ...
            let totalBuyCost = 0;
            let totalBuyQty = 0;
            const symbolCashFlows: Transaction[] = [];

            const symbolActivities = activities.filter((a: any) => a.investment.symbol === symbol);

            for (const activity of symbolActivities) {
                const amount = activity.quantity * activity.price;
                const fee = activity.fee || 0;
                const behavior = behaviorMap.get(activity.type) || 'NEUTRAL';

                if (behavior === 'ADD') {
                    totalBuyCost += amount;
                    totalBuyQty += activity.quantity;
                    // Outflow: -(Amount + Fee)
                    symbolCashFlows.push({ amount: -(amount + fee), date: activity.date });
                    portfolioCashFlows.push({ amount: -(amount + fee), date: activity.date });
                } else if (behavior === 'REMOVE') {
                    // Inflow: (Amount - Fee)
                    symbolCashFlows.push({ amount: (amount - fee), date: activity.date });
                    portfolioCashFlows.push({ amount: (amount - fee), date: activity.date });
                } else if (activity.type === 'DIVIDEND') { // Keep explicit check for Dividend for now, or map NEUTRAL+Amount to inflow?
                    // For now, let's assume DIVIDEND is the only NEUTRAL type that generates cash inflow without quantity change
                    // Or we can check if it has a price/amount.
                    // If behavior is NEUTRAL but amount > 0, it's likely a dividend or interest.
                    // Subtract fee (e.g. tax) from dividend amount to get net inflow
                    const netAmount = amount - fee;
                    symbolCashFlows.push({ amount: netAmount, date: activity.date });
                    portfolioCashFlows.push({ amount: netAmount, date: activity.date });

                    // Calculate YTD Dividends
                    const activityYear = new Date(activity.date).getFullYear();
                    if (activityYear === new Date().getFullYear()) {
                        dividendsYTD += netAmount;
                    }
                }
            }

            const avgBuyPrice = totalBuyQty > 0 ? totalBuyCost / totalBuyQty : 0;
            const costBasis = avgBuyPrice * data.quantity;

            const value = data.quantity * price;
            const dayChange = data.quantity * regularMarketChange;

            // Add Current Value as "Inflow" for XIRR calculation if holding > 0
            if (data.quantity > 0) {
                symbolCashFlows.push({ amount: value, date: new Date() });
                portfolioCashFlows.push({ amount: value, date: new Date() });
            }

            // Calculate period start dates for age comparison
            const now = new Date();
            const date1W = new Date(now); date1W.setDate(now.getDate() - 7);
            const date1M = new Date(now); date1M.setMonth(now.getMonth() - 1);
            const date1Y = new Date(now); date1Y.setFullYear(now.getFullYear() - 1);
            const dateYTD = new Date(now.getFullYear(), 0, 1); // Jan 1st of current year

            // Find first buy date
            const firstBuyActivity = symbolActivities
                .filter((a: any) => behaviorMap.get(a.type) === 'ADD')
                .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
            const firstBuyDate = firstBuyActivity ? new Date(firstBuyActivity.date) : new Date();

            // Calculate XIRR only if investment is older than 1 year
            let xirr = null;
            if (firstBuyDate <= date1Y) {
                xirr = calculateXIRR(symbolCashFlows);
            }

            if (data.quantity > 0) {
                totalValue += value;
                totalCostBasis += costBasis; // Accumulate cost basis
                totalDayChange += dayChange;

                // Allocation by Type
                const type = data.investment.type || 'EQUITY';
                allocationByType[type] = (allocationByType[type] || 0) + value;

                // Allocation by Platform
                for (const [platformName, qty] of data.platforms.entries()) {
                    if (qty > 0) {
                        const platformValue = qty * price;
                        allocationByPlatform[platformName] = (allocationByPlatform[platformName] || 0) + platformValue;
                    }
                }

                // Allocation by Account
                for (const [accountName, accData] of data.accounts.entries()) {
                    if (accData.quantity > 0) {
                        const accountValue = accData.quantity * price;
                        const existing = allocationByAccount[accountName] || { value: 0, platformName: accData.platformName };
                        allocationByAccount[accountName] = {
                            value: existing.value + accountValue,
                            platformName: accData.platformName
                        };
                    }
                }

                // Allocation by Asset
                allocationByAsset.push({
                    name: symbol,
                    value: value
                });
            }

            const calculateChange = (oldPrice: number, periodStartDate: Date) => {
                // If investment is younger than the period (first buy was AFTER the period start), return null
                if (!oldPrice || firstBuyDate > periodStartDate) return null;

                const change = price - oldPrice;
                return {
                    absolute: change * data.quantity,
                    percent: (change / oldPrice) * 100
                };
            };

            const change1W = calculateChange(historicalPrices['1W'], date1W);
            const change1M = calculateChange(historicalPrices['1M'], date1M);
            const change1Y = calculateChange(historicalPrices['1Y'], date1Y);
            const changeYTD = calculateChange(historicalPrices['YTD'], dateYTD);

            const inceptionChange = {
                absolute: value - costBasis,
                percent: costBasis > 0 ? ((value - costBasis) / costBasis) * 100 : 0
            };

            // Only add to constituents if we have quantity OR if we want to show closed positions (optional, sticking to > 0 for now based on previous logic)
            if (data.quantity > 0) {
                constituents.push({
                    symbol,
                    name: data.investment.name,
                    type: data.investment.type,
                    quantity: data.quantity,
                    price: price,
                    avgPrice: avgBuyPrice,
                    bookValue: costBasis,
                    value,
                    currency: currency,
                    dayChange: {
                        absolute: dayChange,
                        percent: regularMarketChangePercent
                    },
                    change1W,
                    change1M,
                    change1Y,
                    changeYTD,


                    xirr: xirr, // Add XIRR
                    dividendYield: marketData?.dividendYield || 0
                });
            }

            // Check for upcoming dividends (if we have quantity > 0)
            if (data.quantity > 0 && marketData?.exDividendDate) {
                const exDate = new Date(marketData.exDividendDate);
                if (exDate >= new Date()) {
                    upcomingDividends.push({
                        symbol,
                        exDate: exDate.toISOString(),
                        rate: marketData.dividendRate || 0,
                        quantity: data.quantity,
                        estimatedAmount: (marketData.dividendRate || 0) * data.quantity
                    });
                }
            }

            // Calculate Projected Dividends (Annual)
            if (data.quantity > 0 && marketData?.dividendRate) {
                projectedDividends += marketData.dividendRate * data.quantity;
            }
        }

        // Calculate Portfolio XIRR
        const portfolioXIRR = calculateXIRR(portfolioCashFlows);

        // Sort constituents by value desc
        constituents.sort((a, b) => b.value - a.value);

        const allocationByTypeArray = Object.entries(allocationByType).map(([name, value]) => ({
            name,
            value
        }));

        const allocationByPlatformArray = Object.entries(allocationByPlatform).map(([name, value]) => ({
            name,
            value
        }));

        const allocationByAccountArray = Object.entries(allocationByAccount).map(([name, data]) => ({
            name,
            value: data.value,
            platformName: data.platformName
        }));

        // Calculate Total Growth Percent
        const totalGrowth = totalValue - totalCostBasis;
        const totalGrowthPercent = totalCostBasis > 0 ? (totalGrowth / totalCostBasis) * 100 : 0;

        return NextResponse.json({
            totalValue,
            dayChange: totalDayChange,
            dayChangePercent: totalValue > 0 ? (totalDayChange / (totalValue - totalDayChange)) * 100 : 0,
            totalGrowth,
            totalGrowthPercent,
            xirr: portfolioXIRR,
            allocationByType: allocationByTypeArray,
            allocationByPlatform: allocationByPlatformArray,
            allocationByAccount: allocationByAccountArray,


            constituents,
            dividendsYTD,
            projectedDividends,
            upcomingDividends: upcomingDividends.sort((a, b) => new Date(a.exDate).getTime() - new Date(b.exDate).getTime())
        });

    } catch (error) {
        console.error('Error calculating portfolio:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
