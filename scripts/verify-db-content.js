
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.count();
    const activities = await prisma.activity.count();
    const investmentTypes = await prisma.investmentType.count();
    const systemSettings = await prisma.systemSetting.count();

    console.log('--- DB VERIFICATION ---');
    console.log(`Users: ${users}`);
    console.log(`Activities: ${activities}`);
    console.log(`InvestmentTypes: ${investmentTypes}`);
    console.log(`SystemSettings: ${systemSettings}`);
    console.log('-----------------------');

    const allUsers = await prisma.user.findMany();
    console.log('Usernames:', allUsers.map(u => u.username));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
