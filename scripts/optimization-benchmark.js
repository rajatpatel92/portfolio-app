
const LATENCY = 50; // ms

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let queryCount = 0;

const prismaMock = {
    investment: {
        findUnique: async () => {
            queryCount++;
            await sleep(LATENCY);
            return { id: 'inv-1', symbol: 'AAPL' };
        },
        findMany: async () => {
            queryCount++;
            await sleep(LATENCY);
            return [{ id: 'inv-1', symbol: 'AAPL' }];
        }
    },
    account: {
        findUnique: async () => {
            queryCount++;
            await sleep(LATENCY);
            return { id: 'acc-1', platformId: 'plat-1' };
        },
        findMany: async () => {
            queryCount++;
            await sleep(LATENCY);
            return [{ id: 'acc-1', platformId: 'plat-1' }];
        }
    },
    activity: {
        create: async () => {
            queryCount++;
            await sleep(LATENCY);
            return { id: 'act-1' };
        }
    }
};

async function unoptimizedBatchAdd(dividends) {
    const results = [];
    for (const div of dividends) {
        // 1. Find Investment
        const investment = await prismaMock.investment.findUnique({
            where: { symbol: div.symbol }
        });

        if (!investment) {
            results.push({ symbol: div.symbol, status: 'error' });
            continue;
        }

        // 2. Find Account
        let platformId = null;
        if (div.accountId) {
            const account = await prismaMock.account.findUnique({
                where: { id: div.accountId }
            });
            if (account) {
                platformId = account.platformId;
            }
        }

        // 3. Create Dividend Activity
        await prismaMock.activity.create({
            data: { investmentId: investment.id, type: 'DIVIDEND' }
        });

        // 4. Handle Reinvestment
        if (div.reinvest && div.price > 0) {
            await prismaMock.activity.create({
                data: { investmentId: investment.id, type: 'BUY' }
            });
        }
        results.push({ symbol: div.symbol, status: 'success' });
    }
    return results;
}

async function optimizedBatchAdd(dividends) {
    const results = [];

    // COLLECT UNIQUE KEYS
    const symbols = [...new Set(dividends.map(d => d.symbol))];
    const accountIds = [...new Set(dividends.filter(d => d.accountId).map(d => d.accountId))];

    // BULK QUERIES
    const investments = await prismaMock.investment.findMany({
        where: { symbol: { in: symbols } }
    });
    const accounts = await prismaMock.account.findMany({
        where: { id: { in: accountIds } }
    });

    // CREATE MAPS
    const investmentMap = new Map(investments.map(i => [i.symbol, i]));
    const accountMap = new Map(accounts.map(a => [a.id, a]));

    for (const div of dividends) {
        const investment = investmentMap.get(div.symbol);
        if (!investment) {
            results.push({ symbol: div.symbol, status: 'error' });
            continue;
        }

        let platformId = null;
        if (div.accountId) {
            const account = accountMap.get(div.accountId);
            if (account) {
                platformId = account.platformId;
            }
        }

        await prismaMock.activity.create({
            data: { investmentId: investment.id, type: 'DIVIDEND' }
        });

        if (div.reinvest && div.price > 0) {
            await prismaMock.activity.create({
                data: { investmentId: investment.id, type: 'BUY' }
            });
        }
        results.push({ symbol: div.symbol, status: 'success' });
    }
    return results;
}

async function runBenchmark(name, fn, dividends) {
    queryCount = 0;
    const start = Date.now();
    await fn(dividends);
    const end = Date.now();
    console.log(`${name}:`);
    console.log(`  Time: ${end - start}ms`);
    console.log(`  Queries: ${queryCount}`);
    return { time: end - start, queries: queryCount };
}

const mockDividends = Array.from({ length: 50 }, (_, i) => ({
    symbol: 'AAPL',
    accountId: 'acc-1',
    date: '2024-01-01',
    quantity: 1,
    rate: 0.24,
    amount: 0.24,
    currency: 'USD',
    reinvest: true,
    price: 190
}));

async function main() {
    const mode = process.argv[2] || 'both';

    if (mode === 'baseline' || mode === 'both') {
        await runBenchmark('Baseline (Unoptimized)', unoptimizedBatchAdd, mockDividends);
    }

    if (mode === 'optimized' || mode === 'both') {
        await runBenchmark('Optimized', optimizedBatchAdd, mockDividends);
    }
}

main();
