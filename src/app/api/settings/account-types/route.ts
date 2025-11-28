import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const types = await prisma.accountType.findMany({
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(types);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch account types' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { name, currency } = await request.json();
        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        const newType = await prisma.accountType.create({
            data: {
                name,
                currency: currency || 'USD'
            }
        });
        return NextResponse.json(newType);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create account type' }, { status: 500 });
    }
}
