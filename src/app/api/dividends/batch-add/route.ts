import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { dividends } = body;

        if (!Array.isArray(dividends)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        const results = [];

        for (const div of dividends) {
            try {
                // 1. Find Investment
                const investment = await prisma.investment.findUnique({
                    where: { symbol: div.symbol }
                });

                if (!investment) {
                    results.push({ symbol: div.symbol, status: 'error', message: 'Investment not found' });
                    continue;
                }

                // 2. Find Account and Platform
                let platformId = null;
                if (div.accountId) {
                    const account = await prisma.account.findUnique({
                        where: { id: div.accountId }
                    });
                    if (account) {
                        platformId = account.platformId;
                    }
                }

                // 3. Create Dividend Activity
                await prisma.activity.create({
                    data: {
                        investmentId: investment.id,
                        type: 'DIVIDEND',
                        date: new Date(div.date),
                        quantity: div.quantity,
                        price: div.rate, // Storing rate in price field
                        fee: 0,
                        currency: div.currency,
                        accountId: div.accountId || null,
                        platformId: platformId
                    }
                });

                // 4. Handle Reinvestment (DRIP)
                if (div.reinvest && div.price > 0) {
                    const rawQty = div.amount / div.price;
                    const reinvestQty = Math.round(rawQty * 10000) / 10000;

                    await prisma.activity.create({
                        data: {
                            investmentId: investment.id,
                            type: 'BUY',
                            date: new Date(div.date),
                            quantity: reinvestQty,
                            price: div.price,
                            fee: 0,
                            currency: div.currency,
                            accountId: div.accountId || null,
                            platformId: platformId
                        }
                    });
                }

                results.push({ symbol: div.symbol, status: 'success' });

            } catch (err) {
                console.error(`Error adding dividend for ${div.symbol}:`, err);
                results.push({ symbol: div.symbol, status: 'error', message: 'Database error' });
            }
        }

        return NextResponse.json({ results });

    } catch (error) {
        console.error('Error batch adding dividends:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
