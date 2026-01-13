'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useMemo } from 'react';
import styles from './page.module.css';
import { useCurrency } from '@/context/CurrencyContext';
import ConstituentsGrid from '@/components/ConstituentsGrid';
import AllocationChart from '@/components/AllocationChart';
import AnalysisSkeleton from '@/components/AnalysisSkeleton';
import ReportFilters, { FilterOptions } from '@/components/ReportFilters';
import usePersistentState from '@/hooks/usePersistentState';

interface PortfolioSummary {
    allocationByType: { name: string; value: number }[];
    allocationByAsset: { name: string; value: number }[];
    allocationByAccountType: { name: string; value: number }[];
    allocationByAccount: { name: string; value: number }[];
    constituents: any[];
}

export default function AnalysisPage() {
    const [summary, setSummary] = useState<PortfolioSummary | null>(null);
    const { currency } = useCurrency();
    // Global Filters (Layer 1)
    const [globalFilters, setGlobalFilters, isFiltersLoaded] = usePersistentState<FilterOptions | null>('allocation_filters', null);
    // Interactive Filters (Layer 2)
    const [interactiveFilters, setInteractiveFilters] = useState<{
        investmentType: string | null;
        accountType: string | null;
        accountName: string | null;
    }>({
        investmentType: null,
        accountType: null,
        accountName: null
    });

    useEffect(() => {
        // 1. Try to load from cache
        const cached = localStorage.getItem('portfolio_summary');
        if (cached) {
            try {
                setSummary(JSON.parse(cached));
            } catch (e) {
                console.error('Failed to parse cached summary', e);
            }
        }

        // 2. Fetch fresh data
        fetch(`/api/portfolio?currency=${currency}`)
            .then(res => res.json())
            .then(data => {
                setSummary(data);
                localStorage.setItem('portfolio_summary', JSON.stringify(data));
            })
            .catch(err => console.error('Failed to fetch portfolio', err));
    }, [currency]);

    const handleInvestmentSelect = (type: string | null, e?: React.MouseEvent) => {
        const isMulti = e?.ctrlKey || e?.metaKey;
        setInteractiveFilters(prev => {
            const next = isMulti ? { ...prev } : { investmentType: null, accountType: null, accountName: null };
            next.investmentType = type === prev.investmentType ? null : type;
            return next;
        });
    };

    const handleAccountTypeSelect = (type: string | null, e?: React.MouseEvent) => {
        const isMulti = e?.ctrlKey || e?.metaKey;
        setInteractiveFilters(prev => {
            const next = isMulti ? { ...prev } : { investmentType: null, accountType: null, accountName: null };
            next.accountType = type === prev.accountType ? null : type;
            return next;
        });
    };

    const handleAccountNameSelect = (name: string | null, e?: React.MouseEvent) => {
        const isMulti = e?.ctrlKey || e?.metaKey;
        setInteractiveFilters(prev => {
            const next = isMulti ? { ...prev } : { investmentType: null, accountType: null, accountName: null };
            next.accountName = name === prev.accountName ? null : name;
            return next;
        });
    };

    // --- Layer 1: Global Filter Processing ---
    // Returns constituents recalculated based on global filters (available for charts)
    const globalConstituents = useMemo(() => {
        if (!summary || !globalFilters) return [];

        return summary.constituents
            .map(item => {
                // Filter 1: Investment Type (Top Level)
                if (!globalFilters.investmentTypes.includes(item.type)) return null;

                // Filter 2: Account Types (Breakdown Level)
                let newQuantity = 0;
                let newValue = 0;
                let newCostBasis = 0;
                let newLifetimeDividends = 0;
                let newDividendsYTD = 0;
                let newRealizedGain = 0;
                let weightedXirrSum = 0;
                let totalWeight = 0;

                const newBreakdown: any = {};
                let hasValidAccount = false;

                if (item.accountsBreakdown) {
                    Object.entries(item.accountsBreakdown).forEach(([key, acc]: [string, any]) => {
                        if (globalFilters.accountTypes.includes(acc.accountType)) {
                            hasValidAccount = true;
                            newQuantity += acc.quantity;
                            newValue += (acc.valueNative ?? (acc.quantity * item.price));
                            newCostBasis += (acc.costBasisNative ?? acc.costBasis);
                            newLifetimeDividends += (acc.lifetimeDividendsNative ?? 0);
                            newDividendsYTD += (acc.dividendsYTDNative ?? 0);
                            newRealizedGain += (acc.realizedGainNative ?? 0);
                            newBreakdown[key] = acc; // Keep this slice

                            if (acc.xirr !== null && acc.value > 0) {
                                weightedXirrSum += (acc.xirr * acc.value);
                                totalWeight += acc.value;
                            }
                        }
                    });
                }

                if (!hasValidAccount || (newQuantity === 0 && newLifetimeDividends === 0 && Math.abs(newRealizedGain) < 0.01)) return null;

                const aggregatedXirr = totalWeight > 0 ? weightedXirrSum / totalWeight : null;

                // Scale metrics proportional to quantity/value retained
                // If 100% retained, ratio is 1.
                const quantityRatio = item.quantity > 0 ? (newQuantity / item.quantity) : 0;

                const scaleMetric = (metric: any) => {
                    if (!metric) return metric;
                    return {
                        ...metric,
                        absolute: metric.absolute * quantityRatio,
                        absoluteTarget: metric.absoluteTarget ? metric.absoluteTarget * quantityRatio : undefined
                        // Percent remains same for asset
                    };
                };

                const conversionRate = item.conversionRate || 1;

                return {
                    ...item,
                    quantity: newQuantity,
                    value: newValue, // Native
                    valueTarget: newValue * conversionRate, // Pre-calculated target value
                    bookValue: newCostBasis,
                    bookValueTarget: newCostBasis * conversionRate,
                    lifetimeDividends: newLifetimeDividends,
                    lifetimeDividendsTarget: newLifetimeDividends * conversionRate,
                    dividendsYTD: newDividendsYTD,
                    realizedGain: newRealizedGain,
                    realizedGainTarget: newRealizedGain * conversionRate,
                    accountsBreakdown: newBreakdown, // Important: pass filtered breakdown for next layer

                    // Scaled Metrics
                    dayChange: scaleMetric(item.dayChange),
                    change1W: scaleMetric(item.change1W),
                    change1M: scaleMetric(item.change1M),
                    change1Y: scaleMetric(item.change1Y),
                    changeYTD: scaleMetric(item.changeYTD),

                    // Recalculate Inception (Total Gain) for this slice
                    inceptionChange: {
                        absolute: newValue - newCostBasis,
                        percent: newCostBasis > 0 ? ((newValue - newCostBasis) / newCostBasis) * 100 : 0
                    },
                    xirr: aggregatedXirr
                };
            })
            .filter(Boolean);
    }, [summary, globalFilters]);

    // --- Dynamic Allocations for Charts (Based on Layer 1) ---
    const chartAllocations = useMemo(() => {
        const byType = new Map<string, number>();
        const byAccountType = new Map<string, number>();
        const byAccount = new Map<string, number>();

        globalConstituents.forEach((item: any) => {
            // Type Allocation (Using PRE-CALCULATED Target Value)
            // item.valueTarget handles specific rates used by backend
            const itemTargetValue = item.valueTarget ?? (item.value * (item.conversionRate || 1));
            byType.set(item.type, (byType.get(item.type) || 0) + itemTargetValue);

            // Account & AccountType Allocation (from breakdown)
            if (item.accountsBreakdown) {
                const conversionRate = item.conversionRate || 1;
                Object.values(item.accountsBreakdown).forEach((acc: any) => {
                    // Convert Breakdown Value (Native -> Target)
                    // acc.valueNative is the source. 
                    // Use item.conversionRate (which is rateToUSD * FinalRate)
                    // Note: acc.value is USD. We could convert acc.value * FinalRate?
                    // Better to rely on Native * ConversionRate for consistency with Item
                    const targetValue = (acc.valueNative ?? 0) * conversionRate;

                    byAccountType.set(acc.accountType, (byAccountType.get(acc.accountType) || 0) + targetValue);

                    // Use Composite Key: "Name - Platform"
                    const compositeKey = `${acc.name} - ${acc.platformName}`;
                    byAccount.set(compositeKey, (byAccount.get(compositeKey) || 0) + targetValue);
                });
            }
        });

        const mapToObj = (map: Map<string, number>) => Array.from(map.entries()).map(([name, value]) => ({ name, value }));

        return {
            allocationByType: mapToObj(byType),
            allocationByAccountType: mapToObj(byAccountType),
            allocationByAccount: mapToObj(byAccount)
        };
    }, [globalConstituents]);


    // --- Layer 2: Interactive Filter Processing (For Table) ---
    const finalConstituents = useMemo(() => {
        // Start with Global Filtered data
        return globalConstituents
            .filter((item: any) => {
                // Interactive Filter 1: Investment Type
                if (interactiveFilters.investmentType && item.type !== interactiveFilters.investmentType) return false;

                // Interactive Filter 2 & 3: Account Type / Name
                // We need to check if the item (after global filtering) STILL has exposure to the interactive filter.
                // Since we already filtered `accountsBreakdown` in Layer 1, we just check that.

                let matchesInteractiveAccount = true;
                if (interactiveFilters.accountType || interactiveFilters.accountName) {
                    matchesInteractiveAccount = false; // Assume false until found

                    if (item.accountsBreakdown) {
                        Object.values(item.accountsBreakdown).forEach((acc: any) => {
                            // Construct Composite Key for filtering
                            const compositeKey = `${acc.name} - ${acc.platformName}`;
                            let breakdownMatch = true;
                            if (interactiveFilters.accountType && acc.accountType !== interactiveFilters.accountType) breakdownMatch = false;

                            // Check against Composite Key
                            if (interactiveFilters.accountName && compositeKey !== interactiveFilters.accountName) breakdownMatch = false;

                            if (breakdownMatch) matchesInteractiveAccount = true;
                        });
                    }
                }

                return matchesInteractiveAccount;
            })
            .map((item: any) => {
                // If NO interactive account filters, return the global item (it's already correct for that scope)
                if (!interactiveFilters.accountType && !interactiveFilters.accountName) return item;

                // If there ARE interactive account filters, we need to create a SUB-slice of the global slice
                let newQuantity = 0;
                let newValue = 0;
                let newCostBasis = 0;
                let newLifetimeDividends = 0;
                let newDividendsYTD = 0;
                let newRealizedGain = 0;
                let weightedXirrSum = 0;
                let totalWeight = 0;

                if (item.accountsBreakdown) {
                    Object.values(item.accountsBreakdown).forEach((acc: any) => {
                        let match = true;
                        if (interactiveFilters.accountType && acc.accountType !== interactiveFilters.accountType) match = false;

                        const compositeKey = `${acc.name} - ${acc.platformName}`;
                        if (interactiveFilters.accountName && compositeKey !== interactiveFilters.accountName) match = false;

                        if (match) {
                            newQuantity += acc.quantity;
                            newValue += (acc.valueNative ?? (acc.quantity * item.price));
                            newCostBasis += (acc.costBasisNative ?? 0);
                            newLifetimeDividends += (acc.lifetimeDividendsNative ?? 0);
                            newDividendsYTD += (acc.dividendsYTDNative ?? 0);
                            newRealizedGain += (acc.realizedGainNative ?? 0);
                            if (acc.xirr !== null && acc.value > 0) {
                                weightedXirrSum += (acc.xirr * acc.value);
                                totalWeight += acc.value;
                            }
                        }
                    });
                }

                if (newQuantity === 0 && newLifetimeDividends === 0 && Math.abs(newRealizedGain) < 0.01) return null;

                const aggregatedXirr = totalWeight > 0 ? weightedXirrSum / totalWeight : null;
                const quantityRatio = item.quantity > 0 ? (newQuantity / item.quantity) : 0; // ratio relative to GLOBAL slice

                const scaleMetric = (metric: any) => {
                    if (!metric) return metric;
                    return {
                        ...metric,
                        absolute: metric.absolute * quantityRatio,
                        absoluteTarget: metric.absoluteTarget ? metric.absoluteTarget * quantityRatio : undefined
                    };
                };

                const conversionRate = item.conversionRate || 1;

                return {
                    ...item,
                    quantity: newQuantity,
                    value: newValue,
                    valueTarget: newValue * conversionRate,
                    bookValue: newCostBasis,
                    bookValueTarget: newCostBasis * conversionRate,
                    lifetimeDividends: newLifetimeDividends,
                    lifetimeDividendsTarget: newLifetimeDividends * conversionRate,
                    dividendsYTD: newDividendsYTD,
                    realizedGain: newRealizedGain,
                    realizedGainTarget: newRealizedGain * conversionRate,
                    // breakdown can remain as is or be filtered, strictly speaking UI doesn't iterate it again usually

                    dayChange: scaleMetric(item.dayChange),
                    change1W: scaleMetric(item.change1W),
                    change1M: scaleMetric(item.change1M),
                    change1Y: scaleMetric(item.change1Y),
                    changeYTD: scaleMetric(item.changeYTD),

                    inceptionChange: {
                        absolute: newValue - newCostBasis,
                        percent: newCostBasis > 0 ? ((newValue - newCostBasis) / newCostBasis) * 100 : 0
                    },
                    xirr: aggregatedXirr
                };

            })
            .filter(Boolean);
    }, [globalConstituents, interactiveFilters]);


    if (!summary) return <AnalysisSkeleton />;

    const hasInteractiveFilters = interactiveFilters.investmentType || interactiveFilters.accountType || interactiveFilters.accountName;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerTop}>
                    <div>
                        <h1 className={styles.title}>Portfolio Analysis</h1>
                        <p className={styles.subtitle}>
                            Deep dive into your asset allocation and performance metrics.
                        </p>
                    </div>
                    {isFiltersLoaded && (
                        <ReportFilters onChange={setGlobalFilters} initialFilters={globalFilters || undefined} />
                    )}
                </div>

                {hasInteractiveFilters && (
                    <div className={styles.filterBadges}>
                        {interactiveFilters.investmentType && (
                            <span className={styles.badge}>
                                Type: {interactiveFilters.investmentType}
                                <button onClick={() => setInteractiveFilters(prev => ({ ...prev, investmentType: null }))}>&times;</button>
                            </span>
                        )}
                        {interactiveFilters.accountType && (
                            <span className={styles.badge}>
                                Type: {interactiveFilters.accountType}
                                <button onClick={() => setInteractiveFilters(prev => ({ ...prev, accountType: null }))}>&times;</button>
                            </span>
                        )}
                        {interactiveFilters.accountName && (
                            <span className={styles.badge}>
                                Account: {interactiveFilters.accountName}
                                <button onClick={() => setInteractiveFilters(prev => ({ ...prev, accountName: null }))}>&times;</button>
                            </span>
                        )}
                        <button
                            onClick={() => setInteractiveFilters({ investmentType: null, accountType: null, accountName: null })}
                            className={styles.clearBtn}
                        >
                            Clear Chart Filters
                        </button>
                    </div>
                )}
            </header>

            <div className={styles.analysisGrid}>
                {/* Allocation Charts (Using Global Data) */}
                <div className={styles.chartsRow}>
                    <AllocationChart
                        title="By Investment Type"
                        data={chartAllocations.allocationByType}
                        onSelect={handleInvestmentSelect}
                        selectedName={interactiveFilters.investmentType}
                        isPreConverted={true}
                    />
                    <AllocationChart
                        title="By Account Type"
                        data={chartAllocations.allocationByAccountType}
                        onSelect={handleAccountTypeSelect}
                        selectedName={interactiveFilters.accountType}
                        isPreConverted={true}
                    />
                    <AllocationChart
                        title="By Account"
                        data={chartAllocations.allocationByAccount}
                        onSelect={handleAccountNameSelect}
                        selectedName={interactiveFilters.accountName}
                        isPreConverted={true}
                    />
                </div>

                {/* Constituents Grid (Using Final Data) */}
                <div className={styles.gridContainer}>
                    <ConstituentsGrid data={finalConstituents} />
                </div>
            </div>
        </div>
    );
}
