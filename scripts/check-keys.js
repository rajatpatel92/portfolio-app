
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const keys = ['GEMINI_API_KEY', 'GPT_API_KEY', 'CLAUDE_API_KEY'];
    const settings = await prisma.systemSetting.findMany({
        where: { key: { in: keys } }
    });

    console.log('--- API KEY CHECK ---');
    for (const s of settings) {
        const val = s.value;
        const isMasked = val.includes('...');
        const hasWhitespace = val.trim() !== val;
        const length = val.length;

        console.log(`Key: ${s.key}`);
        console.log(`Length: ${length}`);
        console.log(`Is Masked (...): ${isMasked}`);
        console.log(`Has Whitespace: ${hasWhitespace}`);
        console.log(`First 4 chars: ${val.substring(0, 4)}`);
        // Check for common specific corruptions
        if (val.startsWith('AIza') && val.includes('...')) {
            console.log('WARNING: Appears to be a saved mask value!');
        }
        console.log('---');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
