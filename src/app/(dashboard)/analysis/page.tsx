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

    const filteredConstituents = summary.constituents.filter(item => {
        if (filters.investmentType && item.type !== filters.investmentType) return false;
        if (filters.accountType && !item.accountTypes?.includes(filters.accountType)) return false;
        if (filters.accountName && !item.accountNames?.includes(filters.accountName)) return false;
        return true;
    });

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
