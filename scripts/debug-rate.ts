
import { MarketDataService } from '../src/lib/market-data';
import { prisma } from '../src/lib/prisma';

async function main() {
    console.log('Testing MarketDataService.getExchangeRate("USD", "CAD")...');
    const rate = await MarketDataService.getExchangeRate('USD', 'CAD');
    console.log(`Result: ${rate}`);

    // Check direct DB access for CAD=X again
    const cached = await prisma.marketDataCache.findUnique({
        where: { symbol: 'CAD=X' }
    });
    console.log('DB Check (CAD=X):', cached ? cached.price : 'NOT FOUND');
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
