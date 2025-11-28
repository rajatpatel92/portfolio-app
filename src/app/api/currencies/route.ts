import { NextResponse } from 'next/server';
import { MarketDataService } from '@/lib/market-data';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
        return NextResponse.json({ error: 'Parameters "from" and "to" are required' }, { status: 400 });
    }

    const rate = await MarketDataService.getExchangeRate(from, to);

    if (rate === null) {
        return NextResponse.json({ error: 'Exchange rate not found' }, { status: 404 });
    }

    return NextResponse.json({ from, to, rate });
}
