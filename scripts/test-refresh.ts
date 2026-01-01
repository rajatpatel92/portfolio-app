
import { MarketDataService } from '../src/lib/market-data';
import { prisma } from '../src/lib/prisma';

async function main() {
    const symbol = 'MSFT'; // Use a major stock to ensure data exists
    console.log(`Testing refreshMarketData for ${symbol}...`);

    // Clear existing cache to emulate "new symbol"
    await prisma.marketDataCache.deleteMany({ where: { symbol } });
    console.log('Cleared cache.');

    // Trigger Refresh
    await MarketDataService.refreshMarketData(symbol);
    console.log('Refresh triggered.');

    // Verify
    const cached = await prisma.marketDataCache.findUnique({ where: { symbol } });
    if (cached) {
        console.log('SUCCESS: Cache entry found.');
        console.log('Price:', cached.price);
        if (cached.history && typeof cached.history === 'object') {
            const keys = Object.keys(cached.history);
            console.log('History entries:', keys.length);
            console.log('Sample History:', keys.slice(0, 5));
        } else {
            console.log('History: NULL or Invalid');
        }
        console.log('Last Updated:', cached.lastUpdated);
    } else {
        console.error('FAILURE: No cache entry found.');
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
