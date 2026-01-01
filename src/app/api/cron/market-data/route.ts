import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MarketDataService } from '@/lib/market-data';

// Increase max duration for this function if hosting supports it (e.g. Vercel Pro)
// For Hobby, 10s is limit (serverless) or 60s (edge). 
// Since this is a "Reliability" fix, we process sequentially.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    // Basic protection (Optional: Set CRON_SECRET in .env)
    if (process.env.CRON_SECRET && key !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('[Cron] Starting Market Data Refresh...');
        const investments = await prisma.investment.findMany({
            select: { symbol: true }
        });

        const uniqueSymbols = Array.from(new Set(investments.map(i => i.symbol)));

        // Add Currency Pairs ensuring they are kept fresh
        // Common pairs + User specific currencies should be detected. 
        // For now, add majors.
        const currencyPairs = ['CAD=X', 'EUR=X', 'GBP=X', 'INR=X', 'AUD=X', 'JPY=X'];
        currencyPairs.forEach(pair => {
            if (!uniqueSymbols.includes(pair)) {
                uniqueSymbols.push(pair);
            }
        });

        console.log(`[Cron] Found ${uniqueSymbols.length} unique symbols to update.`);

        const results = {
            total: uniqueSymbols.length,
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        // Process sequentially to respect rate limits and prevent 429
        for (const symbol of uniqueSymbols) {
            let retryCount = 0;
            const maxRetries = 3;
            let success = false;

            while (!success && retryCount <= maxRetries) {
                try {
                    // 1. Force Refresh Price & Metadata
                    await MarketDataService.getPrice(symbol, true);

                    // 2. Force Refresh History
                    // This updates the 'history' field in MarketDataCache
                    await MarketDataService.getDailyHistory(symbol, undefined, true);

                    results.success++;
                    success = true;
                    // 1 second base delay between symbols
                    await new Promise(r => setTimeout(r, 1000));
                } catch (e: any) {
                    const msg = e.message || '';
                    if (msg.includes('Rate limit exceeded') || msg.includes('429')) {
                        console.warn(`[Cron] Rate Limit for ${symbol}. Pausing...`);

                        // Parse cooling time if available e.g. "Cooling down for 36s"
                        let waitTime = 60; // Default 60s
                        const match = msg.match(/Cooling down for (\d+)s/);
                        if (match && match[1]) {
                            waitTime = parseInt(match[1], 10) + 5; // Add 5s buffer
                        }

                        console.warn(`[Cron] Sleeping for ${waitTime}s before retry ${retryCount + 1}/${maxRetries}...`);
                        await new Promise(r => setTimeout(r, waitTime * 1000));
                        retryCount++;
                    } else {
                        console.error(`[Cron] Failed ${symbol}:`, msg);
                        results.failed++;
                        results.errors.push(`${symbol}: ${msg}`);
                        break; // Don't retry non-rate-limit errors
                    }
                }
            }
        }

        return NextResponse.json({
            message: 'Market Data Refresh Completed',
            stats: results,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[Cron] Critical Failure:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
