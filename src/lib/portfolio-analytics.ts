
import { MarketDataService } from './market-data';
import { prisma } from '@/lib/prisma';
import { Activity } from '@prisma/client';

export interface DailyPerformance {
    date: string;
    marketValue: number;
    nav: number; // Unitized Price
    netFlow: number;
    units: number;
}

export class PortfolioAnalytics {

    /**
     * Calculates the Unitized NAV history (True Time-Weighted Return)
     * Handles cashflows (Deposits/Withdrawals) seamlessly.
     */
    static async calculateComparisonHistory(
        activities: (Activity & { investment: { symbol: string; currency: string } })[],
        benchmarkSymbol: string,
        startDate: Date
    ): Promise<{ portfolio: DailyPerformance[], benchmark: { date: string, value: number, normalized: number }[] }> {

        // 1. Identify all symbols
        const symbols = Array.from(new Set(activities.map(a => a.investment.symbol)));
        symbols.push(benchmarkSymbol);

        // 2. Fetch Daily History for ALL symbols
        const lookback = new Date(startDate);
        lookback.setDate(lookback.getDate() - 7);

        const priceMaps: Record<string, Record<string, number>> = {};
        await Promise.all(symbols.map(async (sym) => {
            const hist = await MarketDataService.getDailyHistory(sym, lookback);
            priceMaps[sym] = hist;
        }));

        // 3. Replay Engine
        const dailyPerf: DailyPerformance[] = [];

        let currentDate = new Date(startDate);
        const endDate = new Date();

        let holdings: Record<string, number> = {};
        let units = 0;
        let nav = 100; // Start at 100
        let prevMarketValue = 0;

        const initialActivities = activities.filter(a => new Date(a.date) < startDate);
        holdings = this.computeHoldingsState(initialActivities);

        // Initialize Last Known Prices (Stateful for weekends)
        const lastKnownPrices: Record<string, number> = {};

        // Seed lastKnownPrices
        const startIso = startDate.toISOString().split('T')[0];
        Object.keys(priceMaps).forEach(sym => {
            const map = priceMaps[sym];
            if (map[startIso]) lastKnownPrices[sym] = map[startIso];
        });

        // Initial Market Value
        // Note: We don't track discovery flow for the very first day, just initial value
        prevMarketValue = this.calculateMarketValue(holdings, priceMaps, startIso, lastKnownPrices).mv;

        // Initial Units
        if (prevMarketValue > 0) units = prevMarketValue / nav;

        // Iterate Day by Day
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const nextDate = new Date(currentDate);
            nextDate.setDate(nextDate.getDate() + 1);

            // 1. Get Today's Prices & Calculate "Passive" Market Value
            const { mv: passiveMV, discovery: discoveryFlow } = this.calculateMarketValue(holdings, priceMaps, dateStr, lastKnownPrices);

            // 2. Identify Flows (Activities ON this day)
            const daysActivities = activities.filter(a => {
                const aDate = new Date(a.date).toISOString().split('T')[0];
                return aDate === dateStr;
            });

            // Calculate Net Flow & Dividends
            let netFlow = 0;
            let dividends = 0;

            daysActivities.forEach(a => {
                if (a.type === 'BUY') {
                    netFlow += (a.quantity * a.price) + (a.fee || 0);
                    holdings[a.investment.symbol] = (holdings[a.investment.symbol] || 0) + a.quantity;
                } else if (a.type === 'SELL') {
                    netFlow -= (Math.abs(a.quantity) * a.price) - (a.fee || 0);
                    holdings[a.investment.symbol] = (holdings[a.investment.symbol] || 0) - Math.abs(a.quantity);
                } else if (a.type === 'DIVIDEND') {
                    dividends += (a.quantity * a.price);
                } else if (a.type === 'STOCK_SPLIT') {
                    // Assuming quantity represents the split factor (e.g. 2 for 2:1 split)
                    // If quantity is the multiplier, we multiply the existing holding
                    // If the split is reverse, quantity might be fractional (0.5 for 1:2)
                    holdings[a.investment.symbol] = (holdings[a.investment.symbol] || 0) * a.quantity;
                }
            });

            // 3. Calculate Performance (NAV Change)
            // Growth is calculated on the "Old" capital.
            // discoveryFlow represents "New" capital found from price discovery, so we exclude it from growth
            const adjustablePassiveMV = passiveMV + dividends;

            if (prevMarketValue > 0) {
                const growth = adjustablePassiveMV / prevMarketValue;
                nav = nav * growth;
            } else if (netFlow > 0 && nav === 100) {
                // First deposit
                nav = 100;
            }

            // 4. Update Structure for Flows
            // Discovery Flow is treated as an inflow for Unit Issuance
            const totalEffectiveFlow = netFlow + discoveryFlow;
            const finalMV = passiveMV + netFlow; // passiveMV includes discovery already

            // Recalculate Units
            if (totalEffectiveFlow !== 0) {
                const newUnits = totalEffectiveFlow / nav;
                units += newUnits;
            }

            dailyPerf.push({
                date: dateStr,
                marketValue: finalMV,
                nav,
                netFlow: totalEffectiveFlow, // Store total effective flow for transparency
                units
            });

            prevMarketValue = finalMV;
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Process Benchmark
        const benchHist = priceMaps[benchmarkSymbol] || {};
        let lastBenchVal = 0;

        const benchmarkData = dailyPerf.map(d => {
            let val = benchHist[d.date];
            if (val) {
                lastBenchVal = val;
            } else {
                val = lastBenchVal;
            }
            return { date: d.date, value: val || 0, normalized: 0 };
        });

        // Normalize Benchmark
        const firstValid = benchmarkData.find(d => d.value > 0);
        if (firstValid) {
            const startVal = firstValid.value;
            benchmarkData.forEach(d => {
                if (d.value > 0) d.normalized = (d.value / startVal) * 100;
            });
        }

        return { portfolio: dailyPerf, benchmark: benchmarkData };
    }

    private static computeHoldingsState(activities: Activity[]) {
        const h: Record<string, number> = {};
        activities.forEach(a => {
            const s = (a as any).investment.symbol;
            if (a.type === 'BUY') h[s] = (h[s] || 0) + a.quantity;
            if (a.type === 'SELL') h[s] = (h[s] || 0) - Math.abs(a.quantity);
            if (a.type === 'STOCK_SPLIT') h[s] = (h[s] || 0) * a.quantity;
        });
        return h;
    }

    private static calculateMarketValue(
        holdings: Record<string, number>,
        prices: Record<string, Record<string, number>>,
        date: string,
        lastKnownPrices: Record<string, number>
    ): { mv: number, discovery: number } {
        let mv = 0;
        let discovery = 0;

        Object.entries(holdings).forEach(([sym, qty]) => {
            if (qty > 0) {
                const previousPrice = lastKnownPrices[sym] || 0;
                const todayPrice = prices[sym]?.[date];

                // Update last known if we have a valid price today
                if (todayPrice) {
                    lastKnownPrices[sym] = todayPrice;
                }

                const currentPrice = lastKnownPrices[sym] || 0;

                // Price Discovery Logic:
                if (previousPrice === 0 && currentPrice > 0) {
                    discovery += qty * currentPrice;
                }

                mv += qty * currentPrice;
            }
        });
        return { mv, discovery };
    }
}