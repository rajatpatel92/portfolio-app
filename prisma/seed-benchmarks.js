
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const benchmarks = [
        { symbol: '^GSPC', name: 'S&P 500', isSystem: true },
        { symbol: '^IXIC', name: 'NASDAQ Composite', isSystem: true },
        { symbol: '^GSPTSE', name: 'S&P/TSX Composite', isSystem: true },
        { symbol: 'BTC-USD', name: 'Bitcoin', isSystem: true },
        { symbol: 'XEQT.TO', name: 'iShares Core Equity (XEQT)', isSystem: true },
    ];

    for (const b of benchmarks) {
        await prisma.benchmark.upsert({
            where: { symbol: b.symbol },
            update: {},
            create: b,
        });
        console.log(`Seeded ${b.name}`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
