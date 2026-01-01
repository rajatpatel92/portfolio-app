
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const symbol = 'CAD=X';
    const cached = await prisma.marketDataCache.findUnique({
        where: { symbol }
    });
    console.log(`Checking ${symbol}...`);
    if (cached) {
        console.log('FOUND:', JSON.stringify(cached, null, 2));
    } else {
        console.log('NOT FOUND');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
