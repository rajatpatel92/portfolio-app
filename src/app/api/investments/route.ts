import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const investments = await prisma.investment.findMany({
            select: {
                symbol: true,
                name: true
            },
            distinct: ['symbol'],
            orderBy: {
                symbol: 'asc'
            }
        });

        return NextResponse.json(investments);

    } catch (error) {
        console.error('Error fetching investments:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
