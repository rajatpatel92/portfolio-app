import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const types = await prisma.investmentType.findMany({
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(types);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch investment types' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { name } = await request.json();
        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        const newType = await prisma.investmentType.create({
            data: { name: name.toUpperCase() }
        });
        return NextResponse.json(newType);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create investment type' }, { status: 500 });
    }
}
