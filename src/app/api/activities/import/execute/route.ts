/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MarketDataService } from '@/lib/market-data';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { activities } = body;

        if (!Array.isArray(activities) || activities.length === 0) {
            return NextResponse.json({ error: 'No activities provided' }, { status: 400 });
        }

        // 1. Identify unique symbols and ensure Investments exist
        const uniqueSymbols = new Set<string>();
        activities.forEach((a: any) => uniqueSymbols.add(a.Symbol));

        const existingInvestments = await prisma.investment.findMany({
            where: {
                symbol: { in: Array.from(uniqueSymbols) }
            }
        });

        const existingSymbolMap = new Map(existingInvestments.map(i => [i.symbol, i]));
        const newInvestments: any[] = [];

        // Prepare new investments
        for (const symbol of uniqueSymbols) {
            if (!existingSymbolMap.has(symbol)) {
                // Find the first activity with this symbol to get metadata
                const activity = activities.find((a: any) => a.Symbol === symbol);

                let name = activity.Name;
                let type = activity['Investment Type'];
                let currency = activity.Currency;

                // Fetch metadata if missing
                if (!name) {
                    try {
                        const searchResults = await MarketDataService.searchSymbols(symbol);
                        // Try exact match first, then first result
                        const match = searchResults.find(r => r.symbol === symbol) || searchResults[0];

                        if (match) {
                            name = match.name;
                            type = type || (match.type === 'ETF' || match.type === 'MUTUALFUND' ? 'EQUITY' : (match.type === 'CRYPTOCURRENCY' ? 'CRYPTO' : 'EQUITY'));

                            // Try to get currency from price check if still missing
                            if (!currency) {
                                const priceData = await MarketDataService.getPrice(symbol);
                                if (priceData) {
                                    currency = priceData.currency;
                                }
                            }
                        }
                    } catch (err) {
                        console.error(`Failed to fetch metadata for ${symbol}`, err);
                    }
                }

                newInvestments.push({
                    symbol: symbol,
                    name: name || symbol, // Fallback to symbol
                    type: type || 'EQUITY', // Default
                    currencyCode: currency || 'USD' // Default
                });
            }
        }

        // Create missing investments
        if (newInvestments.length > 0) {
            await Promise.all(newInvestments.map(inv =>
                prisma.investment.create({
                    data: {
                        symbol: inv.symbol,
                        name: inv.name,
                        type: inv.type,
                        currency: {
                            connectOrCreate: {
                                where: { code: inv.currencyCode },
                                create: { code: inv.currencyCode, rateToBase: 1.0 }
                            }
                        }
                    }
                })
            ));
        }

        // Re-fetch all investments to get IDs
        const allInvestments = await prisma.investment.findMany({
            where: {
                symbol: { in: Array.from(uniqueSymbols) }
            }
        });
        const investmentMap = new Map(allInvestments.map(i => [i.symbol, i]));

        // 2. Create Activities
        const createdActivities = await prisma.$transaction(
            activities.map((activity: any) => {
                const investment = investmentMap.get(activity.Symbol);
                if (!investment) throw new Error(`Investment not found for ${activity.Symbol}`);

                return prisma.activity.create({
                    data: {
                        date: new Date(activity.parsedDate),
                        type: activity.Type,
                        quantity: activity.parsedQuantity,
                        price: activity.parsedPrice,
                        fee: activity.parsedFee,
                        currency: activity.Currency || investment.currencyCode,
                        investmentId: investment.id,
                        accountId: activity.accountId,
                        platformId: activity.platformId
                    }
                });
            })
        );
        // 3. Trigger Market Data Refresh
        // Prefetch data so the UI is snappy when the user navigates away
        try {
            console.log(`Prefetching market data for ${uniqueSymbols.size} symbols...`);
            await Promise.all(Array.from(uniqueSymbols).map(symbol =>
                MarketDataService.refreshMarketData(symbol)
            ));

            // 4. Auto-Detect Splits
            // We check only the imported symbols to save time
            console.log(`Checking for missing splits for ${uniqueSymbols.size} symbols...`);
            // We can run this in background or await it. 
            // Better to await so user knows it's done, but parallelize per symbol.
            // SplitService.detectAndApply checks history, so it's a bit heavy.
            // But for a few symbols it's fine.
            const { SplitService } = await import('@/lib/split-detector');
            await Promise.all(Array.from(uniqueSymbols).map(symbol =>
                SplitService.detectAndApply(symbol)
            ));

        } catch (error) {
            console.error('Error post-processing import:', error);
            // Don't fail the import if refresh/split check fails
        }

        return NextResponse.json({
            success: true,
            count: createdActivities.length
        });

    } catch (error) {
        console.error('Import execution error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
    }
}
