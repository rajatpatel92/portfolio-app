
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const benchmarks = await prisma.benchmark.findMany({
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(benchmarks);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch benchmarks' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { symbol, name } = body;

        if (!symbol || !name) {
            return NextResponse.json({ error: 'Symbol and Name are required' }, { status: 400 });
        }

        const benchmark = await prisma.benchmark.create({
            data: {
                symbol,
                name,
                isSystem: false
            }
        });

        return NextResponse.json(benchmark);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create benchmark' }, { status: 500 });
    }
}
