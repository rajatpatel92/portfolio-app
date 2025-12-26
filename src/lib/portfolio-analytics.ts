
import { MarketDataService } from './market-data';
import { prisma } from '@/lib/prisma';
import { Activity } from '@prisma/client';

export interface DailyPerformance {
    date: string;
    marketValue: number;
    nav: number; // Unitized Price
    netFlow: number;
    units: number;
    dividend: number;
    discoveryFlow?: number;
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
    ): Promise<{
        portfolio: DailyPerformance[],
        benchmark: { date: string, value: number, normalized: number }[],
        summary: { portfolioReturn: number, benchmarkReturn: number },
        performers: { top: { symbol: string, return: number }[], bottom: { symbol: string, return: number }[] },
        debug: string[]
    }> {

        const debug: string[] = [];
        const log = (msg: string) => {
            // console.log(msg); // Output to server console
            debug.push(msg);
        };

        log(`[PortfolioAnalytics] Starting Calculation. Target: ${targetCurrency}`);

        // 1. Identify all symbols and currencies
        const types = Array.from(new Set(activities.map(a => a.type)));
        log(`[PortfolioAnalytics] Activity Types Found: ${types.join(', ')}`);

        const symbols = Array.from(new Set(activities.map(a => a.investment.symbol)));
        // Do NOT push benchmarkSymbol here, we fetch it separately to ensure full history coverage
        // symbols.push(benchmarkSymbol);

        const assetCurrencies = Array.from(new Set(activities.map(a => a.investment.currency)));
        const relevantCurrencies = assetCurrencies.filter(c => c && c !== targetCurrency);

        log(`[PortfolioAnalytics] Asset Currencies: ${assetCurrencies.join(', ')}`);
        log(`[PortfolioAnalytics] Relevant Currencies for FX: ${relevantCurrencies.join(', ')}`);

        // 2. Parallel Fetching: Asset Prices + FX Rates
        // Fetch from the earliest activity date or startDate, whichever is earlier
        let firstActivityDate = startDate;
        if (activities.length > 0) {
            const firstDate = new Date(activities[0].date);
            if (firstDate < firstActivityDate) firstActivityDate = firstDate;
        }

        const lookback = new Date(firstActivityDate);
        lookback.setDate(lookback.getDate() - 7);
        log(`[PortfolioAnalytics] Fetching Data from ${lookback.toISOString().split('T')[0]}`);

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
            // Fetch Benchmark with extended lookback (10Y) to ensure we find a valid start price for normalization
            (async () => {
                const benchLookback = new Date(lookback);
                benchLookback.setFullYear(benchLookback.getFullYear() - 5);
                log(`[PortfolioAnalytics] Fetching Benchmark ${benchmarkSymbol} from ${benchLookback.toISOString()}`);
                const hist = await MarketDataService.getDailyHistory(benchmarkSymbol, benchLookback);
                priceMaps[benchmarkSymbol] = hist;
                log(`[PortfolioAnalytics] Benchmark Points: ${Object.keys(hist).length}`);
            })(),
            // Fetch FX Rates
            ...fxPairs.map(async ({ from, to, symbol }) => {
                let hist = await MarketDataService.getDailyHistory(symbol, lookback);

                // Fallback: Try Reverse Pair if direct pair fails (e.g. CADUSD=X might not exist, but USDCAD=X does)
                if (Object.keys(hist).length === 0) {
                    const reverseSymbol = `${to}${from}=X`;
                    log(`[PortfolioAnalytics] Direct FX ${symbol} empty. Trying reverse ${reverseSymbol}`);

                    const reverseHist = await MarketDataService.getDailyHistory(reverseSymbol, lookback);
                    if (Object.keys(reverseHist).length > 0) {
                        // Invert values
                        hist = {};
                        Object.entries(reverseHist).forEach(([date, rate]) => {
                            if (rate > 0) hist[date] = 1 / rate;
                        });
                        log(`[PortfolioAnalytics] Inverted ${Object.keys(hist).length} points from ${reverseSymbol}`);
                    }
                }

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

        // [FIX] Also accumulate dividends from initial activities
        let initialDividends = 0;
        // We need FX for initial dividends. 
        // Logic: Iterate initialActivities, if DIVIDEND, find FX at that date and sum.
        // Problem: We need the FX maps populated first. They are populated above.
        // So we can do this calculation now.

        initialActivities.forEach(a => {
            if (a.type === 'DIVIDEND') {
                const d = new Date(a.date).toISOString().split('T')[0];
                const sym = a.investment.currency;
                const fxMap = fxMaps[sym];
                let fx = 1;

                if (sym !== targetCurrency) {
                    if (fxMap && fxMap[d]) fx = fxMap[d];
                    else {
                        // Find closest previous FX? 
                        // For simplicity, use 1 if missing (or lastKnownFx logic?)
                        // We haven't started limits yet.
                        // Let's rely on map. If missing, maybe try to find closest in map?
                        // Using 1 is safe fallback for now.
                    }
                }
                initialDividends += (a.quantity * a.price) * fx;
            }
        });
        log(`[PortfolioAnalytics] Initial Historical Dividends: ${initialDividends}`);

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

        // Seed Dividend Accumulator
        let dividends = initialDividends;

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

        // [FIX] Initialize FX Rates for the loop
        // Ensure we start with a valid FX rate (e.g. from START_DATE or closest available)
        // rather than defaulting to 1.0 inside the loop, which causes massive drops.
        relevantCurrencies.forEach(c => {
            if (fxMaps[c]) {
                const dateKeys = Object.keys(fxMaps[c]).sort();
                // Find closest date <= startDate
                // Since dateKeys are ISO strings, string comparison works for YYYY-MM-DD
                const startStr = currentDate.toISOString().split('T')[0];
                let closestDate = null;
                for (const d of dateKeys) {
                    if (d <= startStr) closestDate = d;
                    else break;
                }
                // If found, seed it. Any later dates will update it in the loop.
                // If not found (startDate is before any history?), we rely on the first available? 
                // Or fallback to 1.0 (unavoidable if no history).
                if (closestDate) {
                    lastKnownFx[c] = fxMaps[c][closestDate];
                } else if (dateKeys.length > 0) {
                    // If no prior history, use the EARLIEST history available as the best guess
                    // This prevents 1.0 default if logic starts before data
                    lastKnownFx[c] = fxMaps[c][dateKeys[0]];
                }
                log(`[Init FX] ${c}: ${lastKnownFx[c]}`);
            }
        });

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
                // Pass log if date matches target range
                (dateStr === '2023-10-15' || dateStr === '2023-10-16') ? log : undefined
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
                const symbol = a.investment.symbol;

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

                    // [FIX] Negative Holdings Protection
                    // If we sell more than we have (due to missing history/splits), treat the deficit as an implicit deposit
                    // to prevent massive value drops.
                    if (holdings[a.investment.symbol] < 0) {
                        const deficit = Math.abs(holdings[a.investment.symbol]);
                        const deficitVal = deficit * a.price;
                        // Add back the value of the missing shares to netFlow 
                        // (effectively saying "We deposited these shares just before selling them")
                        netFlow += deficitVal * fxRate;
                        holdings[a.investment.symbol] = 0;
                    }
                } else if (a.type === 'DIVIDEND') {
                    const divVal = (a.quantity * a.price);
                    dividends += divVal * fxRate;
                    log(`[Dividend] ${a.date} ${symbol}: Qty=${a.quantity}, Price=${a.price}, FX=${fxRate} -> Val=${divVal * fxRate} (DailyTotal=${dividends})`);
                } else if (a.type === 'STOCK_SPLIT') {
                    holdings[a.investment.symbol] = (holdings[a.investment.symbol] || 0) * a.quantity;
                }

                // [FIX]: Ensure we update lastKnownPrices/Fx for the asset involved today.
                // If we don't, and this is a new asset, the NEXT day's calculateMarketValue loop
                // will see it as a "New Discovery" because lastKnownPrices[symbol] would be 0 or undefined,
                // causing a massive fake "inflow" equal to the entire position value.
                if (priceMaps[symbol]?.[dateStr]) {
                    lastKnownPrices[symbol] = priceMaps[symbol][dateStr];
                } else if (a.price > 0 && !lastKnownPrices[symbol]) {
                    // Fallback to execution price ONLY if we have no market data history
                    lastKnownPrices[symbol] = a.price;
                }

                if (assetCurrency !== targetCurrency && fxMaps[assetCurrency]?.[dateStr]) {
                    lastKnownFx[assetCurrency] = fxMaps[assetCurrency][dateStr];
                }
            });

            // 3. Calculate Performance (NAV Change)
            const adjustablePassiveMV = passiveMV + dividends;

            // [FIX] Epsilon Start Protection
            // Use a threshold (0.01) to avoid division by floating point dust (e.g. 1e-15)
            if (prevMarketValue > 0.01) {
                const growth = adjustablePassiveMV / prevMarketValue;
                nav = nav * growth;
            } else if (netFlow > 0 && nav === 100) {
                // First deposit
                nav = 100;
            }

            // 4. Update Structure
            // 4. Update Structure
            const totalEffectiveFlow = netFlow + discoveryFlow;

            // [FIX] Recalculate Final MV based on End-of-Day Holdings & Prices
            // Previously: const finalMV = passiveMV + netFlow; 
            // We use MTM (recalculated) to prevent Day 2 drops.
            // But we must fallback to Cost (passive + netFlow) if MTM is 0 (Data Missing),
            // otherwise we get massive downspikes.
            const { mv: recalculatedMV } = this.calculateMarketValue(
                holdings,
                priceMaps,
                fxMaps,
                dateStr,
                lastKnownPrices,
                lastKnownFx,
                targetCurrency,
                symbolCurrencyMap
            );

            const costBasisMV = passiveMV + netFlow;
            const finalMV = recalculatedMV > 0 ? recalculatedMV : costBasisMV;

            // Debug decision
            if (dateStr === '2023-10-15' || dateStr === '2023-10-16') {
                log(`[mv-debug] ${dateStr}: RecalcMV=${recalculatedMV}, CostBasis=${costBasisMV}, NetFlow=${netFlow}. Selected=${finalMV}`);
            }

            // Log final day summary
            if (isLastDay) {
                log(`[Final Day ${dateStr}] FinalMV: ${finalMV}, PassiveMV: ${passiveMV}, NetFlow: ${netFlow}, Discovery: ${discoveryFlow}, Nav: ${nav}, Dividends: ${dividends}`);
            }

            dailyPerf.push({
                date: dateStr,
                marketValue: finalMV,
                nav,
                date: dateStr,
                marketValue: finalMV,
                nav,
                netFlow: netFlow, // Store USER flows only. Discovery flow is excluded from Contribution stats.
                discoveryFlow: discoveryFlow,
                units,
                dividend: dividends // Daily dividend (in target currency)
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
                if (d.value > 0) {
                    d.normalized = (d.value / startVal) * 100;
                } else {
                    // Backfill missing initial data (e.g. holidays) to 100 to prevent Division By Zero in Frontend
                    d.normalized = 100;
                }
            });
        } else {
            // No valid data found at all
            benchmarkData.forEach(d => d.normalized = 100);
        }

        // Calculate Summary Stats
        const portfolioStart = dailyPerf.find(d => d.marketValue > 0) || dailyPerf[0];
        const portfolioEnd = dailyPerf[dailyPerf.length - 1];

        const portfolioReturn = portfolioStart && portfolioEnd.nav ? ((portfolioEnd.nav - portfolioStart.nav) / portfolioStart.nav) * 100 : 0;

        let benchmarkReturn = 0;
        const validBenchmark = benchmarkData.filter(d => d.value > 0);
        if (validBenchmark.length > 0) {
            const start = validBenchmark[0].value;
            const end = validBenchmark[validBenchmark.length - 1].value;
            benchmarkReturn = ((end - start) / start) * 100;
        }

        // Calculate Top/Bottom Performers (Simple approach: Price change over period)
        // We need price history for ALL assets in the portfolio for the period.
        // We already have `priceMaps` populated for looked up assets.
        const performanceMap: { symbol: string, return: number }[] = [];

        // Only consider assets currently held or held during period?
        // Let's look at all symbols involved.
        for (const sym of symbols) {
            if (sym === benchmarkSymbol) continue;

            const priceMap = priceMaps[sym];
            if (!priceMap) continue;

            const dates = Object.keys(priceMap).sort();
            // Filter dates within range
            const relevantDates = dates.filter(d => d >= startIso);

            if (relevantDates.length < 2) continue;

            const startPrice = priceMap[relevantDates[0]];
            const endPrice = priceMap[relevantDates[relevantDates.length - 1]];

            if (startPrice > 0) {
                const ret = ((endPrice - startPrice) / startPrice) * 100;
                performanceMap.push({ symbol: sym, return: ret });
            }
        }

        const sortedPerformers = performanceMap.sort((a, b) => b.return - a.return);
        const top5 = sortedPerformers.slice(0, 5);
        const bottom5 = sortedPerformers.slice(-5).reverse();

        return {
            portfolio: dailyPerf,
            benchmark: benchmarkData,
            summary: {
                portfolioReturn,
                benchmarkReturn
            },
            performers: {
                top: top5,
                bottom: bottom5
            },
            debug
        };
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

                // Debug Logging for Oct 2023 Spike
                if (log && (date === '2023-10-15' || date === '2023-10-16')) {
                    log(`[${date}] ${sym} (${assetCurrency}): Qty=${qty}, Price=${currentPrice}, FX=${fxRate}, Val=${currentValConverted.toFixed(2)}`);
                }

                // Discovery?
                if (previousPrice === 0 && currentPrice > 0) {
                    // New price found! Treated as Inflow.
                    discovery += currentValConverted;
                }

                mv += currentValConverted;
                if (log && date === '2023-10-15') {
                    log(`[accum] MV is now ${mv} (Added ${currentValConverted})`);
                }
            }
        });

        return { mv, discovery };
    }
}