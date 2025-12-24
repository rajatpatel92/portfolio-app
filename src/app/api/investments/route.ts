import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const symbol = searchParams.get('symbol');

        const where = symbol ? { symbol: symbol } : undefined;

        const investments = await prisma.investment.findMany({
            where,
            select: {
                symbol: true,
                name: true,
                type: true
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
