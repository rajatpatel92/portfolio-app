const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.investment.update({
        where: { symbol: 'XEQT.TO' },
        data: { name: 'iShares Core Equity ETF Portfolio' },
    });
    await prisma.investment.update({
        where: { symbol: 'VFV.TO' },
        data: { name: 'Vanguard S&P 500 Index ETF' },
    });
    console.log('Updated investment names');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
