
'use client';

import { useState, useEffect } from 'react';
import ReportFilters, { FilterOptions } from '@/components/ReportFilters';
import PortfolioChart from '@/components/PortfolioChart';
import ContributionChart from '@/components/ContributionChart';
import DividendChart from '@/components/DividendChart';
import styles from './page.module.css';
import AnalysisSkeleton from '@/components/AnalysisSkeleton';
import { useCurrency } from '@/context/CurrencyContext';

import { ClientCache } from '@/lib/client-cache';

export default function EvolutionPage() {
    const [filters, setFilters] = useState<FilterOptions>({
        accountTypes: [],
        investmentTypes: []
    });

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

    const [range, setRange] = useState('ALL');
    const { currency } = useCurrency();

    useEffect(() => {
        const fetchHistory = async () => {
            const cacheKey = ClientCache.generateKey('evolution_history', { filters, range, currency });
            const cached = ClientCache.get<any>(cacheKey);

            if (cached) {
                setData(prev => ({ ...prev, evolution: cached.evolution }));
                setLoadingHistory(false);
                return;
            }

            setLoadingHistory(true);
            try {
                const backendFilters = { ...filters, assetClasses: filters.investmentTypes };
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
            const cacheKey = ClientCache.generateKey('evolution_flows', { filters, range, currency });
            const cached = ClientCache.get<any>(cacheKey);

            if (cached) {
                setData(prev => ({ ...prev, contributions: cached.contributions, dividends: cached.dividends }));
                setLoadingFlows(false);
                return;
            }

            setLoadingFlows(true);
            try {
                const backendFilters = { ...filters, assetClasses: filters.investmentTypes };
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

    // Helper to slice data based on Range
    const getFilteredEvolutionData = () => {
        if (!data?.evolution) return [];
        if (range === 'ALL') return data.evolution;

        const now = new Date();
        const cutoff = new Date();

        switch (range) {
            case '1M': cutoff.setMonth(now.getMonth() - 1); break;
            case '3M': cutoff.setMonth(now.getMonth() - 3); break;
            case '6M': cutoff.setMonth(now.getMonth() - 6); break;
            case '1Y': cutoff.setFullYear(now.getFullYear() - 1); break;
            case 'YTD': cutoff.setMonth(0, 1); break; // Jan 1st
            case '5Y': cutoff.setFullYear(now.getFullYear() - 5); break;
            default: return data.evolution;
        }

        return data.evolution.filter((p: any) => new Date(p.date) >= cutoff);
    };

    // Only show full page skeleton if EVERYTHING is loading for the FIRST time?
    // User wants "Async" style. Better to show structure and loaders inside.
    // So removing global AnalysisSkeleton return.

    console.log('Evolution Page Data:', data);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Portfolio History</h1>
                    <p className={styles.subtitle}>Track your portfolio performance, contributions, and dividends over time.</p>
                </div>
                <ReportFilters
                    onChange={setFilters}
                    initialFilters={filters}
                />
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
                        externalData={getFilteredEvolutionData()}
                    />
                </div>

                {/* 2. Contribution History */}
                <div className={styles.chartCard} style={{ height: '500px', position: 'relative' }}>
                    {loadingFlows && !data.contributions && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.1)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Flows...</div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h3>Contribution History</h3>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {/* Toggles */}
                            {['week', 'month', 'year'].map(p => (
                                <button
                                    key={p}
                                    onClick={() => setContributionPeriod(p as any)}
                                    style={{
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '0.25rem',
                                        border: '1px solid var(--border-color)',
                                        background: contributionPeriod === p ? 'var(--primary-color)' : 'transparent',
                                        color: contributionPeriod === p ? '#fff' : 'var(--text-secondary)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                        {data?.contributions && data.contributions[contributionPeriod]?.length > 0 ? (
                            <ContributionChart
                                data={data.contributions[contributionPeriod]}
                                period={contributionPeriod}
                            />
                        ) : (
                            <div className={styles.loading}>{loadingFlows ? 'Loading Data...' : 'No contribution data for this period'}</div>
                        )}
                    </div>
                </div>

                {/* 3. Dividend History */}
                <div className={styles.chartCard} style={{ height: '500px', position: 'relative' }}>
                    {loadingFlows && !data.dividends && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.1)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Dividends...</div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h3>Dividend History</h3>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {/* Toggles */}
                            {['month', 'year'].map(p => (
                                <button
                                    key={p}
                                    onClick={() => setDividendPeriod(p as any)}
                                    style={{
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '0.25rem',
                                        border: '1px solid var(--border-color)',
                                        background: dividendPeriod === p ? 'var(--primary-color)' : 'transparent',
                                        color: dividendPeriod === p ? '#fff' : 'var(--text-secondary)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                        {data?.dividends && data.dividends[dividendPeriod]?.length > 0 ? (
                            <DividendChart
                                data={data.dividends[dividendPeriod]}
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
