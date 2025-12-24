import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { symbol, date, amount } = body;

        if (!symbol || !date) {
            return NextResponse.json({ error: 'Missing symbol or date' }, { status: 400 });
        }

        const hiddenDividend = await prisma.hiddenDividend.create({
            data: {
                symbol,
                date: new Date(date),
                amount: amount ? parseFloat(amount) : null
            }
        });

        return NextResponse.json(hiddenDividend);
    } catch (error) {
        console.error('Error hiding dividend:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { symbol, date } = body;

        if (!symbol || !date) {
            return NextResponse.json({ error: 'Missing symbol or date' }, { status: 400 });
        }

        await prisma.hiddenDividend.deleteMany({
            where: {
                symbol: symbol,
                date: new Date(date)
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error unhiding dividend:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
