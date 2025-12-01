/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
    const data = await prisma.marketDataCache.findUnique({
        where: { symbol: 'XEQT.TO' }
    });
    console.log(JSON.stringify(data, null, 2));
}

checkData()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
