import { NextResponse } from 'next/server';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MarketDataService } from '@/lib/market-data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ symbol: string }> }) {
    const params = await props.params;
    const { symbol } = params;

    try {
        // 1. Fetch Investment and Activities
        const investment = await prisma.investment.findUnique({
            where: { symbol },
            include: {
                activities: {
                    include: {
                        platform: true,
                        account: true
                    },
                    orderBy: { date: 'asc' }
                }
            }
        });

        if (!investment) {
            return NextResponse.json({ error: 'Investment not found' }, { status: 404 });
        }

        // 2. Fetch Market Data
        const marketData = await MarketDataService.getPrice(symbol);
        const historicalPrices = await MarketDataService.getHistoricalPrices(symbol);

        // 3. Calculate Stats
        let totalQuantity = 0;
        let totalCost = 0;
        let totalFees = 0;
        const accountAllocation: Record<string, { quantity: number, value: number, name: string, type: string }> = {};

        // Fetch activity types for behavior
        const activityTypes = await prisma.activityType.findMany();
        const behaviorMap = new Map<string, string>();
        activityTypes.forEach(t => behaviorMap.set(t.name, t.behavior));

        // Default behaviors
        if (!behaviorMap.has('BUY')) behaviorMap.set('BUY', 'ADD');
        if (!behaviorMap.has('SELL')) behaviorMap.set('SELL', 'REMOVE');
        if (!behaviorMap.has('DIVIDEND')) behaviorMap.set('DIVIDEND', 'NEUTRAL');
        if (!behaviorMap.has('STOCK_SPLIT')) behaviorMap.set('STOCK_SPLIT', 'SPLIT');

        let firstBuyDate: Date | null = null;

        let totalDividends = 0;

        for (const activity of investment.activities) {
            const behavior = behaviorMap.get(activity.type) || 'NEUTRAL';
            const amount = activity.quantity * activity.price;
            totalFees += activity.fee || 0;

            if (behavior === 'ADD') {
                totalQuantity += activity.quantity;
                totalCost += amount;
                if (!firstBuyDate || new Date(activity.date) < firstBuyDate) {
                    firstBuyDate = new Date(activity.date);
                }

                // Account Allocation
                if (activity.account) {
                    const accId = activity.account.id;
                    if (!accountAllocation[accId]) {
                        accountAllocation[accId] = {
                            quantity: 0,
                            value: 0,
                            name: activity.account.name,
                            type: activity.account.type
                        };
                    }
                    accountAllocation[accId].quantity += activity.quantity;
                }

            } else if (behavior === 'REMOVE') {
                totalQuantity -= activity.quantity;
                // Pro-rata cost basis reduction? Or FIFO?
                // For simple average cost:
                const avgCost = totalQuantity > 0 ? totalCost / (totalQuantity + activity.quantity) : 0;
                totalCost -= activity.quantity * avgCost;

                if (activity.account) {
                    const accId = activity.account.id;
                    if (accountAllocation[accId]) {
                        accountAllocation[accId].quantity -= activity.quantity;
                    }
                }
            } else if (behavior === 'SPLIT') {
                const multiplier = activity.quantity; // Quantity holds the ratio
                if (multiplier > 0) {
                    totalQuantity *= multiplier;
                    // Do NOT change totalCost (Cost Basis). Total Investment remains same, just more shares.

                    // Update Account Allocations
                    Object.values(accountAllocation).forEach(acc => {
                        acc.quantity *= multiplier;
                    });
                }
            } else if (activity.type === 'DIVIDEND') {
                totalDividends += amount;
            }
        }

        const price = marketData?.price || 0;
        const value = totalQuantity * price;
        const avgPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;
        const absoluteReturn = value - totalCost;
        const percentReturn = totalCost > 0 ? (absoluteReturn / totalCost) * 100 : 0;

        // Calculate Account Allocation Value
        Object.values(accountAllocation).forEach(acc => {
            acc.value = acc.quantity * price;
        });

        // Investment Age
        let investmentAge = 'N/A';
        if (firstBuyDate) {
            const diffTime = Math.abs(new Date().getTime() - firstBuyDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > 365) {
                investmentAge = `${(diffDays / 365).toFixed(1)} Years`;
            } else {
                investmentAge = `${diffDays} Days`;
            }
        }

        // Calculate Average Price History
        const avgPriceHistory: Record<string, number> = {};
        const sortedActivities = [...investment.activities].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Get all dates from historical prices
        const historicalDates = Object.keys(historicalPrices)
            .filter(key => !['1W', '1M', '1Y', 'YTD'].includes(key))
            .sort();

        if (historicalDates.length > 0) {
            let currentTotalQty = 0;
            let currentTotalCost = 0;
            let activityIndex = 0;

            for (const dateStr of historicalDates) {
                const date = new Date(dateStr);

                // Process activities up to this date
                while (activityIndex < sortedActivities.length) {
                    const activity = sortedActivities[activityIndex];
                    const activityDate = new Date(activity.date);

                    if (activityDate > date) break;

                    const behavior = behaviorMap.get(activity.type) || 'NEUTRAL';
                    const amount = activity.quantity * activity.price;

                    if (behavior === 'ADD') {
                        currentTotalQty += activity.quantity;
                        currentTotalCost += amount;
                    } else if (behavior === 'REMOVE') {
                        // Reduce cost proportionally
                        if (currentTotalQty > 0) {
                            const avgCost = currentTotalCost / currentTotalQty;
                            currentTotalCost -= activity.quantity * avgCost;
                            currentTotalQty -= activity.quantity;
                        }
                    } else if (behavior === 'SPLIT') {
                        const multiplier = activity.quantity;
                        if (multiplier > 0) {
                            currentTotalQty *= multiplier;
                            // Total Cost remains same
                        }
                    }

                    activityIndex++;
                }

                if (currentTotalQty > 0) {
                    avgPriceHistory[dateStr] = currentTotalCost / currentTotalQty;
                } else {
                    avgPriceHistory[dateStr] = 0;
                }
            }
        }

        return NextResponse.json({
            symbol,
            name: investment.name,
            currency: investment.currencyCode,
            stats: {
                quantity: totalQuantity,
                avgPrice,
                marketPrice: price,
                totalInvestment: totalCost,
                currentValue: value,
                absoluteReturn,
                percentReturn,
                totalFees,
                totalDividends,
                investmentAge,
                activityCount: investment.activities.length,
                fiftyTwoWeekHigh: marketData?.fiftyTwoWeekHigh,
                fiftyTwoWeekLow: marketData?.fiftyTwoWeekLow,
                sector: marketData?.sector,
                country: marketData?.country,
                sectorAllocations: (marketData as any)?.sectorAllocations,
                countryAllocations: (marketData as any)?.countryAllocations,
                dividendRate: marketData?.dividendRate,
                dividendYield: marketData?.dividendYield
            },
            allocation: {
                accounts: Object.values(accountAllocation).filter(a => a.quantity > 0)
            },
            activities: investment.activities,
            historical: historicalPrices,
            avgPriceHistory
        });

    } catch (error) {
        console.error('Error fetching analysis data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
