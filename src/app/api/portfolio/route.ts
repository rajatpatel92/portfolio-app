import { NextResponse } from 'next/server';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/auth';
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
                orderBy: { date: 'asc' }
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
            accounts: Map<string, { quantity: number, platformName: string, accountType: string }>; // Account Name -> { Quantity, Platform, Type }
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
            const accountType = activity.account?.type || 'Unassigned';

            const behavior = behaviorMap.get(activity.type) || 'NEUTRAL';

            const absQty = Math.abs(activity.quantity);

            if (behavior === 'ADD') {
                current.quantity += absQty;
                current.platforms.set(platformName, (current.platforms.get(platformName) || 0) + absQty);
                current.accounts.set(accountName, {
                    quantity: (current.accounts.get(accountName)?.quantity || 0) + absQty,
                    platformName,
                    accountType
                });
            } else if (behavior === 'REMOVE') {
                current.quantity -= absQty;
                current.platforms.set(platformName, Math.max(0, (current.platforms.get(platformName) || 0) - absQty));
                current.accounts.set(accountName, {
                    quantity: Math.max(0, (current.accounts.get(accountName)?.quantity || 0) - absQty),
                    platformName,
                    accountType
                });
            } else if (behavior === 'SPLIT') {
                // For SPLIT, quantity acts as the multiplier (e.g., 3 for 3:1 split)
                // We use Math.abs just in case, though split ratio should be positive
                const multiplier = absQty;
                if (multiplier > 0) {
                    current.quantity *= multiplier;
                    // Apply split to platform and account quantities as well
                    for (const [pName, pQty] of current.platforms.entries()) {
                        current.platforms.set(pName, pQty * multiplier);
                    }
                    for (const [aName, aData] of current.accounts.entries()) {
                        current.accounts.set(aName, {
                            quantity: aData.quantity * multiplier,
                            platformName: aData.platformName,
                            accountType: aData.accountType
                        });
                    }
                }
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
        const allocationByAccountType: Record<string, number> = {};
        const allocationByAsset: { name: string; value: number }[] = [];
        const constituents: any[] = [];
        const upcomingDividends: any[] = [];
        let dividendsYTD = 0;
        let projectedDividends = 0;

        // Global Cash Flows for Portfolio XIRR
        const portfolioCashFlows: Transaction[] = [];

        // ... (Market Data Fetching Loop) ...
        // Parallel Processing of Assets
        const assetPromises = Array.from(holdingsMap.entries()).map(async ([symbol, data]) => {
            try {
                // 1. Fetch Market Data & History in Parallel
                const [marketData, historicalPrices] = await Promise.all([
                    MarketDataService.getPrice(symbol),
                    MarketDataService.getHistoricalPrices(symbol)
                ]);

                const price = marketData?.price || 0;
                const regularMarketChange = marketData?.regularMarketChange || 0;
                const regularMarketChangePercent = marketData?.regularMarketChangePercent || 0;
                const currency = marketData?.currency || 'USD';

                // Get exchange rate if needed
                let rateToUSD = 1;
                if (currency !== 'USD') {
                    const r = await MarketDataService.getExchangeRate(currency, 'USD');
                    if (r) rateToUSD = r;
                }

                // 2. Calculate Cost Basis & Cash Flows
                let totalBuyCost = 0;
                let totalBuyQty = 0;
                let localDividendsYTD = 0;
                const symbolCashFlows: Transaction[] = [];

                const symbolActivities = activities.filter((a: any) => a.investment.symbol === symbol);

                // Process Activities
                for (const activity of symbolActivities) {
                    const absQty = Math.abs(activity.quantity);
                    const amount = absQty * activity.price;
                    const fee = activity.fee || 0;
                    const behavior = behaviorMap.get(activity.type) || 'NEUTRAL';

                    if (behavior === 'ADD') {
                        totalBuyCost += amount;
                        totalBuyQty += absQty;
                        symbolCashFlows.push({ amount: -(amount + fee), date: activity.date });
                    } else if (behavior === 'REMOVE') {
                        symbolCashFlows.push({ amount: (amount - fee), date: activity.date });
                    } else if (activity.type === 'DIVIDEND') {
                        const netAmount = amount - fee;
                        symbolCashFlows.push({ amount: netAmount, date: activity.date });

                        const activityYear = new Date(activity.date).getFullYear();
                        if (activityYear === new Date().getFullYear()) {
                            localDividendsYTD += netAmount;
                        }
                    } else if (behavior === 'SPLIT') {
                        const multiplier = absQty;
                        if (multiplier > 0) {
                            totalBuyQty *= multiplier;
                        }
                    }
                }

                const avgBuyPrice = totalBuyQty > 0 ? totalBuyCost / totalBuyQty : 0;
                const costBasis = avgBuyPrice * data.quantity;
                const value = data.quantity * price;
                const dayChange = data.quantity * regularMarketChange;

                // Add Current Value as "Inflow" for XIRR
                if (data.quantity > 0) {
                    symbolCashFlows.push({ amount: value, date: new Date() });
                }

                // XIRR Calculation
                let xirr = null;
                // Calculate period start dates
                const now = new Date();
                const date1W = new Date(now); date1W.setDate(now.getDate() - 7);
                const date1M = new Date(now); date1M.setMonth(now.getMonth() - 1);
                const date1Y = new Date(now); date1Y.setFullYear(now.getFullYear() - 1);
                const dateYTD = new Date(now.getFullYear(), 0, 1);

                const firstBuyActivity = symbolActivities
                    .filter((a: any) => behaviorMap.get(a.type) === 'ADD')
                    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
                const firstBuyDate = firstBuyActivity ? new Date(firstBuyActivity.date) : new Date();

                if (firstBuyDate <= date1Y) {
                    xirr = calculateXIRR(symbolCashFlows);
                }

                // Historical Changes
                const calculateChange = (oldPrice: number, periodStartDate: Date) => {
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

                // Upcoming Dividends
                let upcomingDividend = null;
                if (data.quantity > 0 && marketData?.exDividendDate) {
                    const exDate = new Date(marketData.exDividendDate);
                    if (exDate >= new Date()) {
                        upcomingDividend = {
                            symbol,
                            exDate: exDate.toISOString(),
                            rate: marketData.dividendRate || 0,
                            quantity: data.quantity,
                            estimatedAmount: ((marketData.dividendRate || 0) * data.quantity) * rateToUSD
                        };
                    }
                }

                return {
                    success: true,
                    symbol,
                    data,
                    price,
                    rateToUSD,
                    value,
                    costBasis,
                    dayChange,
                    valueUSD: data.quantity > 0 ? value * rateToUSD : 0,
                    costBasisUSD: data.quantity > 0 ? costBasis * rateToUSD : 0,
                    dayChangeUSD: data.quantity > 0 ? dayChange * rateToUSD : 0,
                    symbolCashFlows,
                    dividendsYTD: localDividendsYTD * rateToUSD,
                    projectedDividends: ((data.quantity > 0 && marketData?.dividendRate) ? (marketData.dividendRate * data.quantity) : 0) * rateToUSD,
                    constituent: data.quantity > 0 ? {
                        symbol,
                        name: data.investment.name,
                        type: data.investment.type,
                        quantity: data.quantity,
                        price,
                        avgPrice: avgBuyPrice,
                        bookValue: costBasis,
                        value,
                        currency,
                        dayChange: {
                            absolute: dayChange,
                            percent: regularMarketChangePercent
                        },
                        change1W,
                        change1M,
                        change1Y,
                        changeYTD,
                        inceptionChange,
                        xirr,
                        dividendYield: marketData?.dividendYield || 0,
                        accountTypes: Array.from(data.accounts.values())
                            .filter(a => a.quantity > 0)
                            .map(a => a.accountType || 'Unassigned')
                            .filter((value, index, self) => self.indexOf(value) === index), // Unique
                        accountNames: Array.from(data.accounts.entries())
                            .filter(([_, val]) => val.quantity > 0)
                            .map(([name]) => name)
                    } : null,
                    upcomingDividend
                };

            } catch (error) {
                console.error(`Error processing asset ${symbol}:`, error);
                return { success: false, symbol };
            }
        });

        const results = await Promise.all(assetPromises);

        // Aggregate Results
        for (const result of results) {
            if (!result.success || !result.data) continue;

            const {
                data,
                valueUSD,
                costBasisUSD,
                dayChangeUSD,
                symbolCashFlows,
                dividendsYTD: localDividendsYTD,
                projectedDividends: localProjected,
                constituent,
                upcomingDividend,
                price,
                rateToUSD
            } = result;

            // Merge Cash Flows
            portfolioCashFlows.push(...symbolCashFlows);

            // Sum Dividends
            dividendsYTD += localDividendsYTD;
            projectedDividends += localProjected;

            if (data.quantity > 0) {
                totalValue += valueUSD;
                totalCostBasis += costBasisUSD;
                totalDayChange += dayChangeUSD;

                // Allocation by Type
                const type = data.investment.type || 'EQUITY';
                allocationByType[type] = (allocationByType[type] || 0) + valueUSD;

                // Allocation by Platform
                for (const [platformName, qty] of data.platforms.entries()) {
                    if (qty > 0) {
                        const platformValue = qty * price;
                        const platformValueUSD = platformValue * rateToUSD;
                        allocationByPlatform[platformName] = (allocationByPlatform[platformName] || 0) + platformValueUSD;
                    }
                }

                // Allocation by Account & Account Type
                for (const [accountName, accData] of data.accounts.entries()) {
                    if (accData.quantity > 0) {
                        const accountValue = accData.quantity * price;
                        const accountValueUSD = accountValue * rateToUSD;

                        // By Account Name
                        const existing = allocationByAccount[accountName] || { value: 0, platformName: accData.platformName };
                        allocationByAccount[accountName] = {
                            value: existing.value + accountValueUSD,
                            platformName: accData.platformName
                        };

                        // By Account Type
                        const accType = accData.accountType || 'Unassigned';
                        allocationByAccountType[accType] = (allocationByAccountType[accType] || 0) + accountValueUSD;
                    }
                }

                // Allocation by Asset
                allocationByAsset.push({
                    name: result.symbol,
                    value: valueUSD
                });

                // Add to Constituents
                if (constituent) {
                    constituents.push(constituent);
                }
            }

            if (upcomingDividend) {
                upcomingDividends.push(upcomingDividend);
            }
        }

        // Calculate Portfolio XIRR
        const portfolioXIRR = calculateXIRR(portfolioCashFlows);

        // Sort constituents by value desc
        constituents.sort((a, b) => b.value - a.value);

        const allocationByTypeArray = Object.entries(allocationByType).map(([name, value]) => ({
            name,
            value
        })).sort((a, b) => b.value - a.value);

        const allocationByPlatformArray = Object.entries(allocationByPlatform).map(([name, value]) => ({
            name,
            value
        })).sort((a, b) => b.value - a.value);

        const allocationByAccountArray = Object.entries(allocationByAccount).map(([name, data]) => ({
            name,
            value: data.value,
            platformName: data.platformName
        })).sort((a, b) => b.value - a.value);

        const allocationByAccountTypeArray = Object.entries(allocationByAccountType).map(([name, value]) => ({
            name,
            value
        })).sort((a, b) => b.value - a.value);

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
            allocationByAccountType: allocationByAccountTypeArray,
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


