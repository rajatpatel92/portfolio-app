/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey']
});

export class SplitService {
    /**
     * Detects and applies missing stock splits for a given symbol (or all if not provided).
     * @param targetSymbol Optional symbol to check. If null, checks all investments.
     */
    static async detectAndApply(targetSymbol?: string) {
        console.log(`[SplitService] Starting detection... Target: ${targetSymbol || 'ALL'}`);

        // 1. Get Investments
        const whereClause = targetSymbol ? { symbol: targetSymbol } : {};
        const investments = await prisma.investment.findMany({
            where: whereClause,
            include: {
                activities: {
                    orderBy: { date: 'asc' }
                }
            }
        });

        // Ensure STOCK_SPLIT type exists
        const splitType = await prisma.activityType.findUnique({ where: { name: 'STOCK_SPLIT' } });
        if (!splitType) {
            console.error('[SplitService] STOCK_SPLIT activity type not found.');
            return;
        }

        for (const inv of investments) {
            if (inv.activities.length === 0) continue;

            const symbol = inv.symbol;
            // Use date of first activity to bound the history check
            const firstActivityDate = inv.activities[0].date;

            // Fetch splits from Yahoo Finance
            const queryOptions = {
                period1: firstActivityDate,
                events: 'split' as const
            };

            let splits: any[] = [];
            try {
                // Typings for yahooFinance can be loose, cast to any
                const result = await yahooFinance.chart(symbol, queryOptions) as any;
                if (result.events && result.events.splits) {
                    const rawSplits = result.events.splits;
                    if (Array.isArray(rawSplits)) {
                        splits = rawSplits;
                    } else {
                        splits = Object.values(rawSplits);
                    }
                }
            } catch (err: any) {
                console.warn(`[SplitService] Failed to fetch splits for ${symbol}: ${err.message}`);
                continue;
            }

            if (splits.length === 0) continue;

            for (const split of splits) {
                const splitDate = new Date(split.date);
                const ratio = split.numerator / split.denominator;

                // Check if already exists in DB (approximate match on date)
                const existing = inv.activities.find(a =>
                    a.type === 'STOCK_SPLIT' &&
                    Math.abs(new Date(a.date).getTime() - splitDate.getTime()) < 24 * 60 * 60 * 1000
                );

                if (existing) continue;

                console.log(`[SplitService] Found Missing Split for ${symbol}: ${splitDate.toISOString().split('T')[0]} (Ratio ${ratio})`);

                // Identify affected accounts (those with activity BEFORE split)
                const relevantAccounts = new Set<string>();
                let hasUnassigned = false; // "Unassigned" account

                inv.activities.forEach(a => {
                    if (new Date(a.date) < splitDate) {
                        if (a.accountId) relevantAccounts.add(a.accountId);
                        else hasUnassigned = true;
                    }
                });

                if (relevantAccounts.size === 0 && !hasUnassigned) {
                    continue;
                }

                // Apply to Accounts
                for (const accountId of relevantAccounts) {
                    await prisma.activity.create({
                        data: {
                            investmentId: inv.id,
                            type: 'STOCK_SPLIT',
                            date: splitDate,
                            quantity: ratio, // Store Ratio as Quantity
                            price: 0,
                            currency: inv.currencyCode,
                            accountId: accountId
                        }
                    });
                    console.log(`[SplitService] Applied split to Account ${accountId}`);
                }

                // Apply to Unassigned if needed
                if (hasUnassigned) {
                    await prisma.activity.create({
                        data: {
                            investmentId: inv.id,
                            type: 'STOCK_SPLIT',
                            date: splitDate,
                            quantity: ratio,
                            price: 0,
                            currency: inv.currencyCode,
                            accountId: null // Unassigned
                        }
                    });
                    console.log(`[SplitService] Applied split to Unassigned Account`);
                }
            }
        }
        console.log('[SplitService] Detection complete.');
    }
}
