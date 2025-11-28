import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
                newInvestments.push({
                    symbol: symbol,
                    name: activity.Name || symbol, // Default to symbol if Name missing
                    type: activity['Investment Type'] || 'EQUITY', // Default to EQUITY
                    currencyCode: activity.Currency || 'USD' // Default to USD
                });
            }
        }

        // Create missing investments
        if (newInvestments.length > 0) {
            // We need to create Currency if it doesn't exist? 
            // Usually Currency table is static. Assuming currencies exist.
            // But to be safe, we might need to check. 
            // For now, assuming standard currencies exist.

            // Note: createMany is not supported for SQLite if used, but Postgres supports it.
            // However, Investment has a relation to Currency.
            // Let's do individual creates to be safe and simple, or Promise.all
            await Promise.all(newInvestments.map(inv =>
                prisma.investment.create({
                    data: {
                        symbol: inv.symbol,
                        name: inv.name,
                        type: inv.type,
                        currency: {
                            connectOrCreate: {
                                where: { code: inv.currencyCode },
                                create: { code: inv.currencyCode, rateToBase: 1.0 } // Default rate
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

        return NextResponse.json({
            success: true,
            count: createdActivities.length
        });

    } catch (error) {
        console.error('Import execution error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
    }
}
