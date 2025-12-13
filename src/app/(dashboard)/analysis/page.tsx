'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react';
import styles from './page.module.css';
import { useCurrency } from '@/context/CurrencyContext';
import ConstituentsGrid from '@/components/ConstituentsGrid';
import AllocationChart from '@/components/AllocationChart';
import AnalysisSkeleton from '@/components/AnalysisSkeleton';

// ... other imports

interface PortfolioSummary {
    allocationByType: { name: string; value: number }[];
    allocationByAsset: { name: string; value: number }[];
    allocationByAccountType: { name: string; value: number }[];
    allocationByAccount: { name: string; value: number }[];
    constituents: any[];
}

export default function AnalysisPage() {
    const [summary, setSummary] = useState<PortfolioSummary | null>(null);
    const { format, convert } = useCurrency();

    const [filters, setFilters] = useState<{
        investmentType: string | null;
        accountType: string | null;
        accountName: string | null;
    }>({
        investmentType: null,
        accountType: null,
        accountName: null
    });

    useEffect(() => {
        // 1. Try to load from cache immediately
        const cached = localStorage.getItem('portfolio_summary');
        if (cached) {
            try {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setSummary(JSON.parse(cached));
            } catch (e) {
                console.error('Failed to parse cached summary', e);
            }
        }

        // 2. Fetch fresh data
        fetch('/api/portfolio')
            .then(res => res.json())
            .then(data => {
                setSummary(data);
                localStorage.setItem('portfolio_summary', JSON.stringify(data));
            })
            .catch(err => console.error('Failed to fetch portfolio', err));
    }, []);

    const handleInvestmentSelect = (type: string | null, e?: React.MouseEvent) => {
        const isMulti = e?.ctrlKey || e?.metaKey;
        setFilters(prev => {
            const next = isMulti ? { ...prev } : { investmentType: null, accountType: null, accountName: null };
            next.investmentType = type === prev.investmentType ? null : type;
            return next;
        });
    };

    const handleAccountTypeSelect = (type: string | null, e?: React.MouseEvent) => {
        const isMulti = e?.ctrlKey || e?.metaKey;
        setFilters(prev => {
            const next = isMulti ? { ...prev } : { investmentType: null, accountType: null, accountName: null };
            next.accountType = type === prev.accountType ? null : type;
            return next;
        });
    };

    const handleAccountNameSelect = (name: string | null, e?: React.MouseEvent) => {
        const isMulti = e?.ctrlKey || e?.metaKey;
        setFilters(prev => {
            const next = isMulti ? { ...prev } : { investmentType: null, accountType: null, accountName: null };
            next.accountName = name === prev.accountName ? null : name;
            return next;
        });
    };

    if (!summary) return <AnalysisSkeleton />;

    const filteredConstituents = summary.constituents
        .filter(item => {
            // 1. Initial High-Level Filter (Optimization)
            if (filters.investmentType && item.type !== filters.investmentType) return false;
            // For account filters, we can't just return false yet if we want to support multi-account aggregation later, 
            // but for now, if the item has NO exposure to the filter, we can drop it.
            if (filters.accountType && !item.accountTypes?.includes(filters.accountType)) return false;

            // Relaxed check for Account Name to handle potential data definition mismatches
            if (filters.accountName) {
                const hasName = item.accountNames?.some((n: string) => String(n).trim() === String(filters.accountName).trim());
                if (!hasName) return false;
            }
            return true;
        })
        .map(item => {
            // 2. If no granular filters, return item as is
            if (!filters.accountType && !filters.accountName) return item;

            // 3. Recalculate based on breakdown
            let newQuantity = 0;
            let newValue = 0;
            let newCostBasis = 0;

            // XIRR Aggregation (Weighted Average by Value)
            let weightedXirrSum = 0;
            let totalWeight = 0;

            // Determine earliest buy date for this filtered view
            let earliestFilteredBuyDate: Date | null = null;

            if (item.accountsBreakdown) {
                Object.entries(item.accountsBreakdown).forEach(([key, acc]: [string, any]) => {
                    let match = true;
                    if (filters.accountType && acc.accountType !== filters.accountType) match = false;

                    if (filters.accountName) {
                        const filterName = String(filters.accountName).trim();
                        const accName = String(acc.name).trim();
                        // Robust Match: Check explicit name property OR key prefix
                        const nameMatches = accName === filterName;
                        const keyMatches = key.startsWith(filterName + ':');
                        if (!nameMatches && !keyMatches) match = false;
                    }

                    if (match) {
                        newQuantity += acc.quantity;
                        newValue += acc.value;
                        newCostBasis += acc.costBasis;

                        if (acc.xirr !== null && acc.value > 0) {
                            weightedXirrSum += (acc.xirr * acc.value);
                            totalWeight += acc.value;
                        }

                        if (acc.firstBuyDate) {
                            const date = new Date(acc.firstBuyDate);
                            if (!earliestFilteredBuyDate || date < earliestFilteredBuyDate) {
                                earliestFilteredBuyDate = date;
                            }
                        }
                    }
                });
            }

            // 4. Return new object
            // Avoid creating object if no quantity found
            if (newQuantity === 0) return null;

            const aggregatedXirr = totalWeight > 0 ? weightedXirrSum / totalWeight : null;

            const now = new Date();
            const date1W = new Date(now); date1W.setDate(now.getDate() - 7);
            const date1M = new Date(now); date1M.setMonth(now.getMonth() - 1);
            const date1Y = new Date(now); date1Y.setFullYear(now.getFullYear() - 1);
            const dateYTD = new Date(now.getFullYear(), 0, 1);

            const scaleChange = (change: any, periodStartDate: Date) => {
                // If the position (in this filtered slice) didn't exist at the start of the period, 
                // showing a change is misleading/incorrect.
                // FIX: Only suppress if we are SURE it is too young. If date is missing (e.g. data anomaly), default to showing.
                if (!change || (earliestFilteredBuyDate && earliestFilteredBuyDate > periodStartDate)) return null;

                const ratio = item.quantity > 0 ? (newQuantity / item.quantity) : 0;
                return {
                    ...change,
                    absolute: change.absolute * ratio
                    // percent remains the same as it's asset-level performance
                };
            };


            return {
                ...item,
                quantity: newQuantity,
                value: newValue,
                bookValue: newCostBasis,
                currency: 'USD',

                // Recalculate day change proportional to value
                dayChange: {
                    ...item.dayChange,
                    absolute: item.value > 0 ? (item.dayChange.absolute * (newValue / item.value)) : 0
                },

                // Scale historical metrics with Age Check
                change1W: scaleChange(item.change1W, date1W),
                change1M: scaleChange(item.change1M, date1M),
                change1Y: scaleChange(item.change1Y, date1Y),
                changeYTD: scaleChange(item.changeYTD, dateYTD),

                // Accurate Inception Change for this slice
                inceptionChange: {
                    absolute: newValue - newCostBasis,
                    percent: newCostBasis > 0 ? ((newValue - newCostBasis) / newCostBasis) * 100 : 0
                },

                // Aggregated XIRR
                xirr: aggregatedXirr
            };
        })
        .filter(Boolean); // Remove nulls

    const hasFilters = filters.investmentType || filters.accountType || filters.accountName;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Portfolio Analysis</h1>
                <p className={styles.subtitle}>
                    Deep dive into your asset allocation and performance metrics.
                </p>
                {hasFilters && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {filters.investmentType && (
                            <span style={{
                                background: 'var(--primary)', color: 'white', padding: '0.25rem 0.75rem',
                                borderRadius: '1rem', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem'
                            }}>
                                Type: {filters.investmentType}
                                <button onClick={() => setFilters(prev => ({ ...prev, investmentType: null }))}
                                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1rem' }}>&times;</button>
                            </span>
                        )}
                        {filters.accountType && (
                            <span style={{
                                background: 'var(--primary)', color: 'white', padding: '0.25rem 0.75rem',
                                borderRadius: '1rem', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem'
                            }}>
                                Type: {filters.accountType}
                                <button onClick={() => setFilters(prev => ({ ...prev, accountType: null }))}
                                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1rem' }}>&times;</button>
                            </span>
                        )}
                        {filters.accountName && (
                            <span style={{
                                background: 'var(--primary)', color: 'white', padding: '0.25rem 0.75rem',
                                borderRadius: '1rem', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem'
                            }}>
                                Account: {filters.accountName}
                                <button onClick={() => setFilters(prev => ({ ...prev, accountName: null }))}
                                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1rem' }}>&times;</button>
                            </span>
                        )}
                        <button
                            onClick={() => setFilters({ investmentType: null, accountType: null, accountName: null })}
                            style={{
                                background: 'transparent', border: '1px solid var(--text-secondary)', color: 'var(--text-secondary)',
                                padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.875rem', cursor: 'pointer'
                            }}
                        >
                            Clear All
                        </button>
                    </div>
                )}
            </header>

            <div className={styles.analysisGrid}>
                {/* Allocation Charts */}
                <div className={styles.chartsRow}>
                    <AllocationChart
                        title="By Investment Type"
                        data={summary.allocationByType}
                        onSelect={handleInvestmentSelect}
                        selectedName={filters.investmentType}
                    />
                    <AllocationChart
                        title="By Account Type"
                        data={summary.allocationByAccountType || []}
                        onSelect={handleAccountTypeSelect}
                        selectedName={filters.accountType}
                    />
                    <AllocationChart
                        title="By Account"
                        data={summary.allocationByAccount || []}
                        onSelect={handleAccountNameSelect}
                        selectedName={filters.accountName}
                    />
                </div>

                {/* Constituents Grid */}
                <div className={styles.gridContainer}>
                    <ConstituentsGrid data={filteredConstituents} />
                </div>
            </div>
        </div>
    );
}
