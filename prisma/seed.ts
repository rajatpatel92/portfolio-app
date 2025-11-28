import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const adminUsername = 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const existingAdmin = await prisma.user.findUnique({
        where: { username: adminUsername },
    });

    if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await prisma.user.create({
            data: {
                username: adminUsername,
                password: hashedPassword,
                role: 'ADMIN',
            },
        });
        console.log(`Admin user created with username: ${adminUsername}`);
    } else {
        console.log('Admin user already exists.');
    }

    // Seed Exchange Rates
    const rates = [
        { symbol: 'USDINR=X', price: 84.45, currency: 'INR' },
        { symbol: 'USDCAD=X', price: 1.40, currency: 'CAD' },
        { symbol: 'CADUSD=X', price: 0.71, currency: 'USD' },
        { symbol: 'INRUSD=X', price: 0.012, currency: 'USD' },
    ];

    for (const rate of rates) {
        await prisma.marketDataCache.upsert({
            where: { symbol: rate.symbol },
            update: {}, // Don't update if exists, let the app fetch fresh data
            create: {
                symbol: rate.symbol,
                price: rate.price,
                change: 0,
                changePercent: 0,
                currency: rate.currency,
                lastUpdated: new Date(), // Set as fresh so it's used immediately
            },
        });
    }
    console.log('Exchange rates seeded.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
