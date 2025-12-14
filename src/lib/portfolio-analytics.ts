
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

    static async calculateFlows(
        activities: (Activity & { investment: { symbol: string; currency: string } })[],
        targetCurrency: string = 'CAD'
    ) {
        // 1. Identify currencies
        const assetCurrencies = Array.from(new Set(activities.map(a => a.investment.currency)));
        const relevantCurrencies = assetCurrencies.filter(c => c && c !== targetCurrency);

        // 2. Fetch FX Rates
        const lookback = new Date(); // Determine oldest activity?
        if (activities.length > 0) {
            lookback.setTime(new Date(activities[0].date).getTime());
        } else {
            lookback.setFullYear(lookback.getFullYear() - 1);
        }

        const fxMaps: Record<string, Record<string, number>> = {};
        const fxPairs = relevantCurrencies.map(c => ({ from: c, to: targetCurrency, symbol: `${c}${targetCurrency}=X` }));

        await Promise.all(fxPairs.map(async ({ from, symbol }) => {
            const hist = await MarketDataService.getDailyHistory(symbol, lookback);
            fxMaps[from] = hist;
        }));

        // 3. Aggregate
        // We reuse the structure from route.ts but strictly typed here would be better
        // For now, return raw data so route can format? Or format here? 
        // Formatting (Week/Month/Year) is better done here to keep logic encapsulated.

        const flows = {
            week: new Map<string, any>(),
            month: new Map<string, any>(),
            year: new Map<string, any>()
        };

        const dividends = {
            month: new Map<string, any>(),
            year: new Map<string, any>()
        };

        const processMap = (map: Map<string, any>, key: string, dateStr: string, inflow: number, outflow: number) => {
            if (!map.has(key)) map.set(key, { date: dateStr, inflow: 0, outflow: 0 });
            const e = map.get(key);
            e.inflow += inflow;
            e.outflow += outflow;
        };

        const processDivMap = (map: Map<string, any>, key: string, dateStr: string, amount: number) => {
            if (!map.has(key)) map.set(key, { date: dateStr, amount: 0 });
            const e = map.get(key);
            e.amount += amount;
        };

        activities.forEach(a => {
            const date = new Date(a.date);
            const dateStr = date.toISOString().split('T')[0];
            const assetCurrency = a.investment.currency;

            let fx = 1;
            if (assetCurrency !== targetCurrency) {
                fx = fxMaps[assetCurrency]?.[dateStr] || 1;
                // We could implement lastKnownFx logic here too for robustness
            }

            const amount = ((a.quantity * a.price) + (a.fee || 0)) * fx;
            const divAmount = (a.quantity * a.price) * fx;

            // Generate Keys
            const yKey = date.getFullYear().toString();
            const mKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

            // Week Key
            const day = date.getDay();
            const diff = date.getDate() - day;
            const weekStart = new Date(date);
            weekStart.setDate(diff);
            const wKey = weekStart.toISOString().split('T')[0];

            if (a.type === 'BUY' || a.type === 'DEPOSIT') {
                processMap(flows.week, wKey, wKey, amount, 0);
                processMap(flows.month, mKey, `${mKey}-01`, amount, 0);
                processMap(flows.year, yKey, `${yKey}-01-01`, amount, 0);
            } else if (a.type === 'SELL' || a.type === 'WITHDRAWAL') {
                processMap(flows.week, wKey, wKey, 0, Math.abs(amount));
                processMap(flows.month, mKey, `${mKey}-01`, 0, Math.abs(amount));
                processMap(flows.year, yKey, `${yKey}-01-01`, 0, Math.abs(amount));
            } else if (a.type === 'DIVIDEND') {
                processDivMap(dividends.month, mKey, `${mKey}-01`, divAmount);
                processDivMap(dividends.year, yKey, `${yKey}-01-01`, divAmount);
            }
        });

        const sort = (map: Map<any, any>) => Array.from(map.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return {
            contributions: {
                week: sort(flows.week),
                month: sort(flows.month),
                year: sort(flows.year)
            },
            dividends: {
                month: sort(dividends.month),
                year: sort(dividends.year)
            }
        };
    }

    static async calculateComparisonHistory(
        activities: (Activity & { investment: { symbol: string; currency: string } })[],
        benchmarkSymbol: string,
        startDate: Date,
        targetCurrency: string = 'CAD'
    ): Promise<{ portfolio: DailyPerformance[], benchmark: { date: string, value: number, normalized: number }[], debug: string[] }> {

        const debug: string[] = [];
        const log = (msg: string) => { console.log(msg); debug.push(msg); };

        log(`[PortfolioAnalytics] Starting Calculation. Target: ${targetCurrency}`);

        // 1. Identify all symbols and currencies
        const symbols = Array.from(new Set(activities.map(a => a.investment.symbol)));
        symbols.push(benchmarkSymbol);

        const assetCurrencies = Array.from(new Set(activities.map(a => a.investment.currency)));
        const relevantCurrencies = assetCurrencies.filter(c => c && c !== targetCurrency);

        log(`[PortfolioAnalytics] Asset Currencies: ${assetCurrencies.join(', ')}`);
        log(`[PortfolioAnalytics] Relevant Currencies for FX: ${relevantCurrencies.join(', ')}`);

        // 2. Parallel Fetching: Asset Prices + FX Rates
        const lookback = new Date(startDate);
        lookback.setDate(lookback.getDate() - 7);

        const priceMaps: Record<string, Record<string, number>> = {};
        const fxMaps: Record<string, Record<string, number>> = {};

        // Prepare FX pairs to fetch
        const fxPairs = relevantCurrencies.map(c => ({ from: c, to: targetCurrency, symbol: `${c}${targetCurrency}=X` }));
        log(`[PortfolioAnalytics] Fetching FX Pairs: ${fxPairs.map(p => p.symbol).join(', ')}`);

        await Promise.all([
            // Fetch Asset Prices
            ...symbols.map(async (sym) => {
                const hist = await MarketDataService.getDailyHistory(sym, lookback);
                priceMaps[sym] = hist;
            }),
            // Fetch FX Rates
            ...fxPairs.map(async ({ from, symbol }) => {
                const hist = await MarketDataService.getDailyHistory(symbol, lookback);
                fxMaps[from] = hist;
            })
        ]);

        log(`[PortfolioAnalytics] Fetch Complete. PriceKeys: ${Object.keys(priceMaps).length}, FXKeys: ${Object.keys(fxMaps).length}`);
        Object.keys(fxMaps).forEach(k => {
            const points = Object.keys(fxMaps[k]).length;
            log(`[PortfolioAnalytics] FX ${k}: ${points} data points. Sample: ${JSON.stringify(Object.entries(fxMaps[k]).slice(0, 3))}`);
        });

        // 3. Replay Engine
        const dailyPerf: DailyPerformance[] = [];

        let currentDate = new Date(startDate);
        const endDate = new Date(); // To Today

        let holdings: Record<string, number> = {};
        let units = 0;
        let nav = 100; // Start at 100
        let prevMarketValue = 0;

        const initialActivities = activities.filter(a => new Date(a.date) < startDate);
        holdings = this.computeHoldingsState(initialActivities);

        // State for filling gaps (Prices & FX)
        const lastKnownPrices: Record<string, number> = {};
        const lastKnownFx: Record<string, number> = {};

        // Seed State
        const startIso = startDate.toISOString().split('T')[0];

        // Seed Prices
        Object.keys(priceMaps).forEach(sym => {
            const map = priceMaps[sym];
            if (map[startIso]) lastKnownPrices[sym] = map[startIso];
        });

        // Seed FX
        relevantCurrencies.forEach(c => {
            const map = fxMaps[c];
            if (map && map[startIso]) lastKnownFx[c] = map[startIso];
            else lastKnownFx[c] = 1; // Default to 1 if missing start (risky but better than 0)
        });

        // Map Symbol -> Currency for fast lookup
        const symbolCurrencyMap: Record<string, string> = {};
        activities.forEach(a => symbolCurrencyMap[a.investment.symbol] = a.investment.currency);

        // Initial Market Value
        prevMarketValue = this.calculateMarketValue(
            holdings,
            priceMaps,
            fxMaps,
            startIso,
            lastKnownPrices,
            lastKnownFx,
            targetCurrency,
            symbolCurrencyMap
        ).mv;

        // Initial Units
        if (prevMarketValue > 0) units = prevMarketValue / nav;

        // Iterate Day by Day
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const isLastDay = dateStr === endDate.toISOString().split('T')[0];

            // 1. Get Today's Value (Passive)
            const { mv: passiveMV, discovery: discoveryFlow } = this.calculateMarketValue(
                holdings,
                priceMaps,
                fxMaps,
                dateStr,
                lastKnownPrices,
                lastKnownFx,
                targetCurrency,
                symbolCurrencyMap,
                isLastDay ? log : undefined
            );

            // 2. Identify Flows (Activities ON this day)
            const daysActivities = activities.filter(a => {
                const aDate = new Date(a.date).toISOString().split('T')[0];
                return aDate === dateStr;
            });

            // Calculate Net Flow & Dividends (Converted to Target Currency)
            let netFlow = 0;
            let dividends = 0;

            daysActivities.forEach(a => {
                // Determine FX Rate for this transaction's currency
                const assetCurrency = a.investment.currency;

                // For Transaction Flow, we usually use the historic rate ON THAT DAY (or close to it)
                // We can use our daily FX map
                let fxRate = 1;
                if (assetCurrency !== targetCurrency) {
                    fxRate = fxMaps[assetCurrency]?.[dateStr] || lastKnownFx[assetCurrency] || 1;
                    // Note: If we have NO rate ever, we might assume 1 or 0. Data gaps in FX are bad.
                }

                if (a.type === 'BUY') {
                    // Cost = (Qty * Price) + Fee
                    // All in Asset Currency? Usually Price is Asset Currency. Fee might be Account Currency?
                    // ASSUMPTION: Price is in Investment Currency. Fee is in Account Currency.
                    // Complex. For now, assume uniform currency for simplicity or map Fee separately if needed.
                    // Given previous impl just summed standard amounts, we assume everything is "Value" in Asset Currency.
                    const flowVal = (a.quantity * a.price) + (a.fee || 0);
                    netFlow += flowVal * fxRate;

                    holdings[a.investment.symbol] = (holdings[a.investment.symbol] || 0) + a.quantity;
                } else if (a.type === 'SELL') {
                    const flowVal = (Math.abs(a.quantity) * a.price) - (a.fee || 0); // Proceeds - Fee
                    netFlow -= flowVal * fxRate; // Outflow is negative

                    holdings[a.investment.symbol] = (holdings[a.investment.symbol] || 0) - Math.abs(a.quantity);
                } else if (a.type === 'DIVIDEND') {
                    const divVal = (a.quantity * a.price);
                    dividends += divVal * fxRate;
                } else if (a.type === 'STOCK_SPLIT') {
                    holdings[a.investment.symbol] = (holdings[a.investment.symbol] || 0) * a.quantity;
                }
            });

            // 3. Calculate Performance (NAV Change)
            const adjustablePassiveMV = passiveMV + dividends;

            if (prevMarketValue > 0) {
                const growth = adjustablePassiveMV / prevMarketValue;
                nav = nav * growth;
            } else if (netFlow > 0 && nav === 100) {
                // First deposit
                nav = 100;
            }

            // 4. Update Structure
            const totalEffectiveFlow = netFlow + discoveryFlow;
            const finalMV = passiveMV + netFlow;

            // Log final day summary
            if (isLastDay) {
                log(`[Final Day ${dateStr}] FinalMV: ${finalMV}, PassiveMV: ${passiveMV}, NetFlow: ${netFlow}, Discovery: ${discoveryFlow}, Nav: ${nav}, Dividends: ${dividends}`);
            }

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

        // Process Benchmark (Normalize to 100)
        // Benchmark is usually an index like ^GSPC (USD).
        // If we want to compare correctly, should we convert Benchmark to CAD?
        // Usually Benchmark Comparison is % return vs % return, so Currency doesn't matter for the Index Line itself
        // AS LONG AS we compare normalized values.
        // So we keep benchmark raw.
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

        return { portfolio: dailyPerf, benchmark: benchmarkData, debug };
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
        fxMaps: Record<string, Record<string, number>>,
        date: string,
        lastKnownPrices: Record<string, number>,
        lastKnownFx: Record<string, number>,
        targetCurrency: string,
        symbolCurrencyMap: Record<string, string>,
        log?: (msg: string) => void
    ): { mv: number, discovery: number } {
        let mv = 0;
        let discovery = 0;

        Object.entries(holdings).forEach(([sym, qty]) => {
            if (qty > 0) {
                const assetCurrency = symbolCurrencyMap[sym] || 'USD';

                const previousPrice = lastKnownPrices[sym] || 0;
                const todayPrice = prices[sym]?.[date];

                // Update Price
                if (todayPrice) lastKnownPrices[sym] = todayPrice;
                const currentPrice = lastKnownPrices[sym] || 0;

                // FX Rate
                let fxRate = 1;
                if (assetCurrency !== targetCurrency) {
                    const previousFx = lastKnownFx[assetCurrency] || 1;
                    const todayFx = fxMaps[assetCurrency]?.[date];
                    if (todayFx) lastKnownFx[assetCurrency] = todayFx;
                    fxRate = lastKnownFx[assetCurrency] || previousFx; // Use previousFx as fallback if lastKnownFx[assetCurrency] is still 0/undefined
                }

                const currentValConverted = qty * currentPrice * fxRate;

                if (log) {
                    log(`[${date}] ${sym} (${assetCurrency}): Qty=${qty}, Price=${currentPrice}, FX=${fxRate}, Val=${currentValConverted.toFixed(2)}`);
                }

                // Discovery?
                if (previousPrice === 0 && currentPrice > 0) {
                    // New price found! Treated as Inflow.
                    discovery += currentValConverted;
                }

                mv += currentValConverted;
            }
        });

        return { mv, discovery };
    }
}