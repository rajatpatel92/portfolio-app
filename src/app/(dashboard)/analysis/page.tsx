'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react';
import styles from './page.module.css';
import { useCurrency } from '@/context/CurrencyContext';
import ConstituentsGrid from '@/components/ConstituentsGrid';


import AnalysisSkeleton from '@/components/AnalysisSkeleton';

// ... other imports

interface PortfolioSummary {
    allocationByType: { name: string; value: number }[];
    allocationByAsset: { name: string; value: number }[];
    constituents: any[];
}

export default function AnalysisPage() {
    const [summary, setSummary] = useState<PortfolioSummary | null>(null);
    const { format, convert } = useCurrency();

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

    if (!summary) return <AnalysisSkeleton />;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Portfolio Analysis</h1>
                <p className={styles.subtitle}>
                    Deep dive into your asset allocation and performance metrics.
                </p>
            </header>

            <div className={styles.analysisGrid}>


                {/* Constituents Grid */}
                <div className={styles.gridContainer}>
                    <ConstituentsGrid data={summary.constituents} />
                </div>
            </div>
        </div>
    );
}
