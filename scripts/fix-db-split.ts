
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking for STOCK_SPLIT1...');

    const split1 = await prisma.activityType.findUnique({ where: { name: 'STOCK_SPLIT1' } });
    const splitCorrect = await prisma.activityType.findUnique({ where: { name: 'STOCK_SPLIT' } });

    if (split1) {
        console.log('Found STOCK_SPLIT1. ID:', split1.id);

        if (splitCorrect) {
            console.log('STOCK_SPLIT also exists. Merging...');
            // Move activities
            const activities = await prisma.activity.updateMany({
                where: { type: 'STOCK_SPLIT1' },
                data: { type: 'STOCK_SPLIT' } // DB stores type string or relation?
            });
            // Wait, schema says: type String // BUY, SELL, etc.
            // But usually we link via relation or just use the string.
            // Schema: 
            // model Activity { ... type String ... }
            // So we just update the string in Activity table.

            console.log(`Updated ${activities.count} activities to use STOCK_SPLIT.`);

            // Delete the bad type
            await prisma.activityType.delete({ where: { id: split1.id } });
            console.log('Deleted STOCK_SPLIT1.');

        } else {
            console.log('Renaming STOCK_SPLIT1 to STOCK_SPLIT...');
            await prisma.activityType.update({
                where: { id: split1.id },
                data: { name: 'STOCK_SPLIT', isSystem: true, behavior: 'SPLIT' }
            });

            // Make sure all activities using it are consistent (though if they just use the string, they might be fine or need update if we stored 'STOCK_SPLIT1' in the activity.type column)
            // If Activity.type is a string column, we must update it too.
            const activities = await prisma.activity.updateMany({
                where: { type: 'STOCK_SPLIT1' },
                data: { type: 'STOCK_SPLIT' }
            });
            console.log(`Updated ${activities.count} activities to use STOCK_SPLIT string.`);
        }
    } else {
        console.log('STOCK_SPLIT1 not found.');
    }

    // Ensure STOCK_SPLIT is system
    if (splitCorrect || split1) { // if we just renamed split1, it's now splitCorrect effectively
        const final = await prisma.activityType.findUnique({ where: { name: 'STOCK_SPLIT' } });
        if (final && !final.isSystem) {
            await prisma.activityType.update({
                where: { id: final.id },
                data: { isSystem: true, behavior: 'SPLIT' }
            });
            console.log('Set STOCK_SPLIT to isSystem: true');
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
