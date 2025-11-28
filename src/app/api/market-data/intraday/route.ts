import { NextResponse } from 'next/server';
import { MarketDataService } from '@/lib/market-data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    try {
        const data = await MarketDataService.getIntradayPrices(symbol);
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in intraday API:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
