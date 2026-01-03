
import { NextResponse } from 'next/server';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';
import { PortfolioAnalytics } from '@/lib/portfolio-analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '1M';
    const targetCurrency = searchParams.get('currency') || 'CAD';
    const customStart = searchParams.get('startDate');
    const customEnd = searchParams.get('endDate');

    try {
        // 1. Determine date range (Same logic as before)
        let startDate = new Date();
        const endDate = new Date(); // To Today

        if (range === 'CUSTOM' && customStart && customEnd) {
            startDate = new Date(customStart);
        } else {
            switch (range) {
                case '1D': startDate.setDate(startDate.getDate() - 1); break;
                case '1W': startDate.setDate(startDate.getDate() - 7); break;
                case '1M': startDate.setMonth(startDate.getMonth() - 1); break;
                case '3M': startDate.setMonth(startDate.getMonth() - 3); break;
                case '6M': startDate.setMonth(startDate.getMonth() - 6); break;
                case '1Y': startDate.setFullYear(startDate.getFullYear() - 1); break;
                case '2Y': startDate.setFullYear(startDate.getFullYear() - 2); break;
                case '3Y': startDate.setFullYear(startDate.getFullYear() - 3); break;
                case '5Y': startDate.setFullYear(startDate.getFullYear() - 5); break;
                case '10Y': startDate.setFullYear(startDate.getFullYear() - 10); break;
                case 'YTD': startDate.setMonth(0, 1); break;
                case 'ALL': startDate.setFullYear(startDate.getFullYear() - 20); break;
                default: startDate.setMonth(startDate.getMonth() - 1);
            }
        }

        // Store the requested start date for filtering
        const filterStartDate = new Date(startDate);
        const filterStartDateStr = filterStartDate.toISOString().split('T')[0];

        console.log(`[HistoryAPI] Range=${range}, FilterStart=${filterStartDateStr}, CalcStart=${startDate.toISOString()}`);

        // 2. Fetch ALL activities (Required for correct NAV seeding)
        const activities = await prisma.activity.findMany({
            include: { investment: true },
            orderBy: { date: 'asc' }
        });

        if (activities.length === 0) {
            return NextResponse.json([]);
        }

        // Set calculation start date to the beginning of history (or first activity)
        // This ensures "Invested" and "Holdings" accumulators are correct.
        if (activities.length > 0) {
            const firstDate = new Date(activities[0].date);
            // If requested range is ALL, ensure we cover it.
            // If requested range is YTD, start from firstDate anyway.
            startDate = firstDate;
        } else {
            // No activities, default to something reasonable or empty
            return NextResponse.json([]);
        }

        // 3. Run Analytics
        const benchmarkSymbol = '^GSPC';

        // Map activities to match Analytics interface
        const mappedActivities = activities.map(a => ({
            ...a,
            investment: {
                ...a.investment,
                currency: a.investment.currencyCode
            }
        }));

        const result = await PortfolioAnalytics.calculateComparisonHistory(
            mappedActivities,
            benchmarkSymbol,
            startDate,
            targetCurrency
        );

        // 3.5. [NEW] Handle 1D Intraday Override
        // If 1D, we replace the daily history with granular intraday history
        if (range === '1D') {
            try {
                // [CACHE] Check In-Memory Cache for 1D
                // This avoids re-fetching and re-calculating (heavy) for every dashboard load
                const CACHE_KEY = `1D_HISTORY_${targetCurrency}`;
                const cached = (global as any)._portfolio1DCache;
                const CACHE_TTL = 5 * 60 * 1000; // 5 Minutes

                if (cached && cached.key === CACHE_KEY && (Date.now() - cached.timestamp < CACHE_TTL)) {
                    console.log(`[HistoryAPI] Serving 1D Cache (${((Date.now() - cached.timestamp) / 1000).toFixed(0)}s old)`);
                    return NextResponse.json(cached.data);
                }

                // Calculate Intraday
                const intradayParams = mappedActivities; // already mapped with investment info
                const intradayPortfolio = await PortfolioAnalytics.calculateIntradayHistory(intradayParams, targetCurrency);

                if (intradayPortfolio.length > 0) {
                    // Normalize for Chart
                    // For 1D, 'invested' is usually the OPENING value of the day.
                    const openValue = intradayPortfolio[0].marketValue;

                    const normalized = intradayPortfolio.map(p => ({
                        date: p.date, // This is ISO timestamp including time
                        value: p.marketValue,
                        nav: 100 * (p.marketValue / openValue), // Intraday NAV
                        invested: openValue, // Flat line for 1D comparison
                        dividend: 0
                    }));

                    // [CACHE] Set Cache
                    (global as any)._portfolio1DCache = {
                        key: CACHE_KEY,
                        data: normalized,
                        timestamp: Date.now()
                    };

                    return NextResponse.json(normalized);
                }
            } catch (e) {
                console.error('Intraday Calc Failed, falling back to daily', e);
            }
        }

        // 4. Map to Response
        let cumulativeFlow = 0;
        let cumulativeDividends = 0;
        const historyPoints = result.portfolio.map(p => {
            // p.netFlow is the NET FLOW for that day (Deposit/Withdrawal).
            // p.discoveryFlow needed? Discovery flow is implicit inflow.
            // Usually Analytics handles this.
            // If we just sum p.netFlow, we get Total Invested Capital.
            cumulativeFlow += p.netFlow;
            cumulativeDividends += (p.dividend || 0);

            return {
                date: p.date,
                value: p.marketValue,
                nav: p.nav,
                invested: cumulativeFlow,
                dividend: cumulativeDividends
            };
        });

        // Filter out future dates if customEnd was used? 
        let finalPoints = historyPoints;
        if (range === 'CUSTOM' && customEnd) {
            const endD = new Date(customEnd).toISOString().split('T')[0];
            finalPoints = finalPoints.filter(p => p.date <= endD);
        }

        // Filter by requested Start Date (so we return only the slice, but with correct accumulators)
        finalPoints = finalPoints.filter(p => p.date >= filterStartDateStr);

        console.log(`[HistoryAPI] Returning ${finalPoints.length} points for range ${range}`);

        return NextResponse.json(finalPoints);

    } catch (error) {
        console.error('Error generating portfolio history:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
