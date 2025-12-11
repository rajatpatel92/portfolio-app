
import { PrismaClient } from '@prisma/client';
import YahooFinance from 'yahoo-finance2';

const prisma = new PrismaClient();
const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey']
});

async function main() {
    try {
        console.log('--- Starting Auto-Detect Splits Script ---');

        // 1. Get all Unique Symbols currently held
        const investments = await prisma.investment.findMany({
            include: {
                activities: {
                    orderBy: { date: 'asc' }
                }
            }
        });

        console.log(`Checking ${investments.length} investments for splits...`);

        const splitType = await prisma.activityType.findUnique({ where: { name: 'STOCK_SPLIT' } });
        if (!splitType) {
            console.error('STOCK_SPLIT activity type not found. Please run seed-split.ts first.');
            process.exit(1);
        }

        for (const inv of investments) {
            // efficient skip: if no activities, skip
            if (inv.activities.length === 0) continue;

            const symbol = inv.symbol;
            const firstActivityDate = inv.activities[0].date;

            // Fetch splits from Yahoo Finance
            // We fetch from a bit before the first activity just to be safe, or just "max history"
            // Usually API returns all if period1 is old enough

            const queryOptions = {
                period1: firstActivityDate, // Only care about splits after we started investing
                events: 'split' as const
            };

            let splits: any[] = [];
            try {
                const result = await yahooFinance.chart(symbol, queryOptions);
                if (result.events && result.events.splits) {
                    // splits is an object or array? Yahoo Finance returns array of objects usually, 
                    // but the type def might say otherwise. The debug output showed array.
                    const rawSplits = result.events.splits;
                    if (Array.isArray(rawSplits)) {
                        splits = rawSplits;
                    } else {
                        // Sometimes it returns an object keyed by date?
                        // Debug output showed array: [{ date: ..., numerator: 3, denominator: 1, splitRatio: '3:1' }]
                        splits = Object.values(rawSplits);
                    }
                }
            } catch (err: any) {
                console.error(`Failed to fetch splits for ${symbol}:`, err.message);
                continue;
            }

            if (splits.length === 0) continue;

            console.log(`Found ${splits.length} splits for ${symbol}`);

            for (const split of splits) {
                const splitDate = new Date(split.date);
                const ratio = split.numerator / split.denominator;

                // Check if this split is already recorded in DB
                // We check for type 'STOCK_SPLIT' and close date match
                const existing = inv.activities.find(a =>
                    a.type === 'STOCK_SPLIT' &&
                    Math.abs(a.date.getTime() - splitDate.getTime()) < 24 * 60 * 60 * 1000 // within 1 day
                );

                if (existing) {
                    console.log(`  Split on ${splitDate.toISOString().split('T')[0]} (${ratio}:1) already exists.`);
                    continue;
                }

                // If not exists, we should propose/add it.
                // We need to associate it with an Account/Platform?
                // Splits apply to ALL shares held.
                // BUT our system tracks quantity per Account.
                // If the user holds XQQ in Multipl Accounts, we need a Split Transaction for EACH account?
                // OR, does the Portfolio Engine aggregated handle 'SPLIT' globally?
                // The updated logic in route.ts updates `current.quantity` and iterates keys in `current.accounts`.
                // BUT `route.ts` iterates ACTIVITIES.
                // If we insert ONE split activity, does it apply to all accounts?
                // The `Activity` model has `accountId` (optional).
                // If `accountId` is NULL, does route.ts apply it to all?

                // Let's check route.ts logic again.
                // `const currentAccount = current.accounts.get(accountName)`
                // If activity.accountId is null, `activity.account` is null -> `accountName` = "Unassigned".
                // So a NULL account activity only affects "Unassigned".
                // IT DOES NOT AFFECT "Rajat - RRSP" etc.

                // Logic Gap Identified: Stock Split should apply to ALL accounts holding the stock.
                // Current Data Model requires Activity linked to Account (usually).
                // We must create a Split Activity FOR EACH Account that holds shares at that date.

                console.log(`  > Missing Split found: ${splitDate.toISOString().split('T')[0]} Ratio ${ratio}`);

                // Calculate holdings per account at that date
                // We need to replay activities up to that date to know which accounts had shares.
                // This is complex.
                // SIMPLIFICATION: Find all accounts that have ANY 'BUY'/'ADD' activity for this stock BEFORE the split date.
                // And insert a Split activity for them.
                // (Even if they sold it? If they sold it fully, Qty is 0. 0 * 3 = 0. Safe.)

                const relevantAccounts = new Set<string>();
                let hasUnassigned = false;

                inv.activities.forEach(a => {
                    if (a.date < splitDate) {
                        if (a.accountId) relevantAccounts.add(a.accountId);
                        else hasUnassigned = true;
                    }
                });

                if (relevantAccounts.size === 0 && !hasUnassigned) {
                    console.log('    No active accounts found before split. Skipping.');
                    continue;
                }

                console.log(`    Applying to ${relevantAccounts.size} accounts...`);

                for (const accountId of relevantAccounts) {
                    // Create Split Activity
                    await prisma.activity.create({
                        data: {
                            investmentId: inv.id,
                            type: 'STOCK_SPLIT',
                            date: splitDate,
                            quantity: ratio, // Store Ratio in Quantity field
                            price: 0, // Price irrelevant for split multiplier
                            currency: inv.currencyCode,
                            accountId: accountId,
                            // We should also look up platformId from the account or activity?
                            // Just linking Account is usually enough if system infers platform.
                        }
                    });
                    console.log(`      Created Split for Account ID: ${accountId}`);
                }
            }
        }

        console.log('--- Done ---');

    } catch (error) {
        console.error('Script Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
