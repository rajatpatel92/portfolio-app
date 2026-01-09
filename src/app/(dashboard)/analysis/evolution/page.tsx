'use client';

import { useState, useEffect } from 'react';
import ReportFilters, { FilterOptions } from '@/components/ReportFilters';
import RangeSelector from '@/components/RangeSelector';
import PortfolioChart from '@/components/PortfolioChart';
import ContributionChart from '@/components/ContributionChart';
import DividendChart from '@/components/DividendChart';
import styles from './page.module.css';
import AnalysisSkeleton from '@/components/AnalysisSkeleton';
import { useCurrency } from '@/context/CurrencyContext';

import { ClientCache } from '@/lib/client-cache';
import usePersistentState from '@/hooks/usePersistentState';

export default function EvolutionPage() {
    const [filters, setFilters, isFiltersLoaded] = usePersistentState<FilterOptions | null>('evolution_filters', null);

    const [data, setData] = useState<{
        evolution?: any[];
        contributions?: any;
        dividends?: any;
        debug?: any[];
    }>({});

    const [loadingHistory, setLoadingHistory] = useState(true);
    const [loadingFlows, setLoadingFlows] = useState(true);

    // Chart toggles
    const [contributionPeriod, setContributionPeriod] = useState<'week' | 'month' | 'year'>('month');
    const [dividendPeriod, setDividendPeriod] = useState<'month' | 'year'>('year');

    // Independent Ranges
    const [contributionRange, setContributionRange] = useState('ALL');
    const [dividendRange, setDividendRange] = useState('ALL');

    const [range, setRange] = usePersistentState('evolution_range', 'ALL');
    const { currency } = useCurrency();

    useEffect(() => {
        // Safe filters: if null (initial load), treat as empty arrays (fetch all).
        const safeFilters = filters || { accountTypes: [], investmentTypes: [] };

        // Only fetch if filters are loaded (or if we decide to fetch anyway with defaults)
        // But to avoid double-fetch (one with null, one with loaded), we can wait?
        // Actually the race condition was in ReportFilters resetting state.
        // Fetching with empty filters is fine, but ReportFilters will overwrite `filters` if we render it too early.

        const fetchHistory = async () => {
            const cacheKey = ClientCache.generateKey('evolution_history', { filters: safeFilters, range, currency });
            const cached = ClientCache.get<any>(cacheKey);

            if (cached) {
                setData(prev => ({ ...prev, evolution: cached.evolution }));
                setLoadingHistory(false);
                return;
            }

            setLoadingHistory(true);
            try {
                const backendFilters = { ...safeFilters, assetClasses: safeFilters.investmentTypes };
                const res = await fetch('/api/analytics/evolution', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filters: backendFilters, range, currency, mode: 'evolution' })
                });
                if (res.ok) {
                    const json = await res.json();
                    setData(prev => ({ ...prev, evolution: json.evolution }));
                    ClientCache.set(cacheKey, { evolution: json.evolution });
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingHistory(false);
            }
        };

        const fetchFlows = async () => {
            const cacheKey = ClientCache.generateKey('evolution_flows', { filters: safeFilters, range, currency });
            const cached = ClientCache.get<any>(cacheKey);

            if (cached) {
                setData(prev => ({ ...prev, contributions: cached.contributions, dividends: cached.dividends }));
                setLoadingFlows(false);
                return;
            }

            setLoadingFlows(true);
            try {
                const backendFilters = { ...safeFilters, assetClasses: safeFilters.investmentTypes };
                const res = await fetch('/api/analytics/evolution', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filters: backendFilters, range, currency, mode: 'flows' })
                });
                if (res.ok) {
                    const json = await res.json();
                    setData(prev => ({ ...prev, contributions: json.contributions, dividends: json.dividends }));
                    ClientCache.set(cacheKey, { contributions: json.contributions, dividends: json.dividends });
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingFlows(false);
            }
        };

        const timeout = setTimeout(() => {
            fetchHistory();
            fetchFlows();
        }, 300);
        return () => clearTimeout(timeout);
    }, [filters, range, currency]);

    // Generic Range Filter
    const filterByRange = (items: any[], rangeToUse: string) => {
        if (!items) return [];
        if (rangeToUse === 'ALL') return items;

        const now = new Date();
        const cutoff = new Date();

        switch (rangeToUse) {
            case '1D': cutoff.setDate(now.getDate() - 1); break;
            case '1W': cutoff.setDate(now.getDate() - 7); break;
            case '1M': cutoff.setMonth(now.getMonth() - 1); break;
            case '3M': cutoff.setMonth(now.getMonth() - 3); break;
            case '6M': cutoff.setMonth(now.getMonth() - 6); break;
            case '1Y': cutoff.setFullYear(now.getFullYear() - 1); break;
            case '2Y': cutoff.setFullYear(now.getFullYear() - 2); break;
            case '3Y': cutoff.setFullYear(now.getFullYear() - 3); break;
            case 'YTD': cutoff.setMonth(0, 1); break; // Jan 1st
            case '5Y': cutoff.setFullYear(now.getFullYear() - 5); break;
            default: return items;
        }
        // Comparison using string dates (YYYY-MM-DD or YYYY-MM or YYYY)
        // ISO Strings compare correctly lexicographically if format is compatible.
        // But our data.date can be '2026' or '2026-01'.
        // '2026' < '2025-12-31' ? No.
        // Safer to construct Date objects.
        return items.filter((p: any) => {
            // Handle partial dates e.g. "2023" -> "2023-01-01" for comparison
            const dStr = p.date.length === 4 ? `${p.date}-01-01` :
                p.date.length === 7 ? `${p.date}-01` : p.date;
            return new Date(dStr) >= cutoff;
        });
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Portfolio History</h1>
                    <p className={styles.subtitle}>Track your portfolio performance, contributions, and dividends over time.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-end' }}>
                    {isFiltersLoaded && (
                        <ReportFilters
                            onChange={setFilters}
                            initialFilters={filters || undefined}
                        />
                    )}
                </div>
            </div>

            <div className={styles.analysisGrid}>
                {/* 1. Portfolio Evolution Chart */}
                <div style={{ height: '500px', width: '100%', position: 'relative' }}>
                    {loadingHistory && !data.evolution && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.1)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Portfolio History...</div>
                    )}
                    <PortfolioChart
                        range={range}
                        setRange={setRange}
                        customStart="" setCustomStart={() => { }}
                        customEnd="" setCustomEnd={() => { }}
                        externalData={filterByRange(data.evolution || [], range)}
                    />
                </div>

                {/* 2. Contribution History */}
                <div className={styles.chartCard} style={{ height: '600px', position: 'relative' }}>
                    {loadingFlows && !data.contributions && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.1)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Flows...</div>
                    )}
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                <h3 style={{ margin: 0 }}>Contribution History</h3>
                                <div className={styles.filterGroup}>
                                    {['week', 'month', 'year'].map(p => (
                                        <button
                                            key={p}
                                            className={`${styles.filterButton} ${contributionPeriod === p ? styles.filterButtonActive : ''}`}
                                            onClick={() => setContributionPeriod(p as any)}
                                        >
                                            {p.charAt(0).toUpperCase() + p.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Range Selector */}
                            <RangeSelector
                                range={contributionRange}
                                setRange={setContributionRange}
                                customStart="" setCustomStart={() => { }}
                                customEnd="" setCustomEnd={() => { }}
                            />
                        </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                        {data?.contributions && data.contributions[contributionPeriod]?.length > 0 ? (
                            <ContributionChart
                                data={filterByRange(data.contributions[contributionPeriod], contributionRange)}
                                period={contributionPeriod}
                            />
                        ) : (
                            <div className={styles.loading}>{loadingFlows ? 'Loading Data...' : 'No contribution data for this period'}</div>
                        )}
                    </div>
                </div>

                {/* 3. Dividend History */}
                <div className={styles.chartCard} style={{ height: '600px', position: 'relative' }}>
                    {loadingFlows && !data.dividends && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.1)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Dividends...</div>
                    )}
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                <h3 style={{ margin: 0 }}>Dividend History</h3>
                                <div className={styles.filterGroup}>
                                    {['month', 'year'].map(p => (
                                        <button
                                            key={p}
                                            className={`${styles.filterButton} ${dividendPeriod === p ? styles.filterButtonActive : ''}`}
                                            onClick={() => setDividendPeriod(p as any)}
                                        >
                                            {p.charAt(0).toUpperCase() + p.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Range Selector */}
                            <RangeSelector
                                range={dividendRange}
                                setRange={setDividendRange}
                                customStart="" setCustomStart={() => { }}
                                customEnd="" setCustomEnd={() => { }}
                            />
                        </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                        {data?.dividends && data.dividends[dividendPeriod]?.length > 0 ? (
                            <DividendChart
                                data={filterByRange(data.dividends[dividendPeriod], dividendRange)}
                                period={dividendPeriod}
                            />
                        ) : (
                            <div className={styles.loading}>{loadingFlows ? 'Loading Data...' : 'No dividend data for this period'}</div>
                        )}
                    </div>
                </div>
            </div>

        </div >
    );
}
