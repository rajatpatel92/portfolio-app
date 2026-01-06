
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import YahooFinance from 'yahoo-finance2';
import { getHoldingsAtDate, findDividendMatch } from '@/lib/portfolio-helper';

export const dynamic = 'force-dynamic';

const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey', 'ripHistorical']
});

import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate Limit: 5 scans per minute per user
    const userId = session.user?.id || 'unknown';
    const isAllowed = await checkRateLimit(`scan-dividends-${userId}`, 5, 60);

    if (!isAllowed) {
        return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { symbols: requestedSymbols } = body;

        let symbolsToScan: string[] = [];

        if (requestedSymbols && Array.isArray(requestedSymbols) && requestedSymbols.length > 0) {
            symbolsToScan = requestedSymbols;
        } else {
            // Default: Get all distinct symbols from Investments
            const investments = await prisma.investment.findMany({
                select: { symbol: true },
                distinct: ['symbol']
            });
            symbolsToScan = investments.map(i => i.symbol);
        }

        // Fetch hidden dividends for these symbols
        const hiddenDividends = await prisma.hiddenDividend.findMany({
            where: {
                symbol: { in: symbolsToScan }
            }
        });

        // Create a map for quick lookup: symbol-date -> boolean
        const hiddenMap = new Map<string, boolean>();
        hiddenDividends.forEach(h => {
            const key = `${h.symbol}-${h.date.toISOString().split('T')[0]}`;
            hiddenMap.set(key, true);
        });

        // Fetch all accounts for lookup
        const allAccounts = await prisma.account.findMany({
            include: { platform: true }
        });
        const accountMap = new Map(allAccounts.map(a => [a.id, a]));

        // Fetch all users for Display Name lookup
        const allUsers = await prisma.user.findMany();
        const userMap = new Map(allUsers.map(u => [u.username, u.name]));

        const foundDividends = [];

        // 2. Scan each symbol
        for (const symbol of symbolsToScan) {
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

                        // Check for fuzzy match
                        const match = await findDividendMatch(symbol, divDate, div.amount);

                        // Calculate holdings on Ex-Date - 1 day
                        const checkDate = new Date(divDate);
                        checkDate.setDate(checkDate.getDate() - 1);

                        const holdingsByAccount = await getHoldingsAtDate(symbol, checkDate);

                        // Find price for the dividend date
                        let price = 0;
                        if (chartResult.quotes) {
                            const quote = chartResult.quotes.find(q => {
                                const qDate = new Date(q.date);
                                return qDate.toISOString().split('T')[0] === divDate.toISOString().split('T')[0];
                            });
                            if (quote) {
                                price = quote.close || 0;
                            }
                        }

                        for (const [accountId, quantity] of Object.entries(holdingsByAccount)) {
                            if (quantity > 0) {
                                const account = accountMap.get(accountId);
                                let displayName = account?.name;
                                if (account && userMap.has(account.name)) {
                                    displayName = userMap.get(account.name) || account.name;
                                }

                                foundDividends.push({
                                    symbol,
                                    date: divDate.toISOString(),
                                    rate: div.amount,
                                    quantity,
                                    amount: div.amount * quantity,
                                    currency: chartResult.meta.currency || 'USD',
                                    accountId: accountId === 'unknown' ? null : accountId,
                                    price: price,
                                    isDuplicate: !!match,
                                    existingMatch: match ? {
                                        date: match.date,
                                        amount: match.price * match.quantity // Total amount
                                    } : null,
                                    isHidden: hiddenMap.has(`${symbol}-${divDate.toISOString().split('T')[0]}`),
                                    accountName: account?.name,
                                    accountDisplayName: displayName,
                                    accountType: account?.type,
                                    platformName: account?.platform?.name
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
