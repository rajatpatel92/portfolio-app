import { prisma } from '@/lib/prisma';

/**
 * Calculates the quantity of shares held for a symbol on a specific date, broken down by account.
 * Considers BUY, SELL, and SPLIT activities.
 * 
 * @param symbol The stock symbol
 * @param date The date to check holdings for (inclusive)
 * @returns A map of accountId -> quantity
 */
export async function getHoldingsAtDate(symbol: string, date: Date): Promise<Record<string, number>> {
    const activities = await prisma.activity.findMany({
        where: {
            investment: {
                symbol: symbol
            },
            date: {
                lte: date
            }
        },
        include: {
            account: true
        },
        orderBy: {
            date: 'asc'
        }
    });

    const holdings: Record<string, number> = {};

    for (const activity of activities) {
        const accId = activity.accountId || 'unknown';
        if (!holdings[accId]) holdings[accId] = 0;

        if (activity.type === 'BUY') {
            holdings[accId] += activity.quantity;
        } else if (activity.type === 'SELL') {
            holdings[accId] -= activity.quantity;
        } else if (activity.type === 'SPLIT') {
            holdings[accId] += activity.quantity;
        }
    }

    // Filter out zero or negative holdings
    const result: Record<string, number> = {};
    for (const [accId, qty] of Object.entries(holdings)) {
        if (qty > 0) result[accId] = qty;
    }

    return result;
}

/**
 * Checks if a dividend activity already exists to prevent duplicates.
 * 
 * @param symbol 
 * @param date 
 * @param amount 
 * @returns true if duplicate exists
 */
export async function checkDividendExists(symbol: string, date: Date, amount: number): Promise<boolean> {
    const existing = await prisma.activity.findFirst({
        where: {
            investment: {
                symbol: symbol
            },
            type: 'DIVIDEND',
            date: {
                equals: date
            },
            // We can also check amount, but sometimes amounts might differ slightly due to rounding.
            // Checking date and symbol for a DIVIDEND is usually a strong enough signal for a duplicate 
            // on the same day.
        }
    });
    return !!existing;
}
