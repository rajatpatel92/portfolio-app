
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
                case '5Y': startDate.setFullYear(startDate.getFullYear() - 5); break;
                case '10Y': startDate.setFullYear(startDate.getFullYear() - 10); break;
                case 'YTD': startDate.setMonth(0, 1); break;
                case 'ALL': startDate.setFullYear(startDate.getFullYear() - 20); break;
                default: startDate.setMonth(startDate.getMonth() - 1);
            }
        }

        // 2. Fetch ALL activities (Required for correct NAV seeding)
        const activities = await prisma.activity.findMany({
            include: { investment: true },
            orderBy: { date: 'asc' }
        });

        if (activities.length === 0) {
            return NextResponse.json([]);
        }

        // Adjust ALL start date
        if (range === 'ALL' && activities.length > 0) {
            const firstDate = new Date(activities[0].date);
            if (firstDate > startDate) startDate = firstDate;
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

        return NextResponse.json(finalPoints);

    } catch (error) {
        console.error('Error generating portfolio history:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
