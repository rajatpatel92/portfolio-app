import { NextResponse } from 'next/server';
import { MarketDataService } from '@/lib/market-data';
import { auth } from '@/auth';

export async function GET(request: Request) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
        return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }

    const results = await MarketDataService.searchSymbols(query);
    return NextResponse.json(results);
}
