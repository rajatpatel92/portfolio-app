
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const typeName = 'STOCK_SPLIT';
        const behavior = 'SPLIT';

        const existing = await prisma.activityType.findUnique({
            where: { name: typeName }
        });

        if (!existing) {
            await prisma.activityType.create({
                data: {
                    name: typeName,
                    behavior: behavior
                }
            });
            console.log(`Created ActivityType: ${typeName}`);
        } else {
            console.log(`ActivityType ${typeName} already exists.`);
            // Update behavior if needed
            if (existing.behavior !== behavior) {
                await prisma.activityType.update({
                    where: { name: typeName },
                    data: { behavior: behavior }
                });
                console.log(`Updated behavior for ${typeName}`);
            }
        }
    } catch (e) {
        console.error(e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
